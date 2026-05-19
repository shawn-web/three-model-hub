/**
 * ViewCube 三维导航立方体组件
 *
 * 在预览页面右上角显示一个可交互的立方体导航器，
 * 用户可以点击面/边/角来快速切换视角，也可以拖拽旋转。
 *
 * 功能特性：
 * - 点击面：切换到对应正视图
 * - 点击边：切换到对应的双面等角视图（带平滑过渡动画）
 * - 点击角：切换到对应的三面等角视图（带平滑过渡动画）
 * - 悬停边：高亮边涉及的两个相邻面（各取 10% 矩形区域）
 * - 悬停角：高亮角涉及的三个相邻面（以角为顶点的等边三角形）
 * - 拖拽旋转：同步旋转主场景相机
 * - 自动同步：主场景相机旋转时 ViewCube 跟随旋转
 */
import { useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'

/** 每个面的 9 个区域（3×3 网格）对应的方向向量 */
const FACE_DIRS: Record<string, Record<string, number[]>> = {
  front:  { tl:[-1,1,1],  t:[0,1,1],  tr:[1,1,1],  l:[-1,0,1],  c:[0,0,1],  r:[1,0,1],  bl:[-1,-1,1],  b:[0,-1,1],  br:[1,-1,1] },
  back:   { tl:[1,1,-1],  t:[0,1,-1], tr:[-1,1,-1], l:[1,0,-1],  c:[0,0,-1], r:[-1,0,-1], bl:[1,-1,-1],  b:[0,-1,-1], br:[-1,-1,-1] },
  left:   { tl:[-1,1,-1], t:[-1,1,0], tr:[-1,1,1],  l:[-1,0,-1], c:[-1,0,0], r:[-1,0,1],  bl:[-1,-1,-1], b:[-1,-1,0], br:[-1,-1,1] },
  right:  { tl:[1,1,1],   t:[1,1,0],  tr:[1,1,-1],  l:[1,0,1],   c:[1,0,0],  r:[1,0,-1],  bl:[1,-1,1],   b:[1,-1,0],  br:[1,-1,-1] },
  top:    { tl:[-1,1,-1], t:[0,1,-1], tr:[1,1,-1],  l:[-1,1,0],  c:[0,1,0],  r:[1,1,0],   bl:[-1,1,1],   b:[0,1,1],   br:[1,1,1] },
  bottom: { tl:[-1,-1,1], t:[0,-1,1], tr:[1,-1,1],  l:[-1,-1,0], c:[0,-1,0], r:[1,-1,0],  bl:[-1,-1,-1], b:[0,-1,-1], br:[-1,-1,-1] },
}

/** 每个面的每个区域对应的相邻面列表（用于边/角高亮） */
const FACE_ADJACENT: Record<string, Record<string, string[]>> = {
  front:  { tl: ['top','left'],   t: ['top'],         tr: ['top','right'],  l: ['left'],   r: ['right'],  bl: ['bottom','left'],  b: ['bottom'],  br: ['bottom','right'] },
  back:   { tl: ['top','right'],  t: ['top'],         tr: ['top','left'],   l: ['right'],  r: ['left'],   bl: ['bottom','right'], b: ['bottom'],  br: ['bottom','left'] },
  left:   { tl: ['top','back'],   t: ['top'],         tr: ['top','front'],  l: ['back'],   r: ['front'],  bl: ['bottom','back'],  b: ['bottom'],  br: ['bottom','front'] },
  right:  { tl: ['top','front'],  t: ['top'],         tr: ['top','back'],   l: ['front'],  r: ['back'],   bl: ['bottom','front'], b: ['bottom'],  br: ['bottom','back'] },
  top:    { tl: ['back','left'],  t: ['back'],        tr: ['back','right'], l: ['left'],   r: ['right'],  bl: ['front','left'],   b: ['front'],   br: ['front','right'] },
  bottom: { tl: ['front','left'], t: ['front'],       tr: ['front','right'],l: ['left'],   r: ['right'],  bl: ['back','left'],    b: ['back'],    br: ['back','right'] },
}

/** 边区域到高亮条带方向的映射 */
const EDGE_ZONE_MAP: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
  t: 'top', b: 'bottom', l: 'left', r: 'right',
}

