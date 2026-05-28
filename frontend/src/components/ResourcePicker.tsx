import { useState, useCallback } from 'react'
import { Modal, Input, Row, Col, Empty, Spin, Button, Upload, message, theme } from 'antd'
import {
  getResources,
  getResourceGroups,
  uploadResource,
  readImageMeta,
  readVideoMeta,
} from '../api/resources'
import type { ResourceItem, ResourceType, ResourceGroup } from '../types/resource'
import { Search20, ArrowUpload20 } from './FluentIcon'
import { VideoThumbnail } from './VideoThumbnail'
import { Icon } from '@iconify/react'
import { folderIcon } from './Icons'

interface ResourcePickerProps {
  open: boolean
  onClose: () => void
  onSelect: (resources: ResourceItem[]) => void
  multiple?: boolean
  /** 类型过滤：'image' | 'video' | 'all'，默认 'all' */
  typeFilter?: ResourceType | 'all'
  allowUpload?: boolean
}

/** 资源元数据类型 */
interface ResourceMetadata {
  name: string
  type: ResourceType
  mime_type: string
  group_id?: string
  width?: number
  height?: number
  duration?: number
}

/**
 * 资源选择器弹窗
 * 支持目录/分组浏览，可按类型过滤图片/视频
 */
export function ResourcePicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  typeFilter = 'all',
  allowUpload = true,
}: ResourcePickerProps) {
  return (
    <Modal
      title="选择资源"
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
      destroyOnHidden
    >
      {open && (
        <ResourcePickerContent
          multiple={multiple}
          typeFilter={typeFilter}
          allowUpload={allowUpload}
          onSelect={onSelect}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

/** 资源选择器内容（仅在打开时挂载，关闭即销毁） */
function ResourcePickerContent({
  multiple,
  typeFilter,
  allowUpload,
  onSelect,
  onClose,
}: {
  multiple: boolean
  typeFilter: ResourceType | 'all'
  allowUpload: boolean
  onSelect: (resources: ResourceItem[]) => void
  onClose: () => void
}) {
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [groups, setGroups] = useState<ResourceGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<ResourceType | 'all'>(typeFilter)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const { token } = theme.useToken()

  /** 加载资源分组 */
  const loadGroups = useCallback(async () => {
    try {
      const data = await getResourceGroups()
      setGroups(data || [])
    } catch {
      setGroups([])
    }
  }, [])

  /** 加载资源列表 */
  const loadResources = useCallback(async (overrideType?: ResourceType | 'all', overrideGroupId?: string | null, overrideSearch?: string) => {
    setLoading(true)
    try {
      const params: Parameters<typeof getResources>[0] = { page: 1, limit: 200 }
      const t = overrideType ?? activeType
      const g = overrideGroupId ?? activeGroupId
      const s = overrideSearch ?? search
      if (t !== 'all') params.type = t
      if (g) params.group_id = g
      if (s) params.search = s
      const res = await getResources(params)
      setResources(res.items || [])
    } catch {
      setResources([])
    }
    setLoading(false)
  }, [activeType, activeGroupId, search])

  /** 初始化加载 */
  const ensureInitialized = useCallback(() => {
    if (initialized) return
    setInitialized(true)
    loadGroups()
    loadResources()
  }, [initialized, loadGroups, loadResources])

  // 首次渲染时自动加载
  ensureInitialized()

  /** 切换类型 */
  const handleTypeChange = useCallback((t: ResourceType | 'all') => {
    setActiveType(t)
    loadResources(t, undefined, undefined)
  }, [loadResources])

  /** 切换分组 */
  const handleGroupChange = useCallback((groupId: string | null) => {
    setActiveGroupId(groupId)
    loadResources(undefined, groupId, undefined)
  }, [loadResources])

  /** 搜索 */
  const handleSearch = useCallback(() => {
    loadResources(undefined, undefined, undefined)
  }, [loadResources])

  const handleSelect = (item: ResourceItem) => {
    if (multiple) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
    } else {
      setSelectedIds(new Set([item.id]))
    }
  }

  const handleConfirm = () => {
    const selected = resources.filter((r) => selectedIds.has(r.id))
    if (selected.length === 0) {
      message.warning('请至少选择一个资源')
      return
    }
    onSelect(selected)
    onClose()
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi']
      const resourceType: ResourceType = videoExts.includes(ext) ? 'video' : 'image'

      if (typeFilter !== 'all' && resourceType !== typeFilter) {
        message.warning(`当前只能选择${typeFilter === 'image' ? '图片' : '视频'}资源`)
        setUploading(false)
        return false
      }

      const metadata: ResourceMetadata = {
        name: file.name,
        type: resourceType,
        mime_type: file.type,
        ...(activeGroupId ? { group_id: activeGroupId } : {}),
      }
      if (resourceType === 'image') {
        const meta = await readImageMeta(file)
        Object.assign(metadata, meta)
      } else {
        const meta = await readVideoMeta(file)
        Object.assign(metadata, meta)
      }

      await uploadResource(file, metadata as Parameters<typeof uploadResource>[1])
      message.success('上传成功')
      loadResources()
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string }
      const errMsg = errorObj?.response?.data?.message || errorObj?.message || '上传失败'
      console.error('上传失败:', err)
      message.error(errMsg)
    }
    setUploading(false)
    return false
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, height: 450 }}>
        {/* 左侧目录列表 */}
        <div style={{ width: 140, flexShrink: 0, borderRight: `1px solid ${token.colorBorderSecondary}`, paddingRight: 8, overflowY: 'auto' }}>
          <div
            onClick={() => handleGroupChange(null)}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              marginBottom: 4,
              background: activeGroupId === null ? token.colorPrimaryBg : 'transparent',
              color: activeGroupId === null ? token.colorPrimary : token.colorText,
              fontWeight: activeGroupId === null ? 600 : 400,
            }}
          >
            <Icon icon={folderIcon} width={12} style={{ marginRight: 4, verticalAlign: -1 }} />
            全部资源
          </div>
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => handleGroupChange(g.id)}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                marginBottom: 4,
                background: activeGroupId === g.id ? token.colorPrimaryBg : 'transparent',
                color: activeGroupId === g.id ? token.colorPrimary : token.colorText,
                fontWeight: activeGroupId === g.id ? 600 : 400,
              }}
            >
              <Icon icon={folderIcon} width={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              {g.name}
            </div>
          ))}
        </div>

        {/* 右侧资源内容 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* 操作栏 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <Input
              prefix={<Search20 size={14} />}
              placeholder="搜索资源"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              style={{ flex: 1 }}
              allowClear
              size="small"
            />
            {typeFilter === 'all' && (
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'image', 'video'] as const).map((t) => (
                  <Button
                    key={t}
                    size="small"
                    type={activeType === t ? 'primary' : 'default'}
                    onClick={() => handleTypeChange(t)}
                  >
                    {t === 'all' ? '全部' : t === 'image' ? '图片' : '视频'}
                  </Button>
                ))}
              </div>
            )}
            {allowUpload && (
              <Upload
                beforeUpload={handleUpload}
                showUploadList={false}
                accept={activeType === 'video' ? 'video/*' : activeType === 'image' ? 'image/*' : 'image/*,video/*'}
              >
                <Button icon={<ArrowUpload20 />} loading={uploading} size="small">上传</Button>
              </Upload>
            )}
          </div>

          {/* 资源网格 */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Spin size="large" />
              </div>
            ) : resources.length === 0 ? (
              <Empty description="暂无资源" />
            ) : (
              <Row gutter={[16, 16]}>
                {resources.map((item) => {
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <Col key={item.id} xs={12} sm={8} md={6}>
                      <div
                        onClick={() => handleSelect(item)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: `2px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
                          boxShadow: isSelected ? `0 0 0 2px ${token.colorPrimaryBg}` : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          position: 'relative',
                        }}
                      >
                        {/* 选中角标 */}
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: token.colorPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                          }}>
                            <Icon icon="mdi:check" width={14} color="#fff" />
                          </div>
                        )}
                        <div style={{
                          height: 96,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected ? token.colorPrimaryBg : token.colorFillQuaternary,
                          overflow: 'hidden',
                        }}>
                          {item.type === 'image' ? (
                            <img
                              src={item.url}
                              alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                const el = e.currentTarget
                                el.style.display = 'none'
                                const fallback = el.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = 'flex'
                              }}
                            />
                          ) : (
                            <VideoThumbnail url={item.url} className="w-full h-full object-cover" fallbackSize={32} />
                          )}
                          <div
                            style={{
                              display: 'none',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          />
                        </div>
                        <div style={{
                          padding: '6px 8px',
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                          color: isSelected ? token.colorPrimary : token.colorText,
                          fontWeight: isSelected ? 600 : 400,
                        }} title={item.name}>
                          {item.name}
                        </div>
                      </div>
                    </Col>
                  )
                })}
              </Row>
            )}
          </div>
        </div>
      </div>
      {/* 底部按钮（放在内容区内部以避免 Modal footer 的限制） */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" onClick={handleConfirm}>
          确认选择{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </Button>
      </div>
    </>
  )
}
