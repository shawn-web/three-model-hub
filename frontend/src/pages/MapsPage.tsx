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
import { Add20, Delete20 } from '../components/FluentIcon'
import { GlobalOutlined } from '@ant-design/icons'
import { getGeoMaps, createGeoMap, deleteGeoMap } from '../api/geo-maps'
import { invalidateHttpCache } from '../api/client'

/** 地图数据类型 */
interface GeoMapItem {
  id: string
  name: string
  description?: string
  thumbnail_url?: string
}

/**
 * 地图管理页面
 * 地图列表、创建、删除、编辑入口
 */
export function MapsPage() {
  const [maps, setMaps] = useState<GeoMapItem[]>([])
  const [loading, setLoading] = useState(true)

  /* 创建弹窗状态 */
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [creating, setCreating] = useState(false)

  /** 加载地图列表 */
  const [refreshKey, setRefreshKey] = useState(0)
  const reloadMaps = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      try {
        invalidateHttpCache('/geo-maps')
        const res = await getGeoMaps()
        if (!cancelled) setMaps(res.items || [])
      } catch {
        if (!cancelled) setMaps([])
      }
      if (!cancelled) setLoading(false)
    }
    doLoad()
    return () => { cancelled = true }
  }, [refreshKey])

  /** 创建地图 */
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields()
      setCreating(true)
      await createGeoMap({ name: values.name, description: values.description || undefined })
      setCreateModalOpen(false)
      createForm.resetFields()
      message.success('创建成功')
      reloadMaps()
    } catch (err) {
      console.error('创建失败:', err)
      message.error('创建失败')
    } finally {
      setCreating(false)
    }
  }

  /** 删除地图 */
  const handleDelete = async (id: string) => {
    try {
      await deleteGeoMap(id)
      message.success('删除成功')
      reloadMaps()
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
        <h1 className="text-[22px] font-semibold m-0">地图管理</h1>
        <Button
          type="primary"
          icon={<Add20 />}
          onClick={() => setCreateModalOpen(true)}
        >
          创建地图
        </Button>
      </div>

      {/* 地图卡片列表 */}
      {maps.length === 0 ? (
        <Empty description="还没有地图，点击上方按钮创建" className="animate-scale-in" />
      ) : (
        <Row gutter={[20, 20]}>
          {maps.map((map, i) => (
            <Col key={map.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                className="rounded-xl overflow-hidden card-hover-lift animate-fade-in-up"
                style={{ animationDelay: `${80 + i * 55}ms` }}
                cover={
                  map.thumbnail_url ? (
                    <div className="h-40 overflow-hidden bg-[--ant-color-fill-quaternary]">
                      <img
                        src={map.thumbnail_url}
                        alt={map.name}
                        className="w-full h-full object-cover thumb-zoom"
                      />
                    </div>
                  ) : (
                    <div className="h-40 !flex items-center justify-center bg-[--ant-color-fill-quaternary]">
                      <GlobalOutlined style={{ fontSize: 40, color: 'var(--ant-color-text-tertiary)' }} />
                    </div>
                  )
                }
                actions={[
                  <Link key="geo" to={`/maps/${map.id}`}>
                    <GlobalOutlined /> 地球
                  </Link>,
                  <Popconfirm
                    key="delete"
                    title="确认删除"
                    description={`确定删除地图 "${map.name}" 吗？`}
                    onConfirm={() => handleDelete(map.id)}
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
                  title={map.name}
                  description={map.description || '暂无描述'}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 创建地图弹窗 */}
      <Modal
        title="创建地图"
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
            label="地图名称"
            name="name"
            rules={[{ required: true, message: '请输入地图名称' }]}
          >
            <Input placeholder="输入地图名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
