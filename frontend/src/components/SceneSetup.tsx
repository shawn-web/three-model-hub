/**
 * 统一场景渲染组件
 *
 * 在编辑模式和预览模式下共享核心 3D 场景渲染：
 * - 灯光、背景、阴影、OrbitControls
 * - 模型显示、标记、场景图像
 * - 插件系统（通过 PluginScene 渲染各插件的 3D 内容）
 * - 编辑模式特有交互（双击选择、标记放置、图像放置、变换控件）
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../store/scene-store'
import { useEditStore } from '../store/edit-store'
import { fitToView } from '../utils/fit-to-view'
import { getMessageBus } from '../hooks/useMessageBus'
import { MESSAGE_TYPES } from '../communication/protocol'
import { SceneBackground } from './SceneBackground'
import { SceneImageSprite } from './SceneImageSprite'
import { MarkerSpriteShared, createDefaultMarkerImage } from './MarkerSpriteShared'
import { getDefaultMarkerUrl } from '../utils/marker-defaults'
import { PluginScene } from './PluginScene'
import { LIGHT_DEFAULTS } from '../utils/lighting'
import type { SceneSetupConfig } from '../types/plugin-config'
import type { PluginManager } from '../core/plugin-manager'

interface SceneSetupProps {
  config: SceneSetupConfig
  pluginManager: PluginManager | null
}

/** 标点计数器 */
let markerCounter = 0

