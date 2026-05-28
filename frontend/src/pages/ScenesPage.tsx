import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Button,
  Modal,
  Form,
  Input,
  Empty,
  Spin,
  Popconfirm,
  message,
} from 'antd'
import { Add20, Edit20, Eye20, Delete20, Viewport3d20 } from '../components/FluentIcon'
import { getScenes, createScene, deleteScene } from '../api/scenes'
import { invalidateHttpCache } from '../api/client'

/** 场景数据类型 */
interface SceneItem {
  id: string
  name: string
  description?: string
  thumbnail_url?: string
}

/**
 * 场景管理页面
 * 场景列表、创建、删除、编辑入口
 */
export function ScenesPage() {
  const [scenes, setScenes] = useState<SceneItem[]>([])
  const [loading, setLoading] = useState(true)

  /* 创建弹窗状态 */
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [creating, setCreating] = useState(false)

  /** 加载场景列表 */
  const [refreshKey, setRefreshKey] = useState(0)
  const reloadScenes = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      try {
        invalidateHttpCache('/scenes')
        const res = await getScenes()
        if (!cancelled) setScenes(res.items || [])
      } catch {
        if (!cancelled) setScenes([])
      }
      if (!cancelled) setLoading(false)
    }
    doLoad()
    return () => { cancelled = true }
  }, [refreshKey])

  /** 创建场景 */
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields()
      setCreating(true)
      await createScene({ name: values.name, description: values.description || undefined })
      setCreateModalOpen(false)
      createForm.resetFields()
      message.success('创建成功')
      reloadScenes()
    } catch (err) {
      console.error('创建失败:', err)
      message.error('创建失败')
    } finally {
      setCreating(false)
    }
  }

  /** 删除场景 */
  const handleDelete = async (id: string) => {
    try {
      await deleteScene(id)
      message.success('删除成功')
      reloadScenes()
    } catch (err) {
      console.error('删除失败:', err)
      message.error('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Spin size="large" description="加载中..." />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 animate-fade-in">
      {/* 头部操作栏 */}
      <div
        className="flex justify-between items-center mb-6 animate-fade-in-up"
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="text-[22px] font-semibold m-0">场景管理</h1>
        <Button
          type="primary"
          icon={<Add20 />}
          onClick={() => setCreateModalOpen(true)}
        >
          创建场景
        </Button>
      </div>

      {/* 场景卡片列表 */}
      {scenes.length === 0 ? (
        <Empty description="还没有场景，点击上方按钮创建" className="animate-scale-in" />
      ) : (
        <Row gutter={[20, 20]}>
          {scenes.map((scene, i) => (
            <Col key={scene.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                className="rounded-xl overflow-hidden card-hover-lift animate-fade-in-up"
                style={{ animationDelay: `${80 + i * 55}ms` }}
                cover={
                  scene.thumbnail_url ? (
                    <div className="h-40 overflow-hidden bg-[--ant-color-fill-quaternary]">
                      <img
                        src={scene.thumbnail_url}
                        alt={scene.name}
                        className="w-full h-full object-cover thumb-zoom"
                      />
                    </div>
                  ) : (
                    <div className="h-40 !flex items-center justify-center bg-[--ant-color-fill-quaternary]">
                      <Viewport3d20 size={40} color="var(--ant-color-text-tertiary)" />
                    </div>
                  )
                }
                actions={[
                  <Link key="edit" to={`/scenes/${scene.id}/edit`}>
                    <Edit20 /> 编辑
                  </Link>,
                  <Link key="preview" to={`/view/${scene.id}?type=scene`}>
                    <Eye20 /> 预览
                  </Link>,
                  <Popconfirm
                    key="delete"
                    title="确认删除"
                    description={`确定删除场景 "${scene.name}" 吗？`}
                    onConfirm={() => handleDelete(scene.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <span className="text-[--ant-color-error]">
                      <Delete20 /> 删除
                    </span>
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={scene.name}
                  description={scene.description || '暂无描述'}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 创建场景弹窗 */}
      <Modal
        title="创建场景"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item
            label="场景名称"
            name="name"
            rules={[{ required: true, message: '请输入场景名称' }]}
          >
            <Input placeholder="输入场景名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
