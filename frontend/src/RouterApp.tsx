import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ModelsPage } from './pages/ModelsPage'
import { ScenesPage } from './pages/ScenesPage'
import { SceneEditorPage } from './pages/SceneEditorPage'
import { ViewerPage } from './pages/ViewerPage'
import { IframePage } from './pages/IframePage'
import { ResourcesPage } from './pages/ResourcesPage'
import { DocsPage } from './pages/DocsPage'

/**
 * 应用根组件
 * 配置所有页面路由
 */
export function RouterApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 带导航栏的页面 */}
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/scenes" element={<ScenesPage />} />
          <Route path="/scenes/:id/edit" element={<SceneEditorPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/:name" element={<DocsPage />} />
        </Route>

        {/* 全屏预览页（不带导航栏） */}
        <Route path="/view/:sceneId" element={<ViewerPage />} />
        <Route path="/iframe/:sceneId" element={<IframePage />} />
      </Routes>
    </BrowserRouter>
  )
}
