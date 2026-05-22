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
import { homeIcon } from './Icons'
import * as THREE from 'three'

/** ViewCube 相机状态接口 */
interface CameraState {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
  fov: number
}

/** ViewCube 组件 Props */
export interface ViewCubeProps {
  /** 获取主场景相机状态的回调 */
  getCameraState: (() => CameraState) | null
  /** 设置主场景相机状态的回调 */
  setCameraState: ((state: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up?: { x: number; y: number; z: number }
    fov?: number
  }) => void) | null
  /** 3D 模型对象，用于对角线视角距离计算 */
  modelObject: THREE.Group | null
}

/** 每个面的 9 个区域（3×3 网格）对应的方向向量 */
const FACE_DIRS: Record<string, Record<string, number[]>> = {
  front:  { tl:[-1,1,1],  t:[0,1,1],  tr:[1,1,1],  l:[-1,0,1],  c:[0,0,1],  r:[1,0,1],  bl:[-1,-1,1],  b:[0,-1,1],  br:[1,-1,1] },
  back:   { tl:[1,1,-1],  t:[0,1,-1], tr:[-1,1,-1], l:[1,0,-1],  c:[0,0,-1], r:[-1,0,-1], bl:[1,-1,-1],  b:[0,-1,-1], br:[-1,-1,-1] },
  left:   { tl:[-1,1,-1], t:[-1,1,0], tr:[-1,1,1],  l:[-1,0,-1], c:[-1,0,0], r:[-1,0,1],  bl:[-1,-1,-1], b:[-1,-1,0], br:[-1,-1,1] },
  right:  { tl:[1,1,1],   t:[1,1,0],  tr:[1,1,-1],  l:[1,0,1],   c:[1,0,0],  r:[1,0,-1],  bl:[1,-1,1],   b:[1,-1,0],  br:[1,-1,-1] },
  top:    { tl:[-1,1,-1], t:[0,1,-1], tr:[1,1,-1],  l:[-1,1,0],  c:[0,1,0],  r:[1,1,0],   bl:[-1,1,1],   b:[0,1,1],   br:[1,1,1] },
  bottom: { tl:[-1,-1,1], t:[0,-1,1], tr:[1,-1,1],  l:[-1,-1,0], c:[0,-1,0], r:[1,-1,0],  bl:[-1,-1,-1], b:[0,-1,-1], br:[-1,-1,-1] },
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

/** 角区域相邻面的正确角映射：给定 (face, zone)，返回两个相邻面及其对应的角位置 */
const CORNER_ADJACENT: Record<string, Record<string, Array<{ face: string; corner: 'tl' | 'tr' | 'bl' | 'br' }>>> = {
  front: {
    tl: [{ face: 'top', corner: 'bl' }, { face: 'left', corner: 'tr' }],
    tr: [{ face: 'top', corner: 'br' }, { face: 'right', corner: 'tl' }],
    bl: [{ face: 'bottom', corner: 'tl' }, { face: 'left', corner: 'br' }],
    br: [{ face: 'bottom', corner: 'tr' }, { face: 'right', corner: 'bl' }],
  },
  back: {
    tl: [{ face: 'top', corner: 'tr' }, { face: 'right', corner: 'tr' }],
    tr: [{ face: 'top', corner: 'tl' }, { face: 'left', corner: 'tl' }],
    bl: [{ face: 'bottom', corner: 'br' }, { face: 'right', corner: 'br' }],
    br: [{ face: 'bottom', corner: 'bl' }, { face: 'left', corner: 'bl' }],
  },
  left: {
    tl: [{ face: 'top', corner: 'tl' }, { face: 'back', corner: 'tr' }],
    tr: [{ face: 'top', corner: 'bl' }, { face: 'front', corner: 'tl' }],
    bl: [{ face: 'bottom', corner: 'bl' }, { face: 'back', corner: 'br' }],
    br: [{ face: 'bottom', corner: 'tl' }, { face: 'front', corner: 'bl' }],
  },
  right: {
    tl: [{ face: 'top', corner: 'br' }, { face: 'front', corner: 'tr' }],
    tr: [{ face: 'top', corner: 'tr' }, { face: 'back', corner: 'tl' }],
    bl: [{ face: 'bottom', corner: 'tr' }, { face: 'front', corner: 'br' }],
    br: [{ face: 'bottom', corner: 'br' }, { face: 'back', corner: 'bl' }],
  },
  top: {
    tl: [{ face: 'back', corner: 'tr' }, { face: 'left', corner: 'tl' }],
    tr: [{ face: 'back', corner: 'tl' }, { face: 'right', corner: 'tr' }],
    bl: [{ face: 'front', corner: 'tl' }, { face: 'left', corner: 'tr' }],
    br: [{ face: 'front', corner: 'tr' }, { face: 'right', corner: 'tl' }],
  },
  bottom: {
    tl: [{ face: 'front', corner: 'bl' }, { face: 'left', corner: 'br' }],
    tr: [{ face: 'front', corner: 'br' }, { face: 'right', corner: 'bl' }],
    bl: [{ face: 'back', corner: 'br' }, { face: 'left', corner: 'bl' }],
    br: [{ face: 'back', corner: 'bl' }, { face: 'right', corner: 'br' }],
  },
}

/** 边区域相邻面及对应边映射：给定 (face, edgeZone)，返回相邻面及其对应的边方向 */
const EDGE_ADJACENT: Record<string, Record<string, { face: string; edgeSide: 'top' | 'bottom' | 'left' | 'right' }>> = {
  front: {
    t: { face: 'top', edgeSide: 'bottom' },
    b: { face: 'bottom', edgeSide: 'top' },
    l: { face: 'left', edgeSide: 'right' },
    r: { face: 'right', edgeSide: 'left' },
  },
  back: {
    t: { face: 'top', edgeSide: 'top' },
    b: { face: 'bottom', edgeSide: 'bottom' },
    l: { face: 'right', edgeSide: 'right' },
    r: { face: 'left', edgeSide: 'left' },
  },
  left: {
    t: { face: 'top', edgeSide: 'left' },
    b: { face: 'bottom', edgeSide: 'left' },
    l: { face: 'back', edgeSide: 'right' },
    r: { face: 'front', edgeSide: 'left' },
  },
  right: {
    t: { face: 'top', edgeSide: 'right' },
    b: { face: 'bottom', edgeSide: 'right' },
    l: { face: 'front', edgeSide: 'right' },
    r: { face: 'back', edgeSide: 'left' },
  },
  top: {
    t: { face: 'back', edgeSide: 'top' },
    b: { face: 'front', edgeSide: 'top' },
    l: { face: 'left', edgeSide: 'top' },
    r: { face: 'right', edgeSide: 'top' },
  },
  bottom: {
    t: { face: 'front', edgeSide: 'bottom' },
    b: { face: 'back', edgeSide: 'bottom' },
    l: { face: 'left', edgeSide: 'bottom' },
    r: { face: 'right', edgeSide: 'bottom' },
  },
}

/** ViewCube 画布显示尺寸（像素） */
const CANVAS_SIZE = 96
/** ViewCube 相机到原点的距离 */
const RADIUS = 2.6

/**
 * 根据 UV 坐标判断鼠标所在区域（3×3 网格）
 * 返回 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br'
 */
function getZoneFromUV(u: number, v: number): string {
  const T = 0.067
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

/** 创建面标签纹理（绘制文字标签 + 灰色角/边可点击区域指示器） */
function createFaceTexture(label: string): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#b8bfca'
  ctx.fillRect(0, 0, s, s)

  const triS = s * 0.14
  const zoneT = s * 0.32
  const barW = s * 0.10

  ctx.fillStyle = 'rgba(0,0,0,0.18)'

  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(triS, 0); ctx.lineTo(0, triS); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s - triS, 0); ctx.lineTo(s, triS); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(triS, s); ctx.lineTo(0, s - triS); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(s, s); ctx.lineTo(s - triS, s); ctx.lineTo(s, s - triS); ctx.closePath(); ctx.fill()

  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(zoneT, 0, s - zoneT * 2, barW)
  ctx.fillRect(zoneT, s - barW, s - zoneT * 2, barW)
  ctx.fillRect(0, zoneT, barW, s - zoneT * 2)
  ctx.fillRect(s - barW, zoneT, barW, s - zoneT * 2)

  ctx.strokeStyle = '#8a929a'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, s - 2, s - 2)
  ctx.fillStyle = '#2a2f36'
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

  if (type === 'edge' && edgeSide) {
    ctx.fillStyle = 'rgba(74, 158, 255, 0.7)'
    const barW = s * 0.10
    const zoneT = s * 0.32
    switch (edgeSide) {
      case 'top':    ctx.fillRect(zoneT, 0, s - zoneT * 2, barW); break
      case 'bottom': ctx.fillRect(zoneT, s - barW, s - zoneT * 2, barW); break
      case 'left':   ctx.fillRect(0, zoneT, barW, s - zoneT * 2); break
      case 'right':  ctx.fillRect(s - barW, zoneT, barW, s - zoneT * 2); break
    }
  } else if (type === 'corner' && cornerInfo) {
    ctx.fillStyle = 'rgba(74, 158, 255, 0.7)'
    const cx = cornerInfo.hEdge === 'left' ? 0 : s
    const cy = cornerInfo.vEdge === 'top' ? 0 : s
    const triSize = s * 0.14
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
export function ViewCube({ getCameraState, setCameraState, modelObject }: ViewCubeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animateRef = useRef<(dir: number[]) => void>(() => {})

  // 用 ref 保持 props 最新值，供内部 useEffect 读取
  const getCameraStateRef = useRef(getCameraState)
  const setCameraStateRef = useRef(setCameraState)
  const modelObjectRef = useRef(modelObject)

  useEffect(() => { getCameraStateRef.current = getCameraState }, [getCameraState])
  useEffect(() => { setCameraStateRef.current = setCameraState }, [setCameraState])
  useEffect(() => { modelObjectRef.current = modelObject }, [modelObject])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE)
    renderer.setPixelRatio(Math.max(window.devicePixelRatio, 2.5))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)

    const cubeGroup = new THREE.Group()
    scene.add(cubeGroup)

    cubeGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.97, 0.97, 0.97),
      new THREE.MeshBasicMaterial({ color: 0xcdd2d8 }),
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

    /** 高亮覆盖层网格（预配置材质，通过 visible 切换） */
    const highlightMeshes: THREE.Mesh[] = faceCfg.map(cfg => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: '#3b82f6', transparent: true, opacity: 0.3, depthTest: false }),
      )
      m.position.set(
        (cfg.pos as [number, number, number])[0] * 1.002,
        (cfg.pos as [number, number, number])[1] * 1.002,
        (cfg.pos as [number, number, number])[2] * 1.002,
      )
      m.rotation.set(...(cfg.rot as [number, number, number]))
      m.renderOrder = 1
      m.visible = false
      m.userData = { faceKey: cfg.key }
      cubeGroup.add(m)
      return m
    })

    /** 立方体边框线（缩短至角三角形最近点） */
    const HALF = 0.5015
    const TRI_W = 0.14
    const cns: [number, number, number][] = [
      [-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],
      [1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1],
    ].map(c => [c[0]*HALF, c[1]*HALF, c[2]*HALF] as [number,number,number])
    const eis: [number,number][] = [
      [0,1],[2,3],[4,5],[6,7],
      [0,2],[1,3],[4,6],[5,7],
      [0,4],[1,5],[2,6],[3,7],
    ]
    const ePts: number[] = []
    for (const [ai,bi] of eis) {
      const [ax,ay,az] = cns[ai], [bx,by,bz] = cns[bi]
      const dx=bx-ax, dy=by-ay, dz=bz-az, len=Math.sqrt(dx*dx+dy*dy+dz*dz)
      ePts.push(ax+dx/len*TRI_W, ay+dy/len*TRI_W, az+dz/len*TRI_W)
      ePts.push(bx-dx/len*TRI_W, by-dy/len*TRI_W, bz-dz/len*TRI_W)
    }
    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePts, 3))
    cubeGroup.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xbcc2cb })))

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
      const gs = getCameraStateRef.current
      const ss = setCameraStateRef.current
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
      const gs = getCameraStateRef.current
      const ss = setCameraStateRef.current
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
        const mo = modelObjectRef.current
        if (mo) {
          const box = new THREE.Box3().setFromObject(mo)
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
      const gs = getCameraStateRef.current
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
        hm.visible = false
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) {
          mat.map.dispose()
          mat.map = null
        }
        mat.color.set('#3b82f6')
        mat.opacity = 0.3
      })
    }

    /**
     * 应用边高亮效果
     * 在当前面和相邻面上绘制 10% 矩形条带高亮
     */
    const applyEdgeHighlight = (faceKey: string, zone: string) => {
      const edgeSide = EDGE_ZONE_MAP[zone]
      if (!edgeSide) return

      const faceIdx = faceCfg.findIndex(f => f.key === faceKey)
      if (faceIdx >= 0) {
        const hm = highlightMeshes[faceIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()
        mat.map = createHighlightTexture('edge', edgeSide)
        mat.color.set('white')
        mat.opacity = 1
        hm.visible = true
      }

      const adjInfo = EDGE_ADJACENT[faceKey]?.[zone]
      if (adjInfo) {
        const adjIdx = faceCfg.findIndex(f => f.key === adjInfo.face)
        if (adjIdx >= 0) {
          const hm = highlightMeshes[adjIdx]
          const mat = hm.material as THREE.MeshBasicMaterial
          if (mat.map) mat.map.dispose()
          mat.map = createHighlightTexture('edge', adjInfo.edgeSide)
          mat.color.set('white')
          mat.opacity = 1
          hm.visible = true
        }
      }
    }

    /** 应用角高亮效果：在当前面和相邻面上绘制三角形高亮 */
    const applyCornerHighlight = (faceKey: string, zone: string) => {
      const cornerInfo = CORNER_ZONE_MAP[zone]
      if (!cornerInfo) return
      const adj = CORNER_ADJACENT[faceKey]?.[zone] || []

      const faceIdx = faceCfg.findIndex(f => f.key === faceKey)
      if (faceIdx >= 0) {
        const hm = highlightMeshes[faceIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()
        mat.map = createHighlightTexture('corner', undefined, cornerInfo)
        mat.color.set('white')
        mat.opacity = 1
        hm.visible = true
      }

      adj.forEach(({ face: adjFace, corner: adjZone }) => {
        const adjIdx = faceCfg.findIndex(f => f.key === adjFace)
        if (adjIdx < 0) return
        const hm = highlightMeshes[adjIdx]
        const mat = hm.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()
        mat.map = createHighlightTexture('corner', undefined, CORNER_ZONE_MAP[adjZone])
        mat.color.set('white')
        mat.opacity = 1
        hm.visible = true
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
      theta = dragStart.theta - dx * 0.008
      phi = Math.max(0.15, Math.min(Math.PI - 0.15, dragStart.phi - dy * 0.008))
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
          canvas.style.cursor = 'pointer'
          const faceIdx = faceCfg.findIndex(f => f.key === faceKey)
          if (faceIdx >= 0) {
            const hm = highlightMeshes[faceIdx]
            const mat = hm.material as THREE.MeshBasicMaterial
            if (mat.map) mat.map.dispose()
            mat.map = createHighlightTexture('center')
            mat.color.set('white')
            mat.opacity = 1
            hm.visible = true
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
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, cursor: 'grab', borderRadius: 8 }}
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
        <Icon icon={homeIcon} width={11} height={11} />
      </div>
    </div>
  )
}
