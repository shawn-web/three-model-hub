import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card,
  Row,
  Col,
  Button,
  Modal,
  Input,
  Empty,
  Spin,
  Popconfirm,
  message,
  Upload,
  Menu,
  Form,
  Select,
} from 'antd'
import {
  Add20,
  Delete20,
  Edit20,
  Search20,
  ArrowUpload20,
  Video20,
  FolderOpen20,
} from '../components/FluentIcon'
import {
  getResources,
  getResourceGroups,
  createResourceGroup,
  updateResourceGroup,
  deleteResourceGroup,
  updateResource,
  deleteResource,
  uploadResource,
  readImageMeta,
  readVideoMeta,
} from '../api/resources'
import type { ResourceItem, ResourceType, ResourceGroup } from '../types/resource'
import { VideoThumbnail } from '../components/VideoThumbnail'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'

/**
 * 资源管理页面
 * 管理图片和视频资源的上传、浏览、分组
 */
export function ResourcesPage() {
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [groups, setGroups] = useState<ResourceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<ResourceType | 'all'>('all')
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // 上传状态
  const [uploading, setUploading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const uploadQueue = useRef<File[]>([])
  const isUploading = useRef(false)
  const uploadedCount = useRef(0)
  const failedCount = useRef(0)

  // 编辑分组弹窗
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ResourceGroup | null>(null)
  const [groupForm] = Form.useForm()

  // 编辑资源名称弹窗
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null)
  const [renameForm] = Form.useForm()

  // 移动分组弹窗
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [movingResource, setMovingResource] = useState<ResourceItem | null>(null)
  const [moveForm] = Form.useForm()

  // 预览
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  /** 将资源列表转为 Lightbox slides */
  const lightboxSlides = resources.map((item) =>
    item.type === 'video'
      ? {
          type: 'video' as const,
          sources: [{ src: item.url, type: item.mime_type || 'video/mp4' }],
          width: item.width || 1280,
          height: item.height || 720,
        }
      : { src: item.url }
  )

  /** 加载资源列表（依赖变化时触发） */
  const [resourcesRefreshKey, setResourcesRefreshKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, limit: 40 }
        if (activeType !== 'all') params.type = activeType
        if (activeGroupId === 'ungrouped') params.group_id = 'ungrouped'
        else if (activeGroupId) params.group_id = activeGroupId
        if (search) params.search = search
        const res = await getResources(params)
        if (cancelled) return
        setResources(res.items || [])
        setTotal(res.total || 0)
      } catch {
        if (!cancelled) setResources([])
      }
      if (!cancelled) setLoading(false)
    }
    doLoad()
    return () => { cancelled = true }
  }, [page, activeType, activeGroupId, search, resourcesRefreshKey])

  /** 手动触发资源刷新 */
  const reloadResources = useCallback(() => setResourcesRefreshKey((k) => k + 1), [])

  /** 加载分组列表 */
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      try {
        const data = await getResourceGroups()
        if (!cancelled) setGroups(data || [])
      } catch {
        if (!cancelled) setGroups([])
      }
    }
    doLoad()
    return () => { cancelled = true }
  }, [groupsRefreshKey])

  /** 手动触发分组刷新 */
  const reloadGroups = useCallback(() => setGroupsRefreshKey((k) => k + 1), [])

  // ===== 上传 =====
  const processUploadQueue = useCallback(async () => {
    if (isUploading.current) return
    isUploading.current = true
    setUploading(true)

    while (uploadQueue.current.length > 0) {
      const file = uploadQueue.current.shift()!
      setPendingCount(uploadQueue.current.length)
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi']
        const resourceType: ResourceType = videoExts.includes(ext) ? 'video' : 'image'

        let metadata: Record<string, unknown> = {
          name: file.name,
          type: resourceType,
          mime_type: file.type,
          group_id: activeGroupId && activeGroupId !== 'ungrouped' ? activeGroupId : undefined,
        }
        if (resourceType === 'image') {
          const meta = await readImageMeta(file)
          metadata = { ...metadata, ...meta }
        } else {
          const meta = await readVideoMeta(file)
          metadata = { ...metadata, ...meta }
        }

        await uploadResource(file, metadata as Parameters<typeof uploadResource>[1])
        uploadedCount.current++
      } catch (err: unknown) {
        failedCount.current++
        const errObj = err as { response?: { data?: { message?: string } }; message?: string }
        const errMsg = errObj?.response?.data?.message || errObj?.message || '上传失败'
        console.error('上传失败:', err)
        message.error(`${file.name}: ${errMsg}`)
      }
    }

    const total = uploadedCount.current + failedCount.current
    if (total > 0) {
      if (uploadedCount.current > 0) {
        message.success(`成功上传 ${uploadedCount.current} 个文件${failedCount.current > 0 ? `，${failedCount.current} 个失败` : ''}`)
      }
      reloadResources()
    }

    uploadedCount.current = 0
    failedCount.current = 0
    isUploading.current = false
    setPendingCount(0)
    setUploading(false)
  }, [activeGroupId, reloadResources])

  const handleUpload = (file: File) => {
    uploadQueue.current.push(file)
    setPendingCount(uploadQueue.current.length)
    processUploadQueue()
    return false
  }

  // ===== 分组操作 =====
  const handleSaveGroup = async () => {
    try {
      const values = await groupForm.validateFields()
      if (editingGroup) {
        await updateResourceGroup(editingGroup.id, { name: values.name })
        message.success('分组已更新')
      } else {
        await createResourceGroup({ name: values.name })
        message.success('分组已创建')
      }
      setGroupModalOpen(false)
      groupForm.resetFields()
      setEditingGroup(null)
      reloadGroups()
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return // 表单验证失败，Ant Design 会自动显示字段错误
      message.error('操作失败')
    }
  }

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteResourceGroup(id)
      message.success('分组已删除')
      if (activeGroupId === id) setActiveGroupId(null)
      reloadGroups()
      reloadResources()
    } catch {
      message.error('删除失败')
    }
  }

  // ===== 资源操作 =====
  const handleRename = async () => {
    try {
      const values = await renameForm.validateFields()
      if (editingResource) {
        await updateResource(editingResource.id, { name: values.name })
        message.success('已重命名')
        setRenameModalOpen(false)
        renameForm.resetFields()
        setEditingResource(null)
        reloadResources()
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return // 表单验证失败，Ant Design 会自动显示字段错误
      message.error('重命名失败')
    }
  }

  const handleDeleteResource = async (id: string) => {
    try {
      await deleteResource(id)
      message.success('已删除')
      reloadResources()
    } catch {
      message.error('删除失败')
    }
  }

  const handleMoveGroup = async () => {
    try {
      const values = await moveForm.validateFields()
      if (movingResource) {
        await updateResource(movingResource.id, {
          group_id: values.group_id || undefined,
        })
        message.success('已移动')
        setMoveModalOpen(false)
        moveForm.resetFields()
        setMovingResource(null)
        reloadResources()
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return // 表单验证失败，Ant Design 会自动显示字段错误
      message.error('移动失败')
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getResourceActions = (item: ResourceItem) => [
    <span
      key="rename"
      onClick={(e) => {
        e.stopPropagation()
        setEditingResource(item)
        renameForm.setFieldsValue({ name: item.name })
        setRenameModalOpen(true)
      }}
    >
      <Edit20 /> 重命名
    </span>,
    <span
      key="move"
      onClick={(e) => {
        e.stopPropagation()
        setMovingResource(item)
        moveForm.setFieldsValue({ group_id: item.group_id || '' })
        setMoveModalOpen(true)
      }}
    >
      <FolderOpen20 /> 移动
    </span>,
    <Popconfirm
      key="delete"
      title="确认删除"
      description={`确定删除资源 "${item.name}" 吗？`}
      onConfirm={() => handleDeleteResource(item.id)}
      okText="确定"
      cancelText="取消"
    >
      <span className="text-[--ant-color-error]" onClick={(e) => e.stopPropagation()}>
        <Delete20 /> 删除
      </span>
    </Popconfirm>,
  ]

  return (
    <div className="flex h-full animate-fade-in">
      {/* 左侧分组列表 */}
      <div className="w-[200px] border-r border-[--ant-color-border-secondary] p-3 flex flex-col shrink-0 animate-slide-in-left">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">分组</span>
          <Button
            size="small"
            type="text"
            icon={<Add20 />}
            onClick={() => {
              setEditingGroup(null)
              groupForm.resetFields()
              setGroupModalOpen(true)
            }}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeGroupId || 'all']}
          onClick={({ key }) => setActiveGroupId(key === 'all' ? null : key)}
          items={[
            { key: 'all', label: '全部资源' },
            { key: 'ungrouped', label: '未分组' },
            { type: 'divider' },
            ...groups.map((g) => ({
              key: g.id,
              label: (
                <div className="flex items-center justify-between group">
                  <span className="truncate">{g.name}</span>
                  <span
                    className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      title="编辑分组"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingGroup(g)
                        groupForm.setFieldsValue({ name: g.name })
                        setGroupModalOpen(true)
                      }}
                    >
                      <Edit20 size={14} className="cursor-pointer hover:text-[--ant-color-primary]" />
                    </span>
                    <Popconfirm
                      title="确认删除"
                      description={`确定删除分组 "${g.name}" 吗？`}
                      onConfirm={() => handleDeleteGroup(g.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <span
                        title="删除分组"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Delete20 size={14} className="cursor-pointer hover:text-[--ant-color-error]" />
                      </span>
                    </Popconfirm>
                  </span>
                </div>
              ),
            })),
          ]}
          className="border-none flex-1 overflow-y-auto"
        />
      </div>

      {/* 右侧主区域 */}
      <div className="flex-1 flex flex-col min-w-0 p-6">
        {/* 顶部操作栏 */}
        <div
          className="flex gap-3 mb-4 items-center animate-fade-in-up"
          style={{ animationDelay: '80ms' }}
        >
          <Input
            prefix={<Search20 size={14} />}
            placeholder="搜索资源"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-[240px]"
            allowClear
          />
          <div className="flex gap-1">
            {(['all', 'image', 'video'] as const).map((t) => (
              <Button
                key={t}
                size="small"
                type={activeType === t ? 'primary' : 'default'}
                onClick={() => { setActiveType(t); setPage(1) }}
              >
                {t === 'all' ? '全部' : t === 'image' ? '图片' : '视频'}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept="image/*,video/*"
            multiple
          >
            <Button type="primary" icon={<ArrowUpload20 />} loading={uploading}>
              {uploading ? `上传中 (${pendingCount + 1} 个待处理)` : '上传资源'}
            </Button>
          </Upload>
        </div>

        {/* 资源列表 */}
        {loading ? (
          <div className="flex justify-center items-center flex-1">
            <Spin size="large" description="加载中..." />
          </div>
        ) : resources.length === 0 ? (
          <div className="flex justify-center items-center flex-1 animate-scale-in">
            <Empty description="暂无资源，点击上方按钮上传" />
          </div>
        ) : (
          <Row gutter={[20, 20]} className="flex-1 content-start overflow-y-auto">
            {resources.map((item, i) => (
              <Col key={item.id} xs={12} sm={8} md={8} lg={6}>
                <Card
                  hoverable
                  className="rounded-xl overflow-hidden cursor-pointer card-hover-lift animate-fade-in-up"
                  style={{ animationDelay: `${120 + i * 45}ms` }}
                  onClick={() => {
                    setLightboxIndex(resources.indexOf(item))
                    setLightboxOpen(true)
                  }}
                  cover={
                    <div className="h-40 flex items-center justify-center bg-[--ant-color-fill-quaternary] overflow-hidden">
                      {item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-full object-contain mx-auto thumb-zoom"
                          onError={(e) => {
                            const el = e.currentTarget
                            el.style.display = 'none'
                            const fallback = el.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : (
                        <VideoThumbnail
                          url={item.url}
                          className="w-full h-full object-cover thumb-zoom"
                          fallbackSize={40}
                        />
                      )}
                      <div
                        className="flex-col items-center gap-1"
                        style={{ display: 'none' }}
                      >
                        <Video20 size={40} color="var(--ant-color-text-tertiary)" />
                        <span className="text-xs text-[--ant-color-text-tertiary]">
                          视频
                        </span>
                      </div>
                    </div>
                  }
                  actions={getResourceActions(item)}
                >
                  <Card.Meta
                    title={
                      <span className="text-sm truncate block" title={item.name}>
                        {item.name}
                      </span>
                    }
                    description={
                      <div className="flex items-center gap-2 text-xs text-[--ant-color-text-tertiary]">
                        <span>{formatSize(item.file_size)}</span>
                        {item.width && item.height && (
                          <span>{item.width}×{item.height}</span>
                        )}
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* 编辑分组弹窗 */}
      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={groupModalOpen}
        onOk={handleSaveGroup}
        onCancel={() => { setGroupModalOpen(false); groupForm.resetFields(); setEditingGroup(null) }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={groupForm} layout="vertical" className="mt-4">
          <Form.Item
            label="分组名称"
            name="name"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="输入分组名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重命名资源弹窗 */}
      <Modal
        title="重命名资源"
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => { setRenameModalOpen(false); renameForm.resetFields(); setEditingResource(null) }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={renameForm} layout="vertical" className="mt-4">
          <Form.Item
            label="资源名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="输入资源名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 移动分组弹窗 */}
      <Modal
        title="移动到分组"
        open={moveModalOpen}
        onOk={handleMoveGroup}
        onCancel={() => { setMoveModalOpen(false); moveForm.resetFields(); setMovingResource(null) }}
        okText="移动"
        cancelText="取消"
      >
        <Form form={moveForm} layout="vertical" className="mt-4">
          <Form.Item label="目标分组" name="group_id">
            <Select placeholder="选择分组（留空为未分组）" allowClear>
              {groups.map((g) => (
                <Select.Option key={g.id} value={g.id}>
                  {g.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 资源预览 */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Video]}
        video={{ controls: true, playsInline: true }}
      />
    </div>
  )
}
