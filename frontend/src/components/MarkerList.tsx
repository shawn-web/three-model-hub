import { useCallback } from 'react'
import { Button, message, Upload, Popconfirm, theme as antdTheme } from 'antd'
import { Icon } from '@iconify/react'
import { uploadIcon, undo2Icon, moveIcon, settingsIcon, trash2Icon, mapPinIcon } from './Icons'
import { useEditStore } from '../store/edit-store'
import { uploadFile } from '../api/upload'
import { useDefaultMarkerUrl } from '../hooks/useDefaultMarkerUrl'
import { createDefaultMarkerImage } from '../utils/default-marker-image'
import type { MarkerData } from '../types/edit-data'

/** 标点列表组件：显示所有标点，支持配置、重定位和删除 */
export function MarkerList({ onEditMarker }: { onEditMarker: (marker: MarkerData) => void }) {
  const markers = useEditStore((s) => s.markers)
  const removeMarker = useEditStore((s) => s.removeMarker)
  const setAddingMarker = useEditStore((s) => s.setAddingMarker)
  const addingMarker = useEditStore((s) => s.addingMarker)
  const selectedMarkerId = useEditStore((s) => s.selectedMarkerId)
  const setSelectedMarkerId = useEditStore((s) => s.setSelectedMarkerId)
  const setEditingMarkerId = useEditStore((s) => s.setEditingMarkerId)
  const { customDefault, setDefault, resetDefault } = useDefaultMarkerUrl()
  const { token } = antdTheme.useToken()

  const actionLabel: Record<string, string> = { popup: '弹窗', iframe: 'iframe', link: '链接', none: '' }

  const handleUploadDefault = useCallback(async (file: File) => {
    try {
      const result = await uploadFile(file, { bizType: 'marker-icon' })
      setDefault(result.url)
      message.success('默认标点图标已更新')
    } catch {
      message.error('上传失败')
    }
    return false
  }, [setDefault])

  const handleResetDefault = useCallback(() => {
    resetDefault()
    message.success('已还原为默认图标')
  }, [resetDefault])

  return (
    <>
      {/* 默认图标设置 */}
      <div className="flex items-center justify-between py-1 px-2 border-b mb-1" style={{ borderColor: token.colorBorderSecondary }}>
        <div className="flex items-center gap-2">
          <img
            src={customDefault || createDefaultMarkerImage()}
            alt="默认图标"
            style={{ width: 18, height: 18, objectFit: 'contain', borderRadius: 2 }}
          />
          <span className="text-xs" style={{ color: token.colorTextQuaternary }}>默认图标</span>
        </div>
        <div className="flex gap-1">
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => { handleUploadDefault(file); return false }}
          >
            <Button type="text" size="small" title="修改默认图标">
              <Icon icon={uploadIcon} width={12} />
            </Button>
          </Upload>
          {customDefault && (
            <Button type="text" size="small" onClick={handleResetDefault} title="还原默认图标">
              <Icon icon={undo2Icon} width={12} />
            </Button>
          )}
        </div>
      </div>
      {markers.length === 0 && (
        <div className="text-center text-xs py-2" style={{ color: token.colorTextQuaternary }}>
          暂无标点
        </div>
      )}
      {markers.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between py-1 px-2 group rounded cursor-pointer"
          style={{
            background: m.id === selectedMarkerId ? token.colorPrimaryBg : undefined,
          }}
          onMouseEnter={(e) => { if (m.id !== selectedMarkerId) e.currentTarget.style.background = token.colorBgTextHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = m.id === selectedMarkerId ? token.colorPrimaryBg : '' }}
          onClick={() => setSelectedMarkerId(m.id)}
        >
          <div className="text-xs flex-1 truncate">
            <span>{m.name}</span>
            <span style={{ color: token.colorTextQuaternary, marginLeft: 4 }}>{m.width}×{m.height}</span>
            {actionLabel[m.action || 'none'] && (
              <span style={{ color: token.colorPrimary, marginLeft: 4, fontSize: 10 }}>
                {actionLabel[m.action]}
              </span>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            <Button type="text" size="small" onClick={() => { setEditingMarkerId(m.id) }} title="重定位">
              <Icon icon={moveIcon} width={14} />
            </Button>
            <Button type="text" size="small" onClick={() => onEditMarker(m)} title="配置">
              <Icon icon={settingsIcon} width={14} />
            </Button>
            <Popconfirm title="确定删除此标点?" onConfirm={() => removeMarker(m.id)} okText="删除" cancelText="取消">
              <Button type="text" size="small" danger onClick={(e) => e.stopPropagation()}>
                <Icon icon={trash2Icon} width={14} />
              </Button>
            </Popconfirm>
          </div>
        </div>
      ))}
      <Button
        type="dashed"
        icon={<Icon icon={mapPinIcon} width={14} />}
        block
        size="small"
        className="mt-2"
        onClick={() => setAddingMarker(!addingMarker)}
      >
        {addingMarker ? '取消添加' : '添加标点'}
      </Button>
    </>
  )
}
