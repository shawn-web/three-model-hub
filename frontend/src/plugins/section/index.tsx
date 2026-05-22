import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface SectionPlaneState {
  enabled: boolean
  position: number
}

export interface SectionState {
  planes: {
    x: SectionPlaneState
    y: SectionPlaneState
    z: SectionPlaneState
  }
  bounds: Record<Axis, { min: number; max: number }>
}

interface OriginalMaterialState {
  side: THREE.Side
  clippingPlanes: THREE.Plane[] | null
  clipShadows: boolean
  stencilWrite: boolean
  stencilRef: number
  stencilFunc: THREE.StencilFunc
  stencilZPass: THREE.StencilOp
}

interface MaterialWithSectionState extends THREE.Material {
  [ORIGINAL_KEY]?: OriginalMaterialState
}

const ORIGINAL_KEY = '__sectionOriginalState'
const AXES = ['x', 'y', 'z'] as const
type Axis = (typeof AXES)[number]

// 剖切法线方向：切掉正方向的部分
const AXIS_NORMALS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(-1, 0, 0),
  y: new THREE.Vector3(0, -1, 0),
  z: new THREE.Vector3(0, 0, -1),
}

// ─── SectionPlugin ─────────────────────────────────────────────────────────────

export class SectionPlugin implements ViewerPlugin {
  id = 'section'
  name = '剖面'
  icon = 'cut'
  group = 'section' as const

  private context: ViewerContext | null = null
  private active = false

  private planes: Record<Axis, SectionPlaneState> = {
    x: { enabled: false, position: 0 },
    y: { enabled: false, position: 0 },
    z: { enabled: false, position: 0 },
  }

  private modelBounds: Record<Axis, { min: number; max: number }> = {
    x: { min: -5, max: 5 },
    y: { min: -5, max: 5 },
    z: { min: -5, max: 5 },
  }
  private activePlaneCount = 0

  // stencil 材质（供 SectionScene 使用）
  private _stencilBackMaterials: THREE.MeshBasicMaterial[] = []
  private _stencilFrontMaterials: THREE.MeshBasicMaterial[] = []
  private _capMaterials: THREE.MeshBasicMaterial[] = []

  private stateListener: ((state: SectionState) => void) | null = null

  // ── 生命周期 ───────────────────────────────────────────────────────────────

  install(context: ViewerContext): void {
    this.context = context
  }

  uninstall(): void {
    this.removeClipping()
    this.disposeStencilMaterials()
    this.context = null
    this.stateListener = null
  }

  activate(): void {
    this.active = true
    this.updateModelBounds()
    for (const axis of AXES) {
      this.planes[axis].enabled = false
      this.planes[axis].position = this.modelBounds[axis].max
    }
    // 默认启用 Y 轴，位置在模型顶部（锥体端点），向下拖动逐步剖切
    this.planes.y.enabled = true
    this.planes.y.position = this.modelBounds.y.max
    this.applyClipping()
    this.notifyListener()
  }

  deactivate(): void {
    this.active = false
    for (const axis of AXES) {
      this.planes[axis].enabled = false
    }
    this.removeClipping()
    this.notifyListener()
  }

  isActive(): boolean {
    return this.active
  }

  // ── 状态监听 ───────────────────────────────────────────────────────────────

  onStateChange(listener: (state: SectionState) => void): void {
    this.stateListener = listener
  }

  // ── 状态读写 ───────────────────────────────────────────────────────────────

  getState(): SectionState {
    return {
      planes: {
        x: { ...this.planes.x },
        y: { ...this.planes.y },
        z: { ...this.planes.z },
      },
      bounds: {
        x: { ...this.modelBounds.x },
        y: { ...this.modelBounds.y },
        z: { ...this.modelBounds.z },
      },
    }
  }

  getAxis(): Axis {
    // 返回第一个启用的轴，默认 'y'
    for (const axis of AXES) {
      if (this.planes[axis].enabled) return axis
    }
    return 'y'
  }

