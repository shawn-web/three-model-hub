import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Space,
  Popconfirm,
  message,
  Tag,
  Image,
  Tooltip,
  Upload,
  Checkbox,
} from 'antd'
import { ArrowUpload20, Edit20, Copy20, ArrowDownload20, Delete20, Eye20, Cube20, Search20 } from '../components/FluentIcon'
import type { ColumnsType } from 'antd/es/table'
import {
  getModels,
  uploadModel,
  deleteModel,
  updateModel,
  copyModel,
  downloadModelWithProgress,
  getCompressionTask,
} from '../api/models'
import type { CompressionTask } from '../api/models'
import { invalidateHttpCache } from '../api/client'

/** 模型数据类型 */
interface ModelItem {
  id: string
  name: string
  description?: string
  file_format?: string
  file_size?: number
  thumbnail_url?: string
  version_count?: number
  download_count?: number
}

/**
 * 模型管理页面
 * 支持上传、删除、编辑、复制、下载等功能
 */
export function ModelsPage() {
  const [models, setModels] = useState<ModelItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [, setUploadPhase] = useState<'idle' | 'uploading' | 'processing'>('idle')

  /* 上传时是否开启压缩（用户主动选择） */
  const [compressOnUpload, setCompressOnUpload] = useState(false)
  /* 压缩任务进度（上传成功且勾选压缩后才进入此状态） */
  const [compressing, setCompressing] = useState(false)
  const [compressStage, setCompressStage] = useState<string>('')
  const [compressPercent, setCompressPercent] = useState(0)
  const compressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* 编辑弹窗状态 */
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null)
  const [editForm] = Form.useForm()

  const pageSize = 20
  const [refreshKey, setRefreshKey] = useState(0)

  /** 加载模型列表（page/search 变化或手动刷新时触发） */
  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      try {
        const res = await getModels({ page, limit: pageSize, search: search || undefined })
        if (cancelled) return
        setModels(res.items || [])
        setTotal(res.total || 0)
      } catch {
        if (!cancelled) setModels([])
      }
      if (!cancelled) setLoading(false)
    }
    doLoad()
    return () => { cancelled = true }
  }, [page, search, refreshKey])

  /** 卸载时清理压缩轮询定时器 */
  useEffect(() => {
    return () => {
      if (compressTimerRef.current) {
        clearTimeout(compressTimerRef.current)
        compressTimerRef.current = null
      }
    }
  }, [])

  /** 手动触发刷新 */
  const reloadModels = useCallback(() => setRefreshKey((k) => k + 1), [])

  /**
   * 轮询压缩任务进度，直到 completed / failed
   * 上传成功且勾选压缩时调用，用 message 提示阶段
   */
  const pollCompression = useCallback((taskId: string) => {
    setCompressing(true)
    setCompressPercent(0)
    setCompressStage('')
    const hide = message.loading('模型压缩中...', 0)

    const poll = async () => {
      try {
        const task: CompressionTask = await getCompressionTask(taskId)
        setCompressStage(task.stage || '')
        setCompressPercent(task.percentage)
        if (task.status === 'completed') {
          hide()
          const ratio = task.compressionRatio
            ? `${(task.compressionRatio * 100).toFixed(0)}%`
            : '未知'
          message.success(`压缩完成（压缩率 ${ratio}），已生成新版本`)
          setCompressing(false)
          invalidateHttpCache('/models')
          reloadModels()
          return
        }
        if (task.status === 'failed') {
          hide()
          message.error('压缩失败：' + (task.errorMessage || '请稍后重试'))
          setCompressing(false)
          return
        }
      } catch {
        // 单次查询失败不中断轮询（网络抖动等）
      }
      compressTimerRef.current = setTimeout(poll, 1500)
    }
    poll()
  }, [reloadModels])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadPhase('uploading')
    setUploadProgress(0)
    try {
      const result = await uploadModel(
        file,
        { name: file.name.replace(/\.[^.]+$/, '') },
        (percent) => {
          setUploadProgress(percent)
        },
        compressOnUpload,
      )
      // 若勾选压缩且后端成功触发，进入压缩进度轮询
      if (result.compressionTaskId) {
        setUploading(false)
        setUploadPhase('idle')
        setUploadProgress(0)
        pollCompression(result.compressionTaskId)
      } else {
        message.success('上传成功')
        invalidateHttpCache('/models')
        reloadModels()
      }
    } catch (err) {
      console.error('上传失败:', err)
      message.error('上传失败，请重试')
    }
    setUploading(false)
    setUploadPhase('idle')
    setUploadProgress(0)
    return false
  }

  /** 删除模型 */
  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id)
      message.success('删除成功')
      invalidateHttpCache('/models')
      reloadModels()
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      if (resp?.status === 400 && resp?.data?.message) {
        Modal.error({
          title: '无法删除模型',
          content: resp.data.message,
        })
      } else {
        message.error('删除失败')
      }
    }
  }

  /** 复制模型 */
  const handleCopy = async (id: string) => {
    try {
      await copyModel(id)
      message.success('复制成功')
      invalidateHttpCache('/models')
      reloadModels()
    } catch (err) {
      console.error('复制失败:', err)
      message.error('复制失败')
    }
  }

  /** 打开编辑弹窗 */
  const openEdit = (model: ModelItem) => {
    setEditingModel(model)
    editForm.setFieldsValue({ name: model.name, description: model.description || '' })
    setEditModalOpen(true)
  }

  /** 保存编辑 */
  const handleSaveEdit = async () => {
    if (!editingModel) return
    try {
      const values = await editForm.validateFields()
      await updateModel(editingModel.id, {
        name: values.name,
        description: values.description,
      })
      setEditModalOpen(false)
      setEditingModel(null)
      message.success('更新成功')
      invalidateHttpCache('/models')
      reloadModels()
    } catch (err) {
      console.error('更新失败:', err)
      message.error('更新失败')
    }
  }

  /** 表格列定义 */
  const columns: ColumnsType<ModelItem> = [
    {
      title: '缩略图',
      dataIndex: 'thumbnail_url',
      width: 80,
      render: (url: string) => url
        ? <Image src={url} width={40} height={40} className="rounded object-cover" />
        : <Cube20 size={24} color="var(--ant-color-text-tertiary)" />,
    },
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: '格式',
      dataIndex: 'file_format',
      width: 90,
      render: (fmt: string) => fmt ? <Tag>{fmt.toUpperCase()}</Tag> : '-',
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      width: 100,
      ellipsis: true,
      render: (size: number) => formatSize(size),
    },
    {
      title: '版本',
      dataIndex: 'version_count',
      width: 70,
      align: 'center',
    },
    {
      title: '下载',
      dataIndex: 'download_count',
      width: 70,
      align: 'center',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="预览">
            <Button
              type="text"
              size="small"
              icon={<Eye20 />}
              onClick={() => window.open(`/view/${record.id}?type=model`, '_blank')}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<Edit20 />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<Copy20 />}
              onClick={() => handleCopy(record.id)}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="text"
              size="small"
              icon={<ArrowDownload20 />}
              onClick={() => {
                downloadModelWithProgress(record.id).catch((e) => {
                  console.error('下载失败:', e)
                  message.error('下载失败：' + (e?.message || '请稍后重试'))
                })
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定删除模型 "${record.name}" 吗？此操作不可恢复。`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<Delete20 />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 animate-fade-in">
      {/* 页面标题 */}
      <h1
        className="text-[22px] font-semibold mb-6 animate-fade-in-up"
        style={{ animationDelay: '0ms' }}
      >
        模型管理
      </h1>

      {/* 操作栏 */}
      <div
        className="flex justify-between items-center mb-6 animate-fade-in-up"
        style={{ animationDelay: '60ms' }}
      >
        <Input
          placeholder="搜索模型..."
          prefix={<Search20 />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-80"
          allowClear
        />
        <Space size={12} align="center">
          <Tooltip title="勾选后，上传完成会自动触发 meshopt 几何压缩 + 纹理转 WebP，生成更小的新版本">
            <Checkbox
              checked={compressOnUpload}
              onChange={(e) => setCompressOnUpload(e.target.checked)}
              disabled={uploading || compressing}
            >
              上传后压缩
            </Checkbox>
          </Tooltip>
          <Upload
            accept=".glb,.gltf"
            showUploadList={false}
            beforeUpload={(file) => { handleUpload(file); return false }}
          >
            <Button
              type="primary"
              icon={uploading || compressing ? undefined : <ArrowUpload20 />}
              loading={uploading || compressing}
              disabled={uploading || compressing}
            >
              {compressing
                ? `压缩中 ${compressPercent}%`
                : uploading
                  ? uploadProgress >= 95
                    ? '处理中...'
                    : `上传中 ${uploadProgress}%`
                  : '上传模型'}
            </Button>
          </Upload>
        </Space>
      </div>

      {/* 压缩阶段提示（仅压缩中显示） */}
      {compressing && compressStage && (
        <div className="mb-3 text-sm text-[var(--ant-color-text-secondary)] animate-fade-in-up">
          当前阶段：{compressStage}
        </div>
      )}

      {/* 模型列表表格 */}
      <div
        className="animate-fade-in-up row-highlight"
        style={{ animationDelay: '120ms' }}
      >
        <Table<ModelItem>
          columns={columns}
          dataSource={models}
          rowKey="id"
          loading={loading}
          tableLayout="fixed"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 个模型`,
            onChange: (p) => setPage(p),
          }}
          locale={{ emptyText: search ? '没有找到匹配的模型' : '还没有模型，点击上方按钮上传' }}
        />
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑模型"
        open={editModalOpen}
        onOk={handleSaveEdit}
        onCancel={() => { setEditModalOpen(false); setEditingModel(null) }}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (!bytes) return '未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}