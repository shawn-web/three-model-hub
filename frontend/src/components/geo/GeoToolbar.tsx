/**
 * Geo 页面底部工具栏
 * 地图厂商切换、底图类型切换、视角控制、保存
 */
import { useState } from 'react'
import {
  GlobalOutlined,
  SaveOutlined,
  CompassOutlined,
  ExpandOutlined,
  SwapOutlined,
  AimOutlined,
  EyeOutlined,
  StopOutlined,
  PushpinOutlined,
} from '@ant-design/icons'
import { Button, Space, Tooltip, Input, Modal, Divider, message } from 'antd'
import { useGeoStore } from '../../store/geo-store'
import { focusGeoModel } from '../../utils/geo-focus'
import { getImageryProviderList } from '../../utils/imagery-providers'

import { getCs } from '../../utils/cesium-instance'

interface GeoToolbarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any
}

export function GeoToolbar({ viewer }: GeoToolbarProps) {
  const {
    mapData,
    selectedModelId,
    models,
    isLoading,
    saveAndNotify,
    saveViewpoint,
    clearViewpoint,
    setImageryType,
    setImageryProvider,
    addingMarker,
    setAddingMarker,
  } = useGeoStore()

  // 底图配置：运行时覆盖优先（postMessage 设置）
  const imageryType = useGeoStore(
    (s) => s.runtimeOverrides?.imageryType ?? s.imageryType,
  )
  const imageryProvider = useGeoStore(
    (s) => s.runtimeOverrides?.imageryProvider ?? s.imageryProvider,
  )

  const hiddenTools = useGeoStore((s) => s.hiddenTools)

  const [flyModalOpen, setFlyModalOpen] = useState(false)
  const [flyLng, setFlyLng] = useState('')
  const [flyLat, setFlyLat] = useState('')

  // 底图类型切换（用户主动操作 → 清除运行时覆盖，设置持久值）
  const toggleImageryType = () => {
    useGeoStore.setState({ runtimeOverrides: null })
    const types = ['satellite', 'vector', 'terrain'] as const
    const currentIndex = types.indexOf(imageryType as typeof types[number])
    const nextType = types[(currentIndex + 1) % types.length]
    setImageryType(nextType)
  }

  // 地图厂商切换（用户主动操作 → 清除运行时覆盖，设置持久值）
  const toggleProvider = () => {
    const providers = getImageryProviderList()
    const currentIndex = providers.findIndex((p) => p.id === imageryProvider)
    const nextIndex = (currentIndex + 1) % providers.length
    useGeoStore.setState({ runtimeOverrides: null })
    setImageryProvider(providers[nextIndex].id)
  }

  const currentProvider = getImageryProviderList().find((p) => p.id === imageryProvider)

  // 飞到选中模型位置（直接飞到模型附近，不缩小地图）
  const handleFlyToModel = () => {
    focusGeoModel(viewer, selectedModelId, models)
  }

  // 飞行到指定坐标
  const handleFlyTo = () => {
    if (!viewer) return
    const lng = parseFloat(flyLng)
    const lat = parseFloat(flyLat)
    if (isNaN(lng) || isNaN(lat)) return
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return

    viewer.camera.flyTo({
      destination: getCs().Cartesian3.fromDegrees(lng, lat, 1000),
      duration: 2,
    })
    setFlyModalOpen(false)
  }

  // 重置视角：使用 BoundingSphere 自动计算最佳观察距离，确保所有模型可见
  const handleResetView = () => {
    if (!viewer) return
    const C = getCs()
    const { mapData: sd, models: allModels } = useGeoStore.getState()
    const geoConfig = sd?.config?.geo

    const positions = allModels
      .map((m) => m.geo_position)
      .filter((g): g is NonNullable<typeof g> => g !== null)

    if (positions.length > 0) {
      const points = positions.map((g) =>
        C.Cartesian3.fromDegrees(g.longitude, g.latitude, g.altitude),
      )
      const boundingSphere = C.BoundingSphere.fromPoints(points)

      // 如果配置了 origin，以 origin 为包围球中心
      const origin = geoConfig?.origin
      if (origin) {
        boundingSphere.center = C.Cartesian3.fromDegrees(
          origin.longitude,
          origin.latitude,
          origin.altitude,
        )
      }

      viewer.camera.flyToBoundingSphere(boundingSphere, {
        offset: new C.HeadingPitchRange(
          C.Math.toRadians(0),
          C.Math.toRadians(-90),     // 正俯视，缩小时地球保持在屏幕中心
        ),
        duration: 1.5,
      })
      return
    }

    // 无模型但有 origin → 飞到 origin
    const origin = geoConfig?.origin
    if (origin) {
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(
          origin.longitude,
          origin.latitude,
          origin.altitude + 200,
        ),
        orientation: {
          heading: C.Math.toRadians(0),
          pitch: C.Math.toRadians(-90),
          roll: 0,
        },
        duration: 1.5,
      })
    }
  }

  // 保存当前视角（相机位置 + 朝向持久化到 scene_config）
  const handleSaveViewpoint = async () => {
    if (!viewer) return
    const C = getCs()
    const cam = viewer.camera
    const pos = cam.positionCartographic
    const viewpoint = {
      longitude: C.Math.toDegrees(pos.longitude),
      latitude: C.Math.toDegrees(pos.latitude),
      altitude: pos.height,
      heading: cam.heading,
      pitch: cam.pitch,
      roll: cam.roll,
    }
    try {
      await saveViewpoint(viewpoint)
      message.success('视角已保存')
    } catch {
      message.error('视角保存失败')
    }
  }

  // 清除保存的视角（恢复自动计算模式）
  const handleClearViewpoint = async () => {
    try {
      await clearViewpoint()
      message.success('已清除保存的视角，将使用自动计算')
    } catch {
      message.error('清除失败')
    }
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.75)',
          borderRadius: 8,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Space size={4}>
          {/* 飞到模型位置 */}
          {!hiddenTools.has('focusModel') && !hiddenTools.has('flyToModel') && (
            <Tooltip title="飞到选中模型位置">
              <Button
                type="text"
                size="small"
                icon={<AimOutlined style={{ color: selectedModelId ? '#52c41a' : '#666' }} />}
                onClick={handleFlyToModel}
                disabled={!selectedModelId}
                style={{ color: '#fff' }}
              >
                回到模型
              </Button>
            </Tooltip>
          )}

          <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />

          {/* 地图厂商切换 */}
          <Tooltip title={`切换地图厂商（当前：${currentProvider?.name}）`}>
            <Button
              type="text"
              size="small"
              icon={<SwapOutlined style={{ color: '#faad14' }} />}
              onClick={toggleProvider}
              style={{ color: '#fff' }}
            >
              {currentProvider?.name}
            </Button>
          </Tooltip>

          {/* 底图类型切换 */}
          <Tooltip title={`切换底图类型（当前：${imageryType === 'satellite' ? '影像' : imageryType === 'vector' ? '矢量' : '地形'}）`}>
            <Button
              type="text"
              size="small"
              icon={<GlobalOutlined style={{ color: imageryType === 'satellite' ? '#52c41a' : imageryType === 'vector' ? '#1890ff' : '#faad14' }} />}
              onClick={toggleImageryType}
              style={{ color: '#fff' }}
            >
              {imageryType === 'satellite' ? '影像' : imageryType === 'vector' ? '矢量' : '地形'}
            </Button>
          </Tooltip>

          <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />

          <Tooltip title="飞行定位">
            <Button
              type="text"
              size="small"
              icon={<CompassOutlined />}
              onClick={() => setFlyModalOpen(true)}
              style={{ color: '#fff' }}
            >
              定位
            </Button>
          </Tooltip>

          <Tooltip title="重置视角（显示所有模型）">
            <Button
              type="text"
              size="small"
              icon={<ExpandOutlined />}
              onClick={handleResetView}
              style={{ color: '#fff' }}
            >
              重置
            </Button>
          </Tooltip>

          <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />

          {/* 保存/清除视角 */}
          {mapData?.config?.geo?.viewpoint ? (
            <Tooltip title="已保存视角（点击清除，恢复自动计算）">
              <Button
                type="text"
                size="small"
                icon={<StopOutlined style={{ color: '#ff4d4f' }} />}
                onClick={handleClearViewpoint}
                style={{ color: '#fff' }}
              >
                清除视角
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip title={mapData?.config?.geo?.viewpoint ? '更新保存的视角' : '保存当前视角（下次加载自动恢复）'}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: mapData?.config?.geo?.viewpoint ? '#52c41a' : '#999' }} />}
              onClick={handleSaveViewpoint}
              style={{ color: '#fff' }}
            >
              保存视角
            </Button>
          </Tooltip>

          <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />

          {/* 添加标点 */}
          <Tooltip title={addingMarker ? '取消添加标点' : '添加地图标点'}>
            <Button
              type="text"
              size="small"
              icon={<PushpinOutlined style={{ color: addingMarker ? '#ff4d4f' : '#faad14' }} />}
              onClick={() => setAddingMarker(!addingMarker)}
              style={{ color: '#fff' }}
            >
              标点
            </Button>
          </Tooltip>

          <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />

          <Tooltip title="保存地理坐标">
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              onClick={saveAndNotify}
              loading={isLoading}
            >
              保存
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* 飞行定位弹窗 */}
      <Modal
        title="飞行定位"
        open={flyModalOpen}
        onOk={handleFlyTo}
        onCancel={() => setFlyModalOpen(false)}
        okText="飞行"
        cancelText="取消"
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>经度</label>
            <Input
              placeholder="例如：116.397"
              value={flyLng}
              onChange={(e) => setFlyLng(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>纬度</label>
            <Input
              placeholder="例如：39.916"
              value={flyLat}
              onChange={(e) => setFlyLat(e.target.value)}
            />
          </div>
        </Space>
      </Modal>
    </>
  )
}