  toggle(axis: Axis, enabled?: boolean): void {
    const newState = enabled ?? !this.planes[axis].enabled
    if (newState) {
      // 单轴模式：禁用所有其他轴
      for (const a of AXES) {
        this.planes[a].enabled = false
      }
      // 新轴位置设为模型边界（与锥体一致），避免立即切面
      this.planes[axis].position = this.modelBounds[axis].max
    }
    this.planes[axis].enabled = newState
    this.applyClipping()
    this.notifyListener()
  }

  setPosition(axis: Axis, pos: number): void {
    const b = this.getBounds(axis)
    this.planes[axis].position = Math.max(b.min, Math.min(b.max, pos))
    this.applyClipping()
    this.notifyListener()
  }

  getBounds(axis?: Axis): { min: number; max: number } {
    if (axis) return { ...this.modelBounds[axis] }
    // 兼容调用：返回所有轴的并集
    const min = Math.min(this.modelBounds.x.min, this.modelBounds.y.min, this.modelBounds.z.min)
    const max = Math.max(this.modelBounds.x.max, this.modelBounds.y.max, this.modelBounds.z.max)
    return { min, max }
  }

  getModelCenter(): THREE.Vector3 {
    if (!this.context) return new THREE.Vector3()
    const model = this.context.store.getState().modelObject
    if (!model) return new THREE.Vector3()
    const box = new THREE.Box3().setFromObject(model)
    return box.getCenter(new THREE.Vector3())
  }

  getActivePlaneCount(): number {
    return AXES.filter((a) => this.planes[a].enabled).length
  }

  // ── 核心：应用/移除剖切 ────────────────────────────────────────────────────