/** 角区域到高亮三角形方向的映射 */
const CORNER_ZONE_MAP: Record<string, { vEdge: 'top' | 'bottom'; hEdge: 'left' | 'right' }> = {
  tl: { vEdge: 'top', hEdge: 'left' },
  tr: { vEdge: 'top', hEdge: 'right' },
  bl: { vEdge: 'bottom', hEdge: 'left' },
  br: { vEdge: 'bottom', hEdge: 'right' },
}

/** ViewCube 画布尺寸（像素） */
const CANVAS_SIZE = 80
/** ViewCube 相机到原点的距离 */
const RADIUS = 2.6

/**
 * 根据 UV 坐标判断鼠标所在区域（3×3 网格）
 * 返回 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br'
 */
function getZoneFromUV(u: number, v: number): string {
  const T = 0.3
  const left = u < T, right = u > 1 - T, bottom = v < T, top = v > 1 - T
  if (top && left) return 'tl'
  if (top && right) return 'tr'
  if (bottom && left) return 'bl'
  if (bottom && right) return 'br'
  if (top) return 't'
  if (bottom) return 'b'
  if (left) return 'l'
  if (right) return 'r'
  return 'c'
}

/** 判断是否为边区域（非中心、非角） */
function isEdgeZone(zone: string): boolean {
  return ['t', 'b', 'l', 'r'].includes(zone)
}

/** 判断是否为角区域 */
function isCornerZone(zone: string): boolean {
  return ['tl', 'tr', 'bl', 'br'].includes(zone)
}

/** 创建面标签纹理（绘制文字标签到 Canvas 纹理） */
function createFaceTexture(label: string): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = '#c8c8c8'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, s - 2, s - 2)
  ctx.fillStyle = '#555'
  ctx.font = 'bold 34px -apple-system,BlinkMacSystemFont,sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, s / 2, s / 2)
  return new THREE.CanvasTexture(c)
}

/**
 * 创建高亮纹理
 * - 边高亮：在面的对应边绘制 10% 宽度的矩形条带
 * - 角高亮：在面的对应角绘制等边三角形
 *
 * @param type       高亮类型：'edge' 边 | 'corner' 角
 * @param edgeSide   边高亮时的方向（仅 type='edge' 时有效）
 * @param cornerInfo 角高亮时的方向信息（仅 type='corner' 时有效）
 */
function createHighlightTexture(
  type: 'edge' | 'corner' | 'center',
  edgeSide?: 'top' | 'bottom' | 'left' | 'right',
  cornerInfo?: { vEdge: 'top' | 'bottom'; hEdge: 'left' | 'right' },
): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!

  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.clearRect(0, 0, s, s)

  const strip = s * 0.18

  if (type === 'edge' && edgeSide) {
    ctx.fillStyle = 'rgba(74, 158, 255, 0.55)'
    switch (edgeSide) {
      case 'top':    ctx.fillRect(0, 0, s, strip); break
      case 'bottom': ctx.fillRect(0, s - strip, s, strip); break
      case 'left':   ctx.fillRect(0, 0, strip, s); break
      case 'right':  ctx.fillRect(s - strip, 0, strip, s); break
    }
  } else if (type === 'corner' && cornerInfo) {
    ctx.fillStyle = 'rgba(74, 158, 255, 0.55)'
    const cx = cornerInfo.hEdge === 'left' ? 0 : s
    const cy = cornerInfo.vEdge === 'top' ? 0 : s
    const triSize = s * 0.35
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    if (cornerInfo.vEdge === 'top' && cornerInfo.hEdge === 'left') {
      ctx.lineTo(cx + triSize, cy)
      ctx.lineTo(cx, cy + triSize)
    } else if (cornerInfo.vEdge === 'top' && cornerInfo.hEdge === 'right') {
      ctx.lineTo(cx - triSize, cy)
      ctx.lineTo(cx, cy + triSize)
    } else if (cornerInfo.vEdge === 'bottom' && cornerInfo.hEdge === 'left') {
      ctx.lineTo(cx + triSize, cy)
      ctx.lineTo(cx, cy - triSize)
    } else {
      ctx.lineTo(cx - triSize, cy)
      ctx.lineTo(cx, cy - triSize)
    }
    ctx.closePath()
    ctx.fill()
  } else if (type === 'center') {
    ctx.fillStyle = 'rgba(74, 158, 255, 0.25)'
    ctx.fillRect(0, 0, s, s)
  }

  return new THREE.CanvasTexture(c)
}

