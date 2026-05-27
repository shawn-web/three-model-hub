import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { crosshairIcon } from './Icons'
import { useSceneStore } from '../store/scene-store'

/**
 * 相机信息卡片
 * 实时显示相机位置、目标点、FOV 等信息
 * 编辑模式和预览模式共用，数据统一从 scene-store 读取
 */
export function CameraInfo() {
  const cameraInfoVisible = useSceneStore((s) => s.cameraInfoVisible)
  const [cameraData, setCameraData] = useState<{
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov: number
    zoom: number
    distance: number
    azimuth: number
    polar: number
  } | null>(null)

  useEffect(() => {
    if (!cameraInfoVisible) return

    const timer = setInterval(() => {
      const getCameraState = useSceneStore.getState().getCameraState
      if (getCameraState) {
        const cam = getCameraState()
        const pos = cam.position
        const target = cam.target
        const dx = pos.x - target.x
        const dy = pos.y - target.y
        const dz = pos.z - target.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        // 数据异常时不更新（如模型刚加载时相机未就绪）
        if (!isFinite(distance)) return
        // 水平方位角
        const azimuth = Math.atan2(dx, dz) * (180 / Math.PI)
        // 极角（仰角）
        const polar = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI)
        setCameraData({
          position: pos,
          target,
          fov: cam.fov,
          zoom: 1,
          distance,
          azimuth,
          polar,
        })
      }
    }, 200)

    return () => clearInterval(timer)
  }, [cameraInfoVisible])

  if (!cameraInfoVisible || !cameraData) return null

  const fmt = (v: number) => isFinite(v) ? v.toFixed(2) : '---'

  return (
    <div style={{
      position: 'absolute',
      bottom: 52,
      right: 12,
      zIndex: 50,
      width: 220,
      background: 'rgba(20, 20, 30, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: 10,
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 600,
        color: '#ddd',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Icon icon={crosshairIcon} width={14} height={14} style={{ color: '#4a9eff' }} />
        视角信息
      </div>

      {/* 数据内容 */}
      <div style={{ padding: '8px 12px', fontSize: 11, color: '#bbb', lineHeight: 1.8 }}>
        <InfoRow label="位置 X" value={fmt(cameraData.position.x)} color="#ff6b6b" />
        <InfoRow label="位置 Y" value={fmt(cameraData.position.y)} color="#51cf66" />
        <InfoRow label="位置 Z" value={fmt(cameraData.position.z)} color="#4a9eff" />
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
        <InfoRow label="目标 X" value={fmt(cameraData.target.x)} />
        <InfoRow label="目标 Y" value={fmt(cameraData.target.y)} />
        <InfoRow label="目标 Z" value={fmt(cameraData.target.z)} />
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
        <InfoRow label="距离" value={fmt(cameraData.distance)} />
        <InfoRow label="方位角" value={fmt(cameraData.azimuth) + '°'} />
        <InfoRow label="仰角" value={fmt(cameraData.polar) + '°'} />
        <InfoRow label="视场角" value={fmt(cameraData.fov) + '°'} />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: color || '#ddd', fontFamily: 'monospace', fontSize: 11 }}>{value}</span>
    </div>
  )
}
