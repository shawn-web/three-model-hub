/**
 * 模型图层组件
 * 将地图中带有 geo_position 的模型加载为 Cesium Entity
 * Cesium 通过 index.html 全局加载
 *
 * 修复：加载前预处理 GLB，移除法线贴图引用，绕过 Cesium PBR shader 编译 bug
 * （Cesium 渲染有法线贴图但无切线数据的 GLB 时会触发 'normalTexCoords' 未声明错误）
 */
import { useEffect, useRef } from 'react'
import { useGeoStore } from '../../store/geo-store'
import { getEffectiveGeo } from '../../store/geo-store'
import { removeNormalTexturesFromGlb } from '../../utils/glb-normal-fix'

import { getCs } from '../../utils/cesium-instance'

/** 并发加载数（Cesium 同源连接数限制，3 为经验安全值） */
const MODEL_LOAD_CONCURRENCY = 3
/** 模型加载超时（ms），超过后强制移除 loading 状态避免无限转圈 */
const MODEL_READY_TIMEOUT_MS = 30_000

interface GeoModelLayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any
}

export function GeoModelLayer({ viewer }: GeoModelLayerProps) {
  const { models, selectedModelId, setModelLoading, setModelLoaded } = useGeoStore()
  const visibleFilter = useGeoStore((s) => s.visibleFilter)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entitiesRef = useRef<Map<string, any>>(new Map())
  /** 追踪已创建的 Blob URL，用于组件卸载或实体删除时释放 */
  const blobUrlsRef = useRef<Map<string, string>>(new Map())
  /** 全局唯一的 postRender 监听器引用，所有待加载的实体共用同一个监听器 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postRenderListenerRef = useRef<((() => void) | null)>(null)
  /** 待检测 ready 的模型：Map<modelId, entity>，用 string key 避免 Set object identity 问题 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingReadyRef = useRef<Map<string, any>>(new Map())
  /** 超时定时器 ID 集合，effect 清理时批量清除 */
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // 加载/更新模型实体
  useEffect(() => {
    if (!viewer || !models) return

    const C = getCs()
    const visibleModelSet = visibleFilter ? new Set(visibleFilter) : null
    const renderModels = models.filter((m) => m.visible !== false && (!visibleModelSet || visibleModelSet.has(m.id)))

    // 获取当前所有 entity 的 ID
    const currentIds = new Set(entitiesRef.current.keys())
    const newIds = new Set(renderModels.map((m) => m.id))

    // 删除已不存在的实体，并释放对应的 Blob URL
    currentIds.forEach((id) => {
      if (!newIds.has(id)) {
        const entity = entitiesRef.current.get(id)
        if (entity) {
          viewer.entities.remove(entity)
          entitiesRef.current.delete(id)
        }
        // 释放该模型关联的 Blob URL
        const blobUrl = blobUrlsRef.current.get(id)
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
          blobUrlsRef.current.delete(id)
        }
      }
    })

    // 异步加载/更新模型
    let cancelled = false

    async function loadModels() {
      // 获取当前正在拖拽的模型 ID（拖拽期间跳过该实体的位置更新）
      const { draggingModelId } = useGeoStore.getState()

      // 第一遍：同步更新所有已有实体的位置和朝向（避免 async 期间被 cancel 导致位置回退）
      const newEntities: typeof renderModels[number][] = []
      console.log(`[GeoModelLayer] loadModels 开始，模型数=${renderModels.length}, 已有实体数=${entitiesRef.current.size}`)
      for (const model of renderModels) {
        if (cancelled) return

        // _pendingGeo 为 undefined 表示无编辑，为 null 表示已清除
        const geo = getEffectiveGeo(model)

        if (!geo) {
          // geo 为 null 时移除已有实体，并释放 Blob URL
          const existing = entitiesRef.current.get(model.id)
          if (existing) {
            viewer.entities.remove(existing)
            entitiesRef.current.delete(model.id)
          }
          const blobUrl = blobUrlsRef.current.get(model.id)
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl)
            blobUrlsRef.current.delete(model.id)
          }
          continue
        }

        const existingEntity = entitiesRef.current.get(model.id)

        if (existingEntity) {
          // 拖拽中的模型跳过位置更新（由 CesiumViewer 直接控制）
          if (model.id === draggingModelId) continue

          // 同步更新已有实体的位置和朝向
          const position = C.Cartesian3.fromDegrees(
            geo.longitude,
            geo.latitude,
            geo.altitude,
          )
          existingEntity.position = new C.ConstantPositionProperty(position)
          existingEntity.orientation = new C.ConstantProperty(
            C.Transforms.headingPitchRollQuaternion(
              position,
              new C.HeadingPitchRoll(
                C.Math.toRadians(geo.heading || 0),
                C.Math.toRadians(geo.pitch || 0),
                C.Math.toRadians(geo.roll || 0),
              ),
            ),
          )
          if (existingEntity.model) {
            const newScale = geo.scale ?? 1
            existingEntity.model.scale = newScale

            // 同时直接更新底层 Model primitive 的缩放（绕过 Entity API 可能的同步延迟）
            const primitives = viewer.scene.primitives
            for (let i = 0; i < primitives.length; i++) {
              const p = primitives.get(i)
              if (p.id === existingEntity && p.ready) {
                p.scale = newScale
                break
              }
            }
          }
        } else {
          // 需要新建实体的模型，稍后异步处理
          console.log(`[GeoModelLayer] 标记为待创建: ${model.modelName} (${model.model_id}), geo=(${geo.longitude.toFixed(6)}, ${geo.latitude.toFixed(6)}), downloadUrl="${model.downloadUrl ? model.downloadUrl.substring(0, 60) : '(空)'}"`)
          newEntities.push(model)
        }
      }

      // 第二遍：异步创建尚无实体的模型（GLB 预处理 + 并发限流）
      const pendingReady = pendingReadyRef.current

      // postRender 监听器：每次 effect 重新注册（因为 pendingReady/cancelled 闭包需要最新值）
      const onPostRender = () => {
        if (cancelled) {
          viewer.scene.postRender.removeEventListener(onPostRender)
          postRenderListenerRef.current = null
          return
        }
        const primitives = viewer.scene.primitives
        const toRemove: string[] = []
        for (const [modelId, entity] of pendingReady) {
          for (let i = 0; i < primitives.length; i++) {
            const p = primitives.get(i)
            if (p.id === entity && p.ready) {
              setModelLoaded(modelId)
              toRemove.push(modelId)
              break
            }
          }
        }
        for (const id of toRemove) pendingReady.delete(id)
        if (pendingReady.size === 0) {
          viewer.scene.postRender.removeEventListener(onPostRender)
          postRenderListenerRef.current = null
        }
      }

      // 清理旧监听器（effect 重新运行时旧监听器持有 stale cancelled）
      if (postRenderListenerRef.current) {
        viewer.scene.postRender.removeEventListener(postRenderListenerRef.current)
      }
      postRenderListenerRef.current = onPostRender
      // 立即注册监听器（Cesium Event.addEventListener 对同一函数引用不会重复添加）
      viewer.scene.postRender.addEventListener(onPostRender)

      // 简单的「并发限流」：按 CONCURRENCY 切片并行处理
      for (let i = 0; i < newEntities.length; i += MODEL_LOAD_CONCURRENCY) {
        if (cancelled) return
        const batch = newEntities.slice(i, i + MODEL_LOAD_CONCURRENCY)
        await Promise.allSettled(batch.map(async (model) => {
          try {
            const geo = getEffectiveGeo(model)
            if (!geo) {
              console.warn(`[GeoModelLayer] 模型 geo 为空，跳过: ${model.modelName} (${model.model_id})`)
              return
            }
            // 检查模型文件 URL 是否有效（空字符串会导致 Cesium 加载当前页面 HTML）
            if (!model.downloadUrl) {
              console.warn(`[GeoModelLayer] 模型 downloadUrl 为空，跳过: ${model.modelName} (${model.model_id})`)
              return
            }

            console.log(`[GeoModelLayer] 加载模型: ${model.modelName}, model_id=${model.model_id}, downloadUrl=${model.downloadUrl}`)
            setModelLoading(model.id)
            const modelUri = await removeNormalTexturesFromGlb(
              model.model_id,
              model.downloadUrl,
              (percent) => {
                console.log(`[GeoModelLayer] 下载进度 ${model.modelName}: ${percent}%`)
              },
            )
            if (!modelUri) {
              setModelLoaded(model.id)
              console.warn(`[GeoModelLayer] 模型文件不可用，跳过: ${model.modelName} (${model.model_id})`)
              return
            }
            // Blob URL 需要记录以便后续释放
            if (modelUri.startsWith('blob:')) {
              blobUrlsRef.current.set(model.id, modelUri)
            }

            if (cancelled) {
              if (modelUri.startsWith('blob:')) {
                URL.revokeObjectURL(modelUri)
                blobUrlsRef.current.delete(model.id)
              }
              return
            }

            // 再次检查是否已有实体（可能在 await 期间被其他流程创建）
            if (entitiesRef.current.has(model.id)) {
              console.log(`[GeoModelLayer] 模型实体已存在，跳过: ${model.modelName} (${model.model_id})`)
              setModelLoaded(model.id)
              return
            }

            // await 之后重新读取最新的 geo
            const latest = useGeoStore.getState().models.find((m) => m.id === model.id)
            const latestGeo = latest ? getEffectiveGeo(latest) : geo
            if (!latestGeo) {
              setModelLoaded(model.id)
              return
            }

            const position = C.Cartesian3.fromDegrees(
              latestGeo.longitude,
              latestGeo.latitude,
              latestGeo.altitude,
            )

            const headingPitchRoll = new C.HeadingPitchRoll(
              C.Math.toRadians(latestGeo.heading || 0),
              C.Math.toRadians(latestGeo.pitch || 0),
              C.Math.toRadians(latestGeo.roll || 0),
            )

            const entity = viewer.entities.add({
              id: `model-${model.id}`,
              name: model.display_name || model.modelName || '未命名模型',
              position: new C.ConstantPositionProperty(position),
              orientation: new C.ConstantProperty(
                C.Transforms.headingPitchRollQuaternion(position, headingPitchRoll),
              ),
              model: {
                uri: modelUri,
                scale: latestGeo.scale || 1,
                minimumPixelSize: 64,
                clampAnimations: false,
              },
              properties: {
                sceneModelId: model.id,
              },
            })

            entitiesRef.current.set(model.id, entity)
            pendingReady.set(model.id, entity)

            // 30s 超时保底
            const timerId = setTimeout(() => {
              timeoutIdsRef.current.delete(timerId)
              if (pendingReady.has(model.id)) {
                pendingReady.delete(model.id)
                setModelLoaded(model.id)
              }
            }, MODEL_READY_TIMEOUT_MS)
            timeoutIdsRef.current.add(timerId)
          } catch (err) {
            // removeNormalTexturesFromGlb 或 entity 创建抛异常时确保 loading 状态被清理
            console.error(`[GeoModelLayer] 模型加载异常: ${model.modelName}`, err)
            setModelLoaded(model.id)
          }
        }))
      }
    }

    loadModels()

    return () => {
      cancelled = true
      // 清理超时定时器
      timeoutIdsRef.current.forEach((id) => clearTimeout(id))
      timeoutIdsRef.current.clear()
    }
  }, [viewer, models, visibleFilter, setModelLoading, setModelLoaded])

  // 组件卸载时：清理实体 + 释放 Blob URL + 移除 postRender 监听
  useEffect(() => {
    const entitiesMap = entitiesRef.current
    const blobUrlsMap = blobUrlsRef.current
    return () => {
      // 安全检查：viewer 可能已被 CesiumViewer 卸载时 destroy
      if (viewer && !viewer.isDestroyed?.()) {
        // 移除 postRender 监听器
        if (postRenderListenerRef.current) {
          viewer.scene.postRender.removeEventListener(postRenderListenerRef.current)
          postRenderListenerRef.current = null
        }
        entitiesMap.forEach((entity) => {
          try { viewer.entities.remove(entity) } catch { /* 忽略 */ }
        })
        entitiesMap.clear()
      }
      // 释放所有 Blob URL
      blobUrlsMap.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      blobUrlsMap.clear()
      // 清理 pending 和 timer
      pendingReadyRef.current.clear()
      timeoutIdsRef.current.forEach((id) => clearTimeout(id))
      timeoutIdsRef.current.clear()
      // 清理残留的 loading 状态（模型在 await 期间组件卸载时 setModelLoaded 不会被调用）
      useGeoStore.getState().loadingModelIds.forEach((id) => {
        useGeoStore.getState().setModelLoaded(id)
      })
    }
  }, [viewer])

  // 选中高亮效果：MIX 模式轻微着色，未选中时移除着色恢复原始外观
  useEffect(() => {
    if (!viewer) return

    const C = getCs()
    entitiesRef.current.forEach((entity, id) => {
      if (!entity.model) return
      const isSelected = id === selectedModelId
      if (isSelected) {
        // 选中：使用 MIX 模式轻微着色，保留模型原始纹理
        entity.model.color = new C.ConstantProperty(
          new C.Color(0.3, 0.6, 1.0, 1.0), // 淡蓝色高亮
        )
        entity.model.colorBlendMode = new C.ConstantProperty(C.ColorBlendMode.MIX)
        entity.model.colorBlendAmount = new C.ConstantProperty(0.25)
      } else {
        // 未选中：移除颜色属性，恢复模型原始颜色
        entity.model.color = undefined as undefined
        entity.model.colorBlendMode = undefined as undefined
        entity.model.colorBlendAmount = undefined as undefined
      }
    })
  }, [viewer, selectedModelId])

  return null
}
