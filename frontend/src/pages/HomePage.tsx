import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Row, Col, Spin, Empty, Typography, Button, Space, Tag } from 'antd'
import { ChevronRight20, Cube20, Viewport3d20 } from '../components/FluentIcon'
import { getModels } from '../api/models'
import { getScenes } from '../api/scenes'

const { Title, Text } = Typography

/** 首页卡片最小类型 */
interface HomeModelItem {
  id: string
  name: string
  thumbnail_url?: string
  file_format?: string
  file_size?: number
}

interface HomeSceneItem {
  id: string
  name: string
  description?: string
  thumbnail_url?: string
}

/**
 * 首页
 * 展示最近的模型和场景卡片
 */
export function HomePage() {
  const [models, setModels] = useState<HomeModelItem[]>([])
  const [scenes, setScenes] = useState<HomeSceneItem[]>([])
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
        <Spin size="large" description="加载中..." />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 animate-fade-in">
      {/* 模型区域 */}
      <Section
        title="最近模型"
        count={models.length}
        linkTo="/models"
        icon={<Cube20 />}
        delay={0}
      >
        {models.length === 0 ? (
          <Empty description="还没有模型，去上传一个吧" className="animate-scale-in" />
        ) : (
          <Row gutter={[20, 20]}>
            {models.map((model, i) => (
              <Col key={model.id} xs={24} sm={12} md={8} lg={8}>
                <Link to={`/view/${model.id}?type=model`} className="no-underline">
                  <Card
                    hoverable
                    className="rounded-xl overflow-hidden card-hover-lift animate-fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                    cover={
                      model.thumbnail_url ? (
                        <div className="h-40 overflow-hidden bg-[--ant-color-fill-quaternary]">
                          <img
                            src={model.thumbnail_url}
                            alt={model.name}
                            className="w-full h-full object-cover thumb-zoom"
                          />
                        </div>
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
                      {model.file_format?.toUpperCase()} · {formatSize(model.file_size ?? 0)}
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
        delay={150}
      >
        {scenes.length === 0 ? (
          <Empty description="还没有场景，去创建一个吧" className="animate-scale-in" />
        ) : (
          <Row gutter={[20, 20]}>
            {scenes.map((scene, i) => (
              <Col key={scene.id} xs={24} sm={12} md={8} lg={8}>
                <Link to={`/scenes/${scene.id}/edit`} className="no-underline">
                  <Card
                    hoverable
                    className="rounded-xl overflow-hidden card-hover-lift animate-fade-in-up"
                    style={{ animationDelay: `${150 + i * 60}ms` }}
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
function Section({ title, count, linkTo, icon, children, className, delay = 0 }: {
  title: string
  count: number
  linkTo: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <div className={className}>
      <div
        className="flex justify-between items-center mb-5 animate-fade-in-up"
        style={{ animationDelay: `${delay}ms` }}
      >
        <Space size={8}>
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[--ant-color-primary-bg] text-[--ant-color-primary]">
            {icon}
          </span>
          <Title level={4} className="m-0">
            {title}
            <Text type="secondary" className="text-sm font-normal ml-2">
              ({count})
            </Text>
          </Title>
        </Space>
        <Link to={linkTo}>
          <Button type="link" icon={<ChevronRight20 />} iconPlacement="end">
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
