import { useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout as AntdLayout, Menu } from 'antd'
import {
  BookOutlined,
  FileTextOutlined,
  CodeOutlined,
  RocketOutlined,
  BugOutlined,
  ToolOutlined,
  HistoryOutlined,
} from '@ant-design/icons'

// import.meta.glob 在编译时将 ../docs/*.md 以原始文本内联到 bundle
const docModules = import.meta.glob<string>('../docs/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const { Sider, Content } = AntdLayout

const docs = [
  { key: 'readme', label: '项目介绍', icon: <BookOutlined />, file: 'readme.md' },
  { key: 'changelog', label: '更新日志', icon: <HistoryOutlined />, file: 'changelog.md' },
  { key: 'api', label: 'API 文档', icon: <CodeOutlined />, file: 'api.md' },
  { key: 'architecture', label: '架构文档', icon: <FileTextOutlined />, file: 'architecture.md' },
  { key: 'development', label: '开发指南', icon: <ToolOutlined />, file: 'development.md' },
  { key: 'testing', label: '测试指南', icon: <BugOutlined />, file: 'testing.md' },
  { key: 'deployment', label: '部署文档', icon: <RocketOutlined />, file: 'deployment.md' },
  { key: 'contributing', label: '贡献指南', icon: <CodeOutlined />, file: 'contributing.md' },
] as const

function getRaw(file: string): string {
  return docModules[`../docs/${file}`] ?? ''
}

/**
 * 文档阅读页面
 * 左侧目录 + 右侧 Markdown 渲染
 * 支持 /docs、/docs/api 等 URL 路径
 */
export function DocsPage() {
  const { name } = useParams<{ name?: string }>()
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)

  // name 为空 → 默认 readme
  const entry = useMemo(() => {
    const key = name ?? 'readme'
    return docs.find((d) => d.key === key) ?? docs[0]
  }, [name])

  const raw = getRaw(entry.file)

  // 切换文档时滚动到顶部
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [entry.key])

  const menuItems = docs.map((d) => ({
    key: d.key,
    label: d.label,
    icon: d.icon,
  }))

  return (
    <AntdLayout className="h-full docs-page">
      <Sider width={240} className="docs-sider" theme="light">
        <div className="docs-sider-title">项目文档</div>
        <Menu
          mode="inline"
          selectedKeys={[entry.key]}
          items={menuItems}
          onClick={({ key }) => navigate(`/docs/${key}`)}
          className="docs-sider-menu"
        />
      </Sider>
      <Content ref={contentRef} className="docs-content">
        <div className="docs-body">
          <Markdown remarkPlugins={[remarkGfm]}>{raw}</Markdown>
        </div>
      </Content>
    </AntdLayout>
  )
}