/** ViewCube 组件：渲染可交互的三维导航立方体 */
export function ViewCube() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animateRef = useRef<(dir: number[]) => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)

    const cubeGroup = new THREE.Group()
    scene.add(cubeGroup)

    cubeGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.97, 0.97, 0.97),
      new THREE.MeshBasicMaterial({ color: 0xeaeaea }),
    ))

    /** 面配置：key、标签、位置、旋转 */
    const faceCfg = [
      { key: 'front',  label: '前', pos: [0, 0, 0.501],  rot: [0, 0, 0] },
      { key: 'back',   label: '后', pos: [0, 0, -0.501], rot: [0, Math.PI, 0] },
      { key: 'left',   label: '左', pos: [-0.501, 0, 0], rot: [0, -Math.PI / 2, 0] },
      { key: 'right',  label: '右', pos: [0.501, 0, 0],  rot: [0, Math.PI / 2, 0] },
      { key: 'top',    label: '顶', pos: [0, 0.501, 0],  rot: [-Math.PI / 2, 0, 0] },
      { key: 'bottom', label: '底', pos: [0, -0.501, 0], rot: [Math.PI / 2, 0, 0] },
    ]

    /** 面网格（用于射线检测和点击） */
    const faceMeshes = faceCfg.map(cfg => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: createFaceTexture(cfg.label), transparent: true }),
      )
      m.position.set(...(cfg.pos as [number, number, number]))
      m.rotation.set(...(cfg.rot as [number, number, number]))
      m.userData = { faceKey: cfg.key }
      cubeGroup.add(m)
      return m
    })

    /** 高亮覆盖层网格（用于边/角悬停高亮效果） */
    const highlightMeshes: THREE.Mesh[] = faceCfg.map(cfg => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false }),
      )
      m.position.set(
        (cfg.pos as [number, number, number])[0] * 1.002,
        (cfg.pos as [number, number, number])[1] * 1.002,
        (cfg.pos as [number, number, number])[2] * 1.002,
      )
      m.rotation.set(...(cfg.rot as [number, number, number]))
      m.renderOrder = 1
      m.userData = { faceKey: cfg.key }
      cubeGroup.add(m)
      return m
    })

    /** 立方体边框线 */
    cubeGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003)),
      new THREE.LineBasicMaterial({ color: 0xaaaaaa }),
    ))

    /** 水平方位角（theta）和极角（phi） */
    let theta = Math.PI / 4
    let phi = 0.96
    /** 是否正在执行点击动画 */
    let animating = false
    /** 是否正在拖拽 */
    let dragging = false
    /** 是否可能开始拖拽（mousedown 后未确认） */
    let potentialDrag = false
    /** 拖拽起始状态 */
    let dragStart = { x: 0, y: 0, theta: 0, phi: 0 }

    /** ViewCube 自身旋转动画的目标角度 */
    let targetTheta = theta
    let targetPhi = phi
    /** ViewCube 动画起始角度 */
    let animThetaStart = theta
    let animPhiStart = phi
    /** ViewCube 动画开始时间 */
    let animT0 = 0
    /** ViewCube 是否正在执行旋转过渡动画 */
    let vcAnimating = false

    /** 更新 ViewCube 相机位置 */
    const updateVC = () => {
      camera.position.setFromSpherical(new THREE.Spherical(RADIUS, phi, theta))
      camera.lookAt(0, 0, 0)
    }
    updateVC()

    /** 拖拽时同步主场景相机方向 */
    const syncToMain = () => {
      const gs = useViewerStore.getState().getCameraState
      const ss = useViewerStore.getState().setCameraState
      if (!gs || !ss) return
      const cam = gs()
      const d = Math.sqrt(
        (cam.position.x - cam.target.x) ** 2 +
        (cam.position.y - cam.target.y) ** 2 +
        (cam.position.z - cam.target.z) ** 2,
      )
      const dir = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, phi, theta))
      ss({
        position: {
          x: cam.target.x + dir.x * d,
          y: cam.target.y + dir.y * d,
          z: cam.target.z + dir.z * d,
        },
        target: cam.target,
      })
    }

    /**
     * 点击面/边/角时，平滑动画旋转主场景相机到目标方向
     * 同时 ViewCube 自身也执行旋转过渡动画
     * @param targetDir 目标方向向量
     */
    const animateToDir = (targetDir: number[]) => {
      const gs = useViewerStore.getState().getCameraState
      const ss = useViewerStore.getState().setCameraState
      if (!gs || !ss) return
      animating = true

      const cam = gs()
      const tgt = cam.target
      let dist = Math.sqrt(
        (cam.position.x - tgt.x) ** 2 +
        (cam.position.y - tgt.y) ** 2 +
        (cam.position.z - tgt.z) ** 2,
      )

      // 对角线方向（等轴测等）时基于模型包围盒计算合适的距离
      const absSum = Math.abs(targetDir[0]) + Math.abs(targetDir[1]) + Math.abs(targetDir[2])
      if (absSum > 1.5) {
        const modelObject = useViewerStore.getState().modelObject
        if (modelObject) {
          const box = new THREE.Box3().setFromObject(modelObject)
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const fov = (cam.fov || 50) * (Math.PI / 180)
          dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5
        }
      }

      const len = Math.sqrt(targetDir[0] ** 2 + targetDir[1] ** 2 + targetDir[2] ** 2)
      const end = {
        x: tgt.x + (targetDir[0] / len) * dist,
        y: tgt.y + (targetDir[1] / len) * dist,
        z: tgt.z + (targetDir[2] / len) * dist,
      }
      const start = { ...cam.position }
      const t0 = performance.now()
      const dur = 500

      const targetSph = new THREE.Spherical().setFromVector3(
        new THREE.Vector3(targetDir[0], targetDir[1], targetDir[2]).normalize(),
      )
      targetTheta = targetSph.theta
      targetPhi = targetSph.phi
      animThetaStart = theta
      animPhiStart = phi
      animT0 = performance.now()
      vcAnimating = true

      const step = () => {
        const t = Math.min((performance.now() - t0) / dur, 1)
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        ss({
          position: {
            x: start.x + (end.x - start.x) * e,
            y: start.y + (end.y - start.y) * e,
            z: start.z + (end.z - start.z) * e,
          },
          target: tgt,
        })
        if (t < 1) requestAnimationFrame(step)
        else animating = false
      }
      requestAnimationFrame(step)
    }
    animateRef.current = animateToDir

    /** 渲染循环：处理 ViewCube 自身旋转动画并渲染 */
    let rafId = requestAnimationFrame(function loop() {
      if (vcAnimating) {
        const t = Math.min((performance.now() - animT0) / 500, 1)
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        theta = animThetaStart + (targetTheta - animThetaStart) * e
        phi = animPhiStart + (targetPhi - animPhiStart) * e
        updateVC()
        if (t >= 1) vcAnimating = false
      }
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(loop)
    })

    /** 定时同步主场景相机方向到 ViewCube（80ms 间隔） */
    const syncId = setInterval(() => {
      if (animating || dragging || potentialDrag || vcAnimating) return
      const gs = useViewerStore.getState().getCameraState
      if (!gs) return
      const cam = gs()
      const dir = new THREE.Vector3(
        cam.position.x - cam.target.x,
        cam.position.y - cam.target.y,
        cam.position.z - cam.target.z,
      )
      const sph = new THREE.Spherical().setFromVector3(dir)
      theta = sph.theta
      phi = sph.phi
      updateVC()
    }, 80)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    /** 清除所有高亮效果 */
    const clearHighlights = () => {
      highlightMeshes.forEach((hm) => {
        const mat = hm.material as THREE.MeshBasicMaterial
        mat.opacity = 0
        if (mat.map) {
          mat.map.dispose()
          mat.map = null
        }
      })
    }

    /**
     * 应用边高亮效果
     * 在当前面和相邻面上绘制 10% 矩形条带高亮
     */
    const applyEdgeHighlight = (faceKey: string, zone: string) => {
      const edgeSide = EDGE_ZONE_MAP[zone]
      if (!edgeSide) return
      const adjFaces = FACE_ADJACENT[faceKey]?.[zone] || []

      const faceIdx = faceCfg.findIndex(f => f.key === faceKey)
      if (faceIdx >= 0) {
        const hm = highlightMeshes[faceIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()
        mat.map = createHighlightTexture('edge', edgeSide)
        mat.opacity = 1
      }

      adjFaces.forEach(adjKey => {
        const adjIdx = faceCfg.findIndex(f => f.key === adjKey)
        if (adjIdx < 0) return
        const hm = highlightMeshes[adjIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()

        let adjEdgeSide: 'top' | 'bottom' | 'left' | 'right'
        if (faceKey === 'front') {
          adjEdgeSide = edgeSide === 'top' ? 'bottom' : edgeSide === 'bottom' ? 'top' : edgeSide === 'left' ? 'right' : 'left'
        } else if (faceKey === 'back') {
          adjEdgeSide = edgeSide === 'top' ? 'bottom' : edgeSide === 'bottom' ? 'top' : edgeSide === 'left' ? 'left' : 'right'
        } else if (faceKey === 'left') {
          adjEdgeSide = edgeSide === 'top' ? 'bottom' : edgeSide === 'bottom' ? 'top' : edgeSide === 'left' ? 'right' : 'left'
        } else if (faceKey === 'right') {
          adjEdgeSide = edgeSide === 'top' ? 'bottom' : edgeSide === 'bottom' ? 'top' : edgeSide === 'left' ? 'left' : 'right'
        } else if (faceKey === 'top') {
          adjEdgeSide = edgeSide === 'top' ? 'bottom' : edgeSide === 'bottom' ? 'top' : edgeSide === 'left' ? 'right' : 'left'
        } else {
          adjEdgeSide = edgeSide === 'top' ? 'top' : edgeSide === 'bottom' ? 'bottom' : edgeSide === 'left' ? 'left' : 'right'
        }

        mat.map = createHighlightTexture('edge', adjEdgeSide)
        mat.opacity = 1
      })
    }

    /**
     * 应用角高亮效果
     * 在当前面和相邻面上绘制等边三角形高亮
     */
    const applyCornerHighlight = (faceKey: string, zone: string) => {
      const cornerInfo = CORNER_ZONE_MAP[zone]
      if (!cornerInfo) return
      const adjFaces = FACE_ADJACENT[faceKey]?.[zone] || []

      const faceIdx = faceCfg.findIndex(f => f.key === faceKey)
      if (faceIdx >= 0) {
        const hm = highlightMeshes[faceIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()
        mat.map = createHighlightTexture('corner', undefined, cornerInfo)
        mat.opacity = 1
      }

      adjFaces.forEach(adjKey => {
        const adjIdx = faceCfg.findIndex(f => f.key === adjKey)
        if (adjIdx < 0) return
        const hm = highlightMeshes[adjIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()

        let adjCornerInfo: { vEdge: 'top' | 'bottom'; hEdge: 'left' | 'right' }
        const isVEdge = (adjKey === 'top' && cornerInfo.vEdge === 'top') || (adjKey === 'bottom' && cornerInfo.vEdge === 'bottom')
        const isHEdge = (adjKey === 'left' && cornerInfo.hEdge === 'left') || (adjKey === 'right' && cornerInfo.hEdge === 'right')

        if (faceKey === 'front') {
          if (isVEdge) {
            adjCornerInfo = { vEdge: 'bottom', hEdge: cornerInfo.hEdge === 'left' ? 'right' : 'left' }
          } else {
            adjCornerInfo = { vEdge: cornerInfo.vEdge === 'top' ? 'top' : 'bottom', hEdge: cornerInfo.hEdge === 'left' ? 'left' : 'right' }
          }
        } else if (faceKey === 'back') {
          if (isVEdge) {
            adjCornerInfo = { vEdge: 'bottom', hEdge: cornerInfo.hEdge }
          } else {
            adjCornerInfo = { vEdge: cornerInfo.vEdge, hEdge: cornerInfo.hEdge === 'left' ? 'right' : 'left' }
          }
        } else if (faceKey === 'left' || faceKey === 'right') {
          if (isVEdge) {
            adjCornerInfo = { vEdge: 'bottom', hEdge: cornerInfo.hEdge === 'left' ? 'right' : 'left' }
          } else {
            adjCornerInfo = { vEdge: cornerInfo.vEdge, hEdge: cornerInfo.hEdge === 'left' ? 'left' : 'right' }
          }
        } else if (faceKey === 'top') {
          if (isVEdge) {
            adjCornerInfo = { vEdge: cornerInfo.vEdge, hEdge: cornerInfo.hEdge === 'left' ? 'right' : 'left' }
          } else {
            adjCornerInfo = { vEdge: cornerInfo.vEdge === 'top' ? 'top' : 'bottom', hEdge: cornerInfo.hEdge }
          }
        } else {
          if (isVEdge) {
            adjCornerInfo = { vEdge: cornerInfo.vEdge, hEdge: cornerInfo.hEdge === 'left' ? 'right' : 'left' }
          } else {
            adjCornerInfo = { vEdge: cornerInfo.vEdge === 'top' ? 'top' : 'bottom', hEdge: cornerInfo.hEdge }
          }
        }

        mat.map = createHighlightTexture('corner', undefined, adjCornerInfo)
        mat.opacity = 1
      })
    }

    /** 鼠标按下：开始拖拽或准备点击 */
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      potentialDrag = true
      dragging = false
      dragStart = { x: e.clientX, y: e.clientY, theta, phi }
      e.preventDefault()
    }

    /** 鼠标移动（全局）：处理拖拽旋转 */
    const onMove = (e: MouseEvent) => {
      if (!potentialDrag) return
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      if (!dragging && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        dragging = true
        canvas.style.cursor = 'grabbing'
      }
      if (!dragging) return
      theta = dragStart.theta + dx * 0.008
      phi = Math.max(0.15, Math.min(Math.PI - 0.15, dragStart.phi + dy * 0.008))
      updateVC()
      syncToMain()
    }

    /** 鼠标松开：结束拖拽或执行点击导航 */
    const onUp = (e: MouseEvent) => {
      if (!potentialDrag) return
      potentialDrag = false
      canvas.style.cursor = 'grab'
      if (dragging) {
        dragging = false
        return
      }
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(faceMeshes)
      if (hits.length > 0 && hits[0].uv) {
        const faceKey = hits[0].object.userData.faceKey
        const zone = getZoneFromUV(hits[0].uv.x, hits[0].uv.y)
        const dir = FACE_DIRS[faceKey]?.[zone]
        if (dir) animateToDir(dir)
      }
    }

    /** 鼠标悬停：检测边/角区域并显示高亮 */
    const onHover = (e: MouseEvent) => {
      if (dragging || potentialDrag) return
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(faceMeshes)

      clearHighlights()

      if (hits.length > 0 && hits[0].uv) {
        canvas.style.cursor = 'pointer'
        const faceKey = hits[0].object.userData.faceKey
        const zone = getZoneFromUV(hits[0].uv.x, hits[0].uv.y)

        if (isEdgeZone(zone)) {
          applyEdgeHighlight(faceKey, zone)
        } else if (isCornerZone(zone)) {
          applyCornerHighlight(faceKey, zone)
        } else {
          // 面中心高亮
          const faceIdx = faceCfg.findIndex(f => f.key === faceKey)
          if (faceIdx >= 0) {
            const hm = highlightMeshes[faceIdx]
            const mat = hm.material as THREE.MeshBasicMaterial
            if (mat.map) mat.map.dispose()
            mat.map = createHighlightTexture('center')
            mat.opacity = 1
          }
        }
      } else {
        canvas.style.cursor = 'grab'
      }
    }

    /** 鼠标离开：清除高亮 */
    const onLeave = () => {
      clearHighlights()
    }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onHover)
    canvas.addEventListener('mouseleave', onLeave)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(syncId)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onHover)
      canvas.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      faceMeshes.forEach(m => {
        ;(m.material as THREE.MeshBasicMaterial).map?.dispose()
        m.material.dispose()
        m.geometry.dispose()
      })
      highlightMeshes.forEach(m => {
        ;(m.material as THREE.MeshBasicMaterial).map?.dispose()
        m.material.dispose()
        m.geometry.dispose()
      })
      renderer.dispose()
    }
  }, [])

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <canvas
        ref={canvasRef}
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, cursor: 'grab', borderRadius: 6 }}
      />
      <div
        onClick={() => animateRef.current([1, 1, 1])}
        title="等轴测视角"
        style={{
          marginTop: 4,
          width: 20,
          height: 20,
          borderRadius: 4,
          background: '#f0f0f0',
          border: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#999',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#e6f7ff'; e.currentTarget.style.color = '#1890ff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#999' }}
      >
        <Icon icon="lucide:home" width={11} height={11} />
      </div>
    </div>
  )
}