  applyClipping(): void {
    if (!this.context) return

    const activePlanes = this.getActivePlanes()
    const hasEnabled = activePlanes.length > 0
    const planeCountChanged = activePlanes.length !== this.activePlaneCount
    this.activePlaneCount = activePlanes.length

    const model = this.context.store.getState().modelObject
    if (model) {
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((m) => {
          const mw = m as MaterialWithSectionState

          // 首次保存原始状态
          if (!mw[ORIGINAL_KEY]) {
            mw[ORIGINAL_KEY] = {
              side: m.side,
              clippingPlanes: m.clippingPlanes ? [...m.clippingPlanes] : null,
              clipShadows: m.clipShadows,
              stencilWrite: m.stencilWrite,
              stencilRef: m.stencilRef,
              stencilFunc: m.stencilFunc,
              stencilZPass: m.stencilZPass,
            }
          }

          if (hasEnabled) {
            m.clippingPlanes = activePlanes
            m.clipShadows = true
            m.side = THREE.DoubleSide
          } else {
            // 恢复原始状态
            const saved = mw[ORIGINAL_KEY]!
            m.side = saved.side
            m.clippingPlanes = saved.clippingPlanes
            m.clipShadows = saved.clipShadows
            m.stencilWrite = saved.stencilWrite
            m.stencilRef = saved.stencilRef
            m.stencilFunc = saved.stencilFunc
            m.stencilZPass = saved.stencilZPass
            delete mw[ORIGINAL_KEY]
          }
          // 仅在 plane 数量变化或关闭剖切时触发着色器重编译
          if (planeCountChanged || !hasEnabled) {
            m.needsUpdate = true
          }
        })
      })
    }

    this.context.renderer.localClippingEnabled = hasEnabled
    this.updateStencilMaterials()
  }

  private removeClipping(): void {
    if (!this.context) return
    const wasActive = this.activePlaneCount > 0
    this.activePlaneCount = 0
    const model = this.context.store.getState().modelObject
    if (model) {
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((m) => {
          const saved = (m as MaterialWithSectionState)[ORIGINAL_KEY]
          if (saved) {
            m.side = saved.side
            m.clippingPlanes = saved.clippingPlanes
            m.clipShadows = saved.clipShadows
            m.stencilWrite = saved.stencilWrite
            m.stencilRef = saved.stencilRef
            m.stencilFunc = saved.stencilFunc
            m.stencilZPass = saved.stencilZPass
            delete (m as MaterialWithSectionState)[ORIGINAL_KEY]
          } else {
            m.clippingPlanes = []
          }
          if (wasActive) {
            m.needsUpdate = true
          }
        })
      })
    }
    this.context.renderer.localClippingEnabled = false
  }

  /** 重置所有轴为禁用状态 */
  reset(): void {
    for (const axis of AXES) {
      this.planes[axis].enabled = false
      this.planes[axis].position = this.modelBounds[axis].max
    }
    this.removeClipping()
    this.notifyListener()
  }

  // ── Stencil 材质管理 ───────────────────────────────────────────────────────

  /** 获取当前启用的 THREE.Plane 列表 */
  getActivePlanes(): THREE.Plane[] {
    return AXES
      .filter((a) => this.planes[a].enabled)
      .map((a) => new THREE.Plane(AXIS_NORMALS[a].clone(), this.planes[a].position))
  }

  /** 获取 stencil back 材质数组（每个启用轴一个） */
  getStencilBackMaterials(): THREE.MeshBasicMaterial[] {
    return this._stencilBackMaterials
  }

  /** 获取 stencil front 材质数组 */
  getStencilFrontMaterials(): THREE.MeshBasicMaterial[] {
    return this._stencilFrontMaterials
  }

  /** 获取 cap 材质数组 */
  getCapMaterials(): THREE.MeshBasicMaterial[] {
    return this._capMaterials
  }

  /** 同步更新 stencil 材质的 clippingPlanes */
  private updateStencilMaterials(): void {
    const activePlanes = this.getActivePlanes()

    // 确保材质数量与启用轴数一致
    while (this._stencilBackMaterials.length < activePlanes.length) {
      this._stencilBackMaterials.push(
        new THREE.MeshBasicMaterial({
          side: THREE.BackSide,
          clippingPlanes: activePlanes,
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc,
          stencilZPass: THREE.IncrementWrapStencilOp,
          colorWrite: false,
          depthWrite: false,
        }),
      )
    }
    while (this._stencilFrontMaterials.length < activePlanes.length) {
      this._stencilFrontMaterials.push(
        new THREE.MeshBasicMaterial({
          side: THREE.FrontSide,
          clippingPlanes: activePlanes,
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc,
          stencilZPass: THREE.DecrementWrapStencilOp,
          colorWrite: false,
          depthWrite: false,
        }),
      )
    }
    while (this._capMaterials.length < activePlanes.length) {
      this._capMaterials.push(
        new THREE.MeshBasicMaterial({
          stencilWrite: false,
          stencilFunc: THREE.NotEqualStencilFunc,
          stencilRef: 0,
          color: 0xff4444,
          side: THREE.DoubleSide,
        }),
      )
    }

    // 更新 clippingPlanes
    for (let i = 0; i < activePlanes.length; i++) {
      this._stencilBackMaterials[i].clippingPlanes = activePlanes
      this._stencilFrontMaterials[i].clippingPlanes = activePlanes
      // cap 材质不需要 clippingPlanes，它依赖 stencil
    }
  }

  private disposeStencilMaterials(): void {
    this._stencilBackMaterials.forEach((m) => m.dispose())
    this._stencilFrontMaterials.forEach((m) => m.dispose())
    this._capMaterials.forEach((m) => m.dispose())
    this._stencilBackMaterials = []
    this._stencilFrontMaterials = []
    this._capMaterials = []
  }

  // ── 内部工具 ───────────────────────────────────────────────────────────────

  private updateModelBounds(): void {
    if (!this.context) return
    const model = this.context.store.getState().modelObject
    if (!model) {
      this.modelBounds = {
        x: { min: -5, max: 5 },
        y: { min: -5, max: 5 },
        z: { min: -5, max: 5 },
      }
      return
    }
    const box = new THREE.Box3().setFromObject(model)
    this.modelBounds = {
      x: { min: box.min.x, max: box.max.x },
      y: { min: box.min.y, max: box.max.y },
      z: { min: box.min.z, max: box.max.z },
    }
  }

  private notifyListener(): void {
    if (this.stateListener) {
      this.stateListener(this.getState())
    }
  }
}

export function createSectionPlugin(): ViewerPlugin {
  return new SectionPlugin()
}
