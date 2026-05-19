import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Row, Col, Spin, Empty, Typography, Button, Space, Tag } from 'antd'
import { ChevronRight20, Cube20, Viewport3d20 } from '../components/FluentIcon'
import { getModels } from '../api/models'
import { getScenes } from '../api/scenes'

const { Title, Text } = Typography

/**
 * 首页
 * 展示最近的模型和场景卡片
 */
export function HomePage() {
  const [models, setModels] = useState<any[]>([])
  const [scenes, setScenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getModels({ limit: 6 }).catch(() => ({ items: [] })),
      getScenes({ limit: 6 }).catch(() => ({ items: [] })),
    ]).then(([modelsRes, scenesRes]) => {
      setModels(modelsRes.items || [])
      setScenes(scenesRes.items || [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      {/* 模型区域 */}
      <Section
        title="最近模型"
        count={models.length}
        linkTo="/models"
        icon={<Cube20 />}
      >
        {models.length === 0 ? (
          <Empty description="还没有模型，去上传一个吧" />
        ) : (
          <Row gutter={[16, 16]}>
            {models.map((model) => (
              <Col key={model.id} xs={24} sm={12} md={8} lg={8}>
                <Link to={`/view/${model.id}?type=model`} className="no-underline">
                  <Card
                    hoverable
                    className="rounded-lg overflow-hidden"
                    cover={
                      model.thumbnail_url ? (
                        <img
                          src={model.thumbnail_url}
                          alt={model.name}
                          className="h-40 object-cover"
                        />
                      ) : (
                        <div className="h-40 !flex items-center justify-center bg-[--ant-color-fill-quaternary]">
                          <Cube20 size={40} color="var(--ant-color-text-tertiary)" />
                        </div>
                      )
                    }
                    styles={{ body: { padding: 16 } }}
                  >
                    <Text strong className="text-sm">{model.name}</Text>
                    <br />
                    <Tag className="mt-1">
                      {model.file_format?.toUpperCase()} · {formatSize(model.file_size)}
                    </Tag>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </Section>

      {/* 场景区域 */}
      <Section
        title="最近场景"
        count={scenes.length}
        linkTo="/scenes"
        icon={<Viewport3d20 />}
        className="mt-10"
      >
        {scenes.length === 0 ? (
          <Empty description="还没有场景，去创建一个吧" />
        ) : (
          <Row gutter={[16, 16]}>
            {scenes.map((scene) => (
              <Col key={scene.id} xs={24} sm={12} md={8} lg={8}>
                <Link to={`/scenes/${scene.id}/edit`} className="no-underline">
                  <Card
                    hoverable
                    className="rounded-lg overflow-hidden"
                    cover={
                      scene.thumbnail_url ? (
                        <img
                          src={scene.thumbnail_url}
                          alt={scene.name}
                          className="h-40 object-cover"
                        />
                      ) : (
                        <div className="h-40 !flex items-center justify-center bg-[--ant-color-fill-quaternary]">
                          <Viewport3d20 size={40} color="var(--ant-color-text-tertiary)" />
                        </div>
                      )
                    }
                    styles={{ body: { padding: 16 } }}
                  >
                    <Text strong className="text-sm">{scene.name}</Text>
                    <br />
                    <Text type="secondary" className="text-xs">
                      {scene.description || '暂无描述'}
                    </Text>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </Section>
    </div>
  )
}

/** 分区标题组件 */
function Section({ title, count, linkTo, icon, children, className }: {
  title: string
  count: number
  linkTo: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-4">
        <Space>
          {icon}
          <Title level={4} className="m-0">
            {title}
            <Text type="secondary" className="text-sm font-normal ml-2">
              ({count})
            </Text>
          </Title>
        </Space>
        <Link to={linkTo}>
          <Button type="link" icon={<ChevronRight20 />} iconPosition="end">
            查看全部
          </Button>
        </Link>
      </div>
      {children}
    </div>
  )
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (!bytes) return '未知大小'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