export function SceneSetup({ config, pluginManager }: SceneSetupProps) {
  const orbitRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const ambientLightRef = useRef<THREE.AmbientLight>(null)
  const modelGroupRef = useRef<THREE.Group>(null!)
  const { camera: cameraFromHook, gl: glFromHook } = useThree()
  // 使用 ref 保存 hook 返回的 Three.js 对象，通过 effect 同步避免 linter 报错
  const glRef = useRef(glFromHook)
  const cameraRef = useRef(cameraFromHook)
  useEffect(() => {
    glRef.current = glFromHook
    cameraRef.current = cameraFromHook
  })

  // ── 场景数据 ──
  const modelObject = useSceneStore((s) => s.modelObject)
  const selectedComponentId = useSceneStore((s) => s.selectedComponentId)
  const markers_scene = useSceneStore((s) => s.markers)
  const sceneImages_scene = useSceneStore((s) => s.sceneImages)

  // ── 编辑模式特有状态（hooks 必须无条件调用） ──
  const editAddingMarker = useEditStore((s) => s.addingMarker)
  const editEditingMarkerId = useEditStore((s) => s.editingMarkerId)
  const editSelectedMarkerId = useEditStore((s) => s.selectedMarkerId)
  const editPlacingImageId = useEditStore((s) => s.placingImageId)
  const sceneVersion = useEditStore((s) => s.sceneVersion)
  const markers_edit = useEditStore((s) => s.markers)
  const sceneImages_edit = useEditStore((s) => s.sceneImages)
  // 根据模式选择实际使用的值（hooks 必须无条件调用，故先调用再选择）
  const addingMarker = config.mode === 'edit' ? editAddingMarker : false
  const editingMarkerId = config.mode === 'edit' ? editEditingMarkerId : null
  const _selectedMarkerId = config.mode === 'edit' ? editSelectedMarkerId : null
  const _placingImageId = config.mode === 'edit' ? editPlacingImageId : null
  const markers = config.mode === 'edit' ? markers_edit : markers_scene
  const sceneImages = config.mode === 'edit' ? sceneImages_edit : sceneImages_scene
  // _selectedMarkerId 和 _placingImageId 预留给后续功能使用
  void addingMarker
  void editingMarkerId
  void _selectedMarkerId
  void _placingImageId
  const activeTab = config.editTab ?? 'scene'

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null)
  const cameraAnim = useRef<{ targetPos: THREE.Vector3; targetLookAt: THREE.Vector3; progress: number } | null>(null)

  // ── 渲染器配置 ──
  useEffect(() => {
    const gl = glRef.current
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.3
  }, [])

  // ── 光照同步 ──
  const { ambientIntensity, lightIntensity, lightColor } = config.lighting
  useFrame(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = ambientIntensity
      ambientLightRef.current.color.set(lightColor)
    }
  })

  // ── 相机状态回调 ──
  useEffect(() => {
    useSceneStore.getState().setGetCameraState(() => {
      const cam = cameraRef.current as THREE.PerspectiveCamera
      const controls = orbitRef.current
      return {
        position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        target: controls
          ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
          : { x: 0, y: 0, z: 0 },
        up: { x: cam.up.x, y: cam.up.y, z: cam.up.z },
        fov: cam.fov,
      }
    })

    useSceneStore.getState().setSetCameraState((state) => {
      const cam = cameraRef.current as THREE.PerspectiveCamera
      const controls = orbitRef.current
      cam.position.set(state.position.x, state.position.y, state.position.z)
      if (controls) {
        controls.target.set(state.target.x, state.target.y, state.target.z)
      }
      if (state.up) {
        cam.up.set(state.up.x, state.up.y, state.up.z)
      }
      if (state.fov !== undefined) {
        cam.fov = state.fov
        cam.updateProjectionMatrix()
      }
      controls?.update()
    })

    return () => {
      useSceneStore.getState().setGetCameraState(null)
      useSceneStore.getState().setSetCameraState(null)
    }
  }, [])

  // ── fitToView 注册（支持可选方向参数） ──
  useEffect(() => {
    useSceneStore.getState().setFitToViewFn((direction) => {
      if (!modelObject || !orbitRef.current) return
      const dir = direction ? new THREE.Vector3(direction.x, direction.y, direction.z) : undefined
      fitToView(cameraRef.current as THREE.PerspectiveCamera, orbitRef.current, modelObject, { direction: dir })
    })
    return () => useSceneStore.getState().setFitToViewFn(null)
  }, [modelObject])

  // ── 导航插件绑定 ──
  useEffect(() => {
    if (orbitRef.current && pluginManager) {
      const navPlugin = pluginManager.getPlugin('navigation') as { setControlsRef?: (ref: React.ComponentRef<typeof OrbitControls>) => void }
      if (navPlugin?.setControlsRef) {
        navPlugin.setControlsRef(orbitRef.current)
      }
    }
  }, [pluginManager])

  // ── 相机初始化（无保存配置时默认等轴测视角） ──
  useEffect(() => {
    if (!modelObject || !orbitRef.current) return
    const cam = cameraRef.current as THREE.PerspectiveCamera
    const savedConfig = config.camera.savedConfig
    if (savedConfig) {
      cam.position.set(savedConfig.position.x, savedConfig.position.y, savedConfig.position.z)
      orbitRef.current.target.set(savedConfig.target.x, savedConfig.target.y, savedConfig.target.z)
      if (savedConfig.fov) {
        cam.fov = savedConfig.fov
        cam.updateProjectionMatrix()
      }
      orbitRef.current.update()
    } else {
      const isometricDir = new THREE.Vector3(1, 1, 1).normalize()
      fitToView(cam, orbitRef.current, modelObject, { direction: isometricDir })
    }
  }, [modelObject]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 选中对象解析（使用 useFrame 避免在 effect 中同步 setState） ──
  const prevSelectedComponentId = useRef(selectedComponentId)
  const pendingSelectedObj = useRef<THREE.Object3D | null>(null)
  useFrame(() => {
    if (prevSelectedComponentId.current !== selectedComponentId) {
      prevSelectedComponentId.current = selectedComponentId
      if (!modelObject || !selectedComponentId) {
        pendingSelectedObj.current = null
        // 在 useFrame 中更新 state（帧循环内可安全 setState）
        setSelectedObj(null)
        return
      }
      const obj = modelObject.getObjectByProperty('uuid', selectedComponentId) ?? null
      pendingSelectedObj.current = obj
      setSelectedObj(obj)
    }
  })

  // ── 选中时平滑过渡相机到构件 ──
  useEffect(() => {
    if (!selectedObj || !orbitRef.current || !modelObject) return
    // 在 effect 内消费 skipSelectionAnim，避免 setTimeout 竞态
    const store = useEditStore.getState()
    if (store.skipSelectionAnim) {
      store.setSkipSelectionAnim(false)
      return
    }
    const cam = cameraRef.current as THREE.PerspectiveCamera
    const controls = orbitRef.current
    const box = new THREE.Box3().setFromObject(selectedObj)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fovRad = cam.fov * (Math.PI / 180)
    const cameraZ = Math.abs(maxDim / (2 * Math.tan(fovRad / 2))) * 1.2
    const direction = new THREE.Vector3().subVectors(cam.position, controls.target).normalize()
    const targetPos = center.clone().add(direction.multiplyScalar(cameraZ))
    cameraAnim.current = { targetPos, targetLookAt: center, progress: 0 }
  }, [selectedObj, config.mode, modelObject])

  // ── 非 model tab 自动提升选中到 wrapper ──
  useEffect(() => {
    if (config.mode !== 'edit' || !activeTab || activeTab === 'model') return
    if (!selectedObj || !modelObject || !selectedComponentId) return
    let wrapper: THREE.Object3D | null = selectedObj
    while (wrapper && wrapper.parent !== modelObject) {
      wrapper = wrapper.parent
    }
    if (wrapper && wrapper !== modelObject && wrapper.uuid !== selectedComponentId) {
      useEditStore.getState().setSkipSelectionAnim(true)
      useEditStore.getState().selectComponent(wrapper.uuid)
      // 切换 tab 时恢复到配置的相机视角
      const savedConfig = config.camera.savedConfig
      if (savedConfig && orbitRef.current) {
        cameraAnim.current = {
          targetPos: new THREE.Vector3(savedConfig.position.x, savedConfig.position.y, savedConfig.position.z),
          targetLookAt: new THREE.Vector3(savedConfig.target.x, savedConfig.target.y, savedConfig.target.z),
          progress: 0,
        }
      }
    }
  }, [activeTab, selectedObj, modelObject, selectedComponentId, config.mode, config.camera.savedConfig])

  // ── 自动 XRay 模式 ──
  useEffect(() => {
    if (config.plugins.xray) {
      useSceneStore.getState().setXrayMode(!!selectedComponentId)
    }
  }, [selectedComponentId, config.plugins.xray])

  // ── 取消选中时平滑过渡相机 ──
  // 使用 ref 追踪上一次选中状态，仅在从有选中变为无选中时才触发动画
  // 避免页面初始加载时（selectedComponentId 始终为 null）错误触发
  const hadSelectionRef = useRef(false)
  useEffect(() => {
    const hadSelection = hadSelectionRef.current
    hadSelectionRef.current = !!selectedComponentId
    // 初始加载或组件重置时 selectedComponentId 从 undefined/null 变为 null 不应触发
    if (!hadSelection && !selectedComponentId) return
    if (selectedComponentId || !modelObject || !orbitRef.current) return
    if (useEditStore.getState().skipSelectionAnim) {
      useEditStore.getState().setSkipSelectionAnim(false)
      return
    }
    const cam = cameraRef.current as THREE.PerspectiveCamera
    const controls = orbitRef.current
    const savedConfig = config.camera.savedConfig
    if (savedConfig) {
      // 有保存的相机配置时，恢复到配置的视角
      const targetPos = new THREE.Vector3(savedConfig.position.x, savedConfig.position.y, savedConfig.position.z)
      const targetLookAt = new THREE.Vector3(savedConfig.target.x, savedConfig.target.y, savedConfig.target.z)
      cameraAnim.current = { targetPos, targetLookAt, progress: 0 }
    } else {
      // 无保存配置时，适配全模型视角
      const box = new THREE.Box3().setFromObject(modelObject)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const fovRad = cam.fov * (Math.PI / 180)
      const cameraZ = Math.abs(maxDim / (2 * Math.tan(fovRad / 2))) * 1.2
      const direction = new THREE.Vector3().subVectors(cam.position, controls.target).normalize()
      const targetPos = center.clone().add(direction.multiplyScalar(cameraZ))
      cameraAnim.current = { targetPos, targetLookAt: center, progress: 0 }
    }
  }, [selectedComponentId, modelObject, config.mode, config.camera.savedConfig])

  useFrame((_, delta) => {
    const anim = cameraAnim.current
    if (!anim) return
    anim.progress = Math.min(anim.progress + delta * 3, 1)
    const t = 1 - Math.pow(1 - anim.progress, 3)
    const cam = cameraRef.current as THREE.PerspectiveCamera
    cam.position.lerp(anim.targetPos, t * 0.15)
    if (orbitRef.current) {
      orbitRef.current.target.lerp(anim.targetLookAt, t * 0.15)
      orbitRef.current.update()
    }
    if (anim.progress >= 1) {
      // 动画结束时直接 snap 到目标位置，确保旋转中心准确
      cam.position.copy(anim.targetPos)
      if (orbitRef.current) {
        orbitRef.current.target.copy(anim.targetLookAt)
        orbitRef.current.update()
      }
      cameraAnim.current = null
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 编辑模式特有交互
  // ═══════════════════════════════════════════════════════════════

  const handleDoubleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!modelObject) return
    event.stopPropagation()

    const target = event.object
    if (target === modelObject) {
      useEditStore.getState().selectComponent(null)
      return
    }

    if (config.mode === 'view') {
      const currentId = useSceneStore.getState().selectedComponentId
      useSceneStore.getState().selectComponent(target.uuid === currentId ? null : target.uuid)
      return
    }

    const editState = useEditStore.getState()
    let targetId: string
    if (editState.activeTab === 'model') {
      targetId = target.uuid
    } else {
      let wrapper: THREE.Object3D | null = target
      while (wrapper && wrapper.parent !== modelObject) {
        wrapper = wrapper.parent
      }
      if (!wrapper || wrapper === modelObject) {
        useEditStore.getState().setSkipSelectionAnim(true)
        useEditStore.getState().selectComponent(null)
        return
      }
      targetId = wrapper.uuid
    }

    // 使用 store 最新值比较，避免闭包滞后
    const currentId = useEditStore.getState().selectedComponentId
    useEditStore.getState().setSkipSelectionAnim(true)
    if (currentId === targetId) {
      useEditStore.getState().selectComponent(null)
    } else {
      useEditStore.getState().selectComponent(targetId)
    }
  }, [config.mode, modelObject])

  // 放置模式使用 mousedown 触发，避免拖动模型后松手时误放置到错误位置
  const handlePointerDown = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (config.mode !== 'edit' || !modelObject) return
    event.stopPropagation()

    const editState = useEditStore.getState()

    if (editState.addingMarker || editState.editingMarkerId) {
      const p = event.point
      const defaultIcon = getDefaultMarkerUrl() || createDefaultMarkerImage()

      if (editState.editingMarkerId) {
        const existing = editState.markers.find((m) => m.id === editState.editingMarkerId)
        const imageUrl = existing?.imageUrl ?? defaultIcon
        useEditStore.getState().updateMarker(editState.editingMarkerId, {
          position: [p.x, p.y, p.z],
          imageUrl,
        })
        editState.setEditingMarkerId(null)
        editState.setSelectedMarkerId(null)
        editState.setIsDirty(true)
      } else {
        markerCounter++
        const id = `marker-${Date.now()}-${markerCounter}`
        useEditStore.getState().addMarker({
          id,
          position: [p.x, p.y, p.z],
          name: `标点 ${markerCounter}`,
          imageUrl: defaultIcon,
          width: 1,
          height: 1,
          action: 'popup',
        })
        editState.setAddingMarker(false)
        editState.setIsDirty(true)
      }
      return
    }

    if (editState.placingImageId) {
      const p = event.point
      useEditStore.getState().updateSceneImage(editState.placingImageId, {
        position: [p.x, p.y, p.z],
      })
      editState.setPlacingImageId(null)
      editState.setIsDirty(true)
    }
  }, [config.mode, modelObject])

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (config.mode !== 'edit' || !modelObject) return
    event.stopPropagation()

    const editState = useEditStore.getState()

    if (editState.transformMode && event.object !== modelObject) {
      const target = event.object
      let targetId: string
      if (editState.activeTab === 'model') {
        targetId = target.uuid
      } else {
        let wrapper: THREE.Object3D | null = target
        while (wrapper && wrapper.parent !== modelObject) wrapper = wrapper.parent
        if (!wrapper || wrapper === modelObject) return
        targetId = wrapper.uuid
      }
      useEditStore.getState().selectComponent(targetId)
    }
  }, [config.mode, modelObject])

  // ── 鼠标样式 ──
  useFrame(() => {
    if (config.mode !== 'edit') return
    const editState = useEditStore.getState()
    const inPlacement = editState.addingMarker || editState.editingMarkerId || editState.placingImageId
    const gl = glRef.current
    gl.domElement.style.cursor = inPlacement ? 'crosshair' : 'default'
  })


  // ═══════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════

  return (
    <>
      <SceneBackground config={config.background} />

      {/* 灯光 */}
      <ambientLight ref={ambientLightRef} intensity={ambientIntensity} color={lightColor} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={LIGHT_DEFAULTS.mainDirectional * lightIntensity}
        color={lightColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <directionalLight
        position={[-30, 20, -30]}
        intensity={LIGHT_DEFAULTS.fillDirectional * lightIntensity}
        color={lightColor}
      />
      <directionalLight
        position={[10, -15, -10]}
        intensity={LIGHT_DEFAULTS.bottomDirectional * lightIntensity}
        color={lightColor}
      />
      <hemisphereLight intensity={LIGHT_DEFAULTS.hemisphereIntensity * lightIntensity} color={lightColor} />

      {/* OrbitControls */}
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.15}
        makeDefault
        autoRotate={config.plugins.autoRotate.enabled && config.plugins.autoRotate.axis === 'y'}
        autoRotateSpeed={config.plugins.autoRotate.speed}
      />

      {/* 阴影地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.15} />
      </mesh>

      {/* 模型 */}
      {modelObject && (
        <group ref={modelGroupRef}>
          <primitive
            key={sceneVersion}
            object={modelObject}
            onPointerDown={config.mode === 'edit' ? handlePointerDown : undefined}
            onClick={config.mode === 'edit' ? handleClick : undefined}
            onDoubleClick={handleDoubleClick}
          />
        </group>
      )}

      {/* 插件 3D 内容 */}
      {pluginManager && (
        <PluginScene
          pluginManager={pluginManager}
          modelGroupRef={modelGroupRef}
          orbitRef={orbitRef}
        />
      )}

      {/* 标记 */}
      {modelObject && markers.map((marker) => (
        <MarkerSpriteShared key={marker.id} marker={marker} onClick={config.mode === 'view' ? (id) => {
          const m = markers.find((mk) => mk.id === id)
          if (m) {
            getMessageBus().send(MESSAGE_TYPES.MARKER_CLICKED, {
              id: m.id,
              name: m.name,
              position: m.position,
              action: m.action,
              popup: m.popup,
              linkUrl: m.linkUrl,
            })
          }
        } : undefined} />
      ))}

      {/* 场景图像 */}
      {modelObject && sceneImages.map((media) => (
        <SceneImageSprite key={media.id} image={media} onClick={(id) => {
          if (config.mode === 'edit') {
            const store = useEditStore.getState()
            store.setPlacingImageId(null)
            store.setSelectedImageId(store.selectedImageId === id ? null : id)
          } else {
            getMessageBus().send(MESSAGE_TYPES.MEDIA_CLICKED, {
              id: media.id,
              type: media.type,
              name: media.name,
              url: 'url' in media ? media.url : undefined,
              text: 'text' in media ? media.text : undefined,
            })
          }
        }} />
      ))}
    </>
  )
}
