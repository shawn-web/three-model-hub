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
import { SceneBackground } from './SceneBackground'
import { SceneImageSprite } from './SceneImageSprite'
import { MarkerSpriteShared } from './MarkerSpriteShared'
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
  const markers = useSceneStore((s) => s.markers)
  const sceneImages = useSceneStore((s) => s.sceneImages)

  // ── 编辑模式特有状态（hooks 必须无条件调用） ──
  const editAddingMarker = useEditStore((s) => s.addingMarker)
  const editEditingMarkerId = useEditStore((s) => s.editingMarkerId)
  const editSelectedMarkerId = useEditStore((s) => s.selectedMarkerId)
  const editPlacingImageId = useEditStore((s) => s.placingImageId)
  // 根据模式选择实际使用的值（hooks 必须无条件调用，故先调用再选择）
  const addingMarker = config.mode === 'edit' ? editAddingMarker : false
  const editingMarkerId = config.mode === 'edit' ? editEditingMarkerId : null
  const _selectedMarkerId = config.mode === 'edit' ? editSelectedMarkerId : null
  const _placingImageId = config.mode === 'edit' ? editPlacingImageId : null
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

  // ── fitToView 注册 ──
  useEffect(() => {
    useSceneStore.getState().setFitToViewFn(() => {
      if (!modelObject || !orbitRef.current) return
      fitToView(cameraRef.current as THREE.PerspectiveCamera, orbitRef.current, modelObject)
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

  // ── 相机初始化 ──
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
      fitToView(cam, orbitRef.current, modelObject)
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
    if (config.mode !== 'edit') return
    if (!selectedObj || !orbitRef.current || !modelObject) return
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
    if (!selectedObj || !modelObject) return
    let wrapper: THREE.Object3D | null = selectedObj
    while (wrapper && wrapper.parent !== modelObject) {
      wrapper = wrapper.parent
    }
    if (wrapper && wrapper !== modelObject && wrapper.uuid !== selectedComponentId) {
      useSceneStore.getState().selectComponent(wrapper.uuid)
    }
  }, [activeTab, selectedObj, modelObject, selectedComponentId, config.mode])

  // ── 自动 XRay 模式 ──
  useEffect(() => {
    if (config.plugins.xray) {
      useSceneStore.getState().setXrayMode(!!selectedComponentId)
    }
  }, [selectedComponentId, config.plugins.xray])

  // ── 取消选中时平滑过渡相机 ──
  useEffect(() => {
    if (selectedComponentId || !modelObject || !orbitRef.current) return
    const cam = cameraRef.current as THREE.PerspectiveCamera
    const controls = orbitRef.current
    const box = new THREE.Box3().setFromObject(modelObject)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fovRad = cam.fov * (Math.PI / 180)
    const cameraZ = Math.abs(maxDim / (2 * Math.tan(fovRad / 2))) * 1.2
    const direction = new THREE.Vector3().subVectors(cam.position, controls.target).normalize()
    const targetPos = center.clone().add(direction.multiplyScalar(cameraZ))
    cameraAnim.current = { targetPos, targetLookAt: center, progress: 0 }
  }, [selectedComponentId, modelObject])

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
    if (config.mode !== 'edit' || !modelObject) return
    event.stopPropagation()

    const target = event.object
    if (target === modelObject) {
      useEditStore.getState().selectComponent(null)
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
        useEditStore.getState().selectComponent(null)
        return
      }
      targetId = wrapper.uuid
    }

    if (selectedComponentId === targetId) {
      useEditStore.getState().selectComponent(null)
    } else {
      useEditStore.getState().selectComponent(targetId)
    }
  }, [config.mode, modelObject, selectedComponentId])

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (config.mode !== 'edit' || !modelObject) return
    event.stopPropagation()

    const editState = useEditStore.getState()

    // 标记放置模式
    if (editState.addingMarker || editState.editingMarkerId) {
      const p = event.point
      const defaultIcon = localStorage.getItem('markerDefaultIcon') ||
        'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="red"/></svg>')

      if (editState.editingMarkerId) {
        const existing = editState.markers.find((m) => m.id === editState.editingMarkerId)
        const iconUrl = existing?.iconUrl ?? defaultIcon
        useSceneStore.getState().updateMarker(editState.editingMarkerId, {
          position: { x: p.x, y: p.y, z: p.z },
          iconUrl,
        } as Parameters<ReturnType<typeof useSceneStore.getState>['updateMarker']>[1])
        editState.setEditingMarkerId(null)
        editState.setSelectedMarkerId(null)
        editState.setIsDirty(true)
      } else {
        markerCounter++
        const id = `marker-${Date.now()}-${markerCounter}`
        useSceneStore.getState().addMarker({
          id,
          position: { x: p.x, y: p.y, z: p.z },
          name: `标点 ${markerCounter}`,
          iconUrl: defaultIcon,
          action: 'popup',
        } as Parameters<ReturnType<typeof useSceneStore.getState>['addMarker']>[0])
        editState.setAddingMarker(false)
        editState.setIsDirty(true)
      }
      return
    }

    // 图像放置模式
    if (editState.placingImageId) {
      const p = event.point
      useSceneStore.getState().updateSceneImage(editState.placingImageId, {
        position: { x: p.x, y: p.y, z: p.z },
      } as Parameters<ReturnType<typeof useSceneStore.getState>['updateSceneImage']>[1])
      editState.setPlacingImageId(null)
      editState.setIsDirty(true)
      return
    }

    // 变换模式选择
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

  // ── 键盘快捷键 (仅编辑模式) ──
  useEffect(() => {
    if (config.mode !== 'edit') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const tm = useEditStore.getState().transformMode
      switch (e.key.toLowerCase()) {
        case 'w': useEditStore.getState().setTransformMode(tm === 'translate' ? null : 'translate'); break
        case 'e': useEditStore.getState().setTransformMode(tm === 'rotate' ? null : 'rotate'); break
        case 'r': useEditStore.getState().setTransformMode(tm === 'scale' ? null : 'scale'); break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [config.mode])

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
            object={modelObject}
            onClick={config.mode === 'edit' ? handleClick : undefined}
            onDoubleClick={config.mode === 'edit' ? handleDoubleClick : undefined}
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
        <MarkerSpriteShared key={marker.id} marker={marker} />
      ))}

      {/* 场景图像 */}
      {modelObject && sceneImages.map((media) => (
        <SceneImageSprite key={media.id} image={media} />
      ))}
    </>
  )
}
