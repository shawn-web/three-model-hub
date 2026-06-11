import { useCallback, useEffect, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Layout as AntdLayout, Menu, Switch, ConfigProvider, theme as antdTheme } from 'antd'
import { SunOutlined, MoonOutlined } from '@ant-design/icons'
import { Home20, Cube20, LayerScene20, Image20, Location20 as GlobalOutlined } from './FluentIcon'
import { useThemeStore } from '../store/theme-store'
import { getThemeConfig } from '../theme'
import { QuestionCircleOutlined } from '@ant-design/icons'

const { Header, Content } = AntdLayout

/**
 * 导航菜单项配置
 */
const menuItems = [
  { key: '/', label: '首页', icon: <Home20 /> },
  { key: '/models', label: '模型管理', icon: <Cube20 /> },
  { key: '/scenes', label: '场景管理', icon: <LayerScene20 /> },
  { key: '/maps', label: '地图管理', icon: <GlobalOutlined /> },
  { key: '/resources', label: '资源管理', icon: <Image20 /> },
  { key: '/docs', label: '文档', icon: <QuestionCircleOutlined /> },
]

/**
 * 页面导航布局
 * 顶部导航栏 + 内容区域，支持暗色/亮色主题切换
 */
export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  /** 同步暗色模式 class 到 <html> */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  // 当前主题配置
  const themeConfig = useMemo(() => {
    const config = getThemeConfig(mode)
    return {
      ...config,
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    }
  }, [mode])

  // 菜单点击导航
  const handleMenuClick = useCallback(({ key }: { key: string }) => {
    navigate(key)
  }, [navigate])

  // 根据当前路径匹配选中的菜单项（支持子路径如 /docs/api 选中 /docs）
  const selectedKey = useMemo(() => {
    const path = location.pathname
    for (const item of menuItems) {
      if (path === item.key || path.startsWith(item.key + '/') || path.startsWith(item.key + '#')) {
        return item.key
      }
    }
    return '/'
  }, [location.pathname])

  // 主题切换
  const handleThemeSwitch = useCallback(() => {
    toggleTheme()
  }, [toggleTheme])

  return (
    <ConfigProvider theme={themeConfig}>
      <AntdLayout className="min-h-screen h-screen">
        {/* 顶部导航栏 */}
        <Header className="flex items-center px-6 sticky top-0 z-[100] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          {/* 站点标题 */}
          <div
            className="text-base font-bold text-[--ant-color-primary] mr-8 whitespace-nowrap cursor-pointer"
            onClick={() => navigate('/')}
          >
            3D 模型平台
          </div>

          {/* 导航菜单 */}
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
            className="flex-1 min-w-0 border-none"
          />

          {/* 主题切换开关 */}
          <Switch
            checked={mode === 'dark'}
            onChange={handleThemeSwitch}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
          />
        </Header>

        {/* 内容区域 */}
        <Content className="flex-1 overflow-auto">
          <Outlet />
        </Content>
      </AntdLayout>
    </ConfigProvider>
  )
}


