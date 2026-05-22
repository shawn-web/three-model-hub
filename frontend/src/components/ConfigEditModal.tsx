/**
 * 场景配置编辑弹窗
 *
 * 使用 Monaco Editor 展示/编辑场景 JSON 配置，支持：
 * - 语法高亮和错误提示
 * - 应用配置到当前场景
 * - 下载配置为 .js 文件
 */
import { useState, useCallback, useRef } from 'react'
import { Modal, Button, message } from 'antd'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useEditStore } from '../store/edit-store'
import type { EditState, BackgroundConfig, EditComponentData } from '../store/edit-store'
import type { MarkerData } from '../types/edit-data'
import { collectSceneConfig, generateConfigFile, downloadConfigFile } from '../utils/scene-config'

/** 场景模型数据（与后端 SceneModel 对应） */
interface SceneModelItem {
  id: string
  model_id: string
  display_name?: string
  transform?: Record<string, unknown>
  visible?: boolean
}

/** collectSceneConfig 需要的 store 类型 */
type SceneConfigStore = EditState & {
  getCameraState?: () => {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up?: { x: number; y: number; z: number }
    fov?: number
  }
}

/** 解析后的场景配置数据结构 */
interface ParsedSceneConfig {
  background?: BackgroundConfig
  ambientIntensity?: number
  lightIntensity?: number
  lightColor?: string
  autoRotate?: boolean
  autoRotateAxis?: 'x' | 'y' | 'z'
  autoRotateSpeed?: number
  gridVisible?: boolean
  markers?: MarkerData[]
  components?: Record<string, EditComponentData>
  [key: string]: unknown
}

interface ConfigEditModalProps {
  open: boolean
  sceneName: string
  sceneModels: SceneModelItem[]
  onClose: () => void
}

export function ConfigEditModal({ open, sceneName, sceneModels, onClose }: ConfigEditModalProps) {
  /** Monaco Editor 中的 JSON 文本内容 */
  const [jsonText, setJsonText] = useState('')
  /** Monaco Editor 实例引用，用于获取最新值 */
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  /** 打开时从 store 收集配置并格式化为 JSON */
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) return
    const store = useEditStore.getState()
    const config = collectSceneConfig(store as SceneConfigStore, sceneModels)
    const formatted = JSON.stringify(config, null, 2)
    setJsonText(formatted)
  }, [sceneModels])

  /** 保存 Monaco Editor 实例引用 */
  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  /**
   * 尝试解析编辑器中的 JSON 文本
   * @returns 解析成功返回配置对象，失败返回 null 并提示错误
   */
  const tryParse = useCallback((): ParsedSceneConfig | null => {
    try {
      const text = editorRef.current?.getValue() ?? jsonText
      const parsed = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        message.error('配置必须是 JSON 对象')
        return null
      }
      return parsed as ParsedSceneConfig
    } catch (err) {
      message.error(`JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }, [jsonText])

  /**
   * 应用配置到 store
   *
   * 处理流程：
   * 1. 解析编辑器中的 JSON 配置
   * 2. 按字段逐一应用到 store（背景、灯光、旋转等）
   * 3. 标点数据按 id 合并：已有标点更新字段，新标点追加
   * 4. 构件编辑数据合并到 editData
   */
  const handleApply = useCallback(() => {
    const config = tryParse()
    if (!config) return

    const store = useEditStore.getState()

    // 应用背景配置（颜色/图片/天空盒）
    if (config.background) store.setBackgroundConfig(config.background)

    // 应用光照配置
    if (config.ambientIntensity != null) store.setAmbientIntensity(config.ambientIntensity)
    if (config.lightIntensity != null) store.setLightIntensity(config.lightIntensity)
    if (config.lightColor) store.setLightColor(config.lightColor)

    // 应用自动旋转配置
    if (config.autoRotate != null) store.setAutoRotate(config.autoRotate)
    if (config.autoRotateAxis) store.setAutoRotateAxis(config.autoRotateAxis)
    if (config.autoRotateSpeed != null) store.setAutoRotateSpeed(config.autoRotateSpeed)

    // 应用网格显示配置
    if (config.gridVisible != null) store.setGridVisible(config.gridVisible)

    // 合并标点数据：按 id 匹配，已有标点覆盖更新，新标点追加
    if (config.markers && Array.isArray(config.markers)) {
      const merged = [...store.markers]
      for (const em of config.markers) {
        const idx = merged.findIndex((m) => m.id === em.id)
        if (idx >= 0) {
          // 已有标点：合并字段（配置中的值覆盖原值）
          merged[idx] = { ...merged[idx], ...em }
        } else {
          // 新标点：直接追加
          merged.push(em)
        }
      }
      store.setMarkers(merged)
    }

    // 合并构件编辑数据（变换、材质、描述等）
    if (config.components && typeof config.components === 'object') {
      const existing = store.editData
      store.loadEditData({ ...existing, ...config.components })
    }

    message.success('配置已应用')
    onClose()
  }, [tryParse, onClose])

  /** 将编辑器中的配置生成为带注释的 .js 文件并下载 */
  const handleDownload = useCallback(() => {
    const config = tryParse()
    if (!config) return

    const content = generateConfigFile(config as ReturnType<typeof collectSceneConfig>, sceneName)
    downloadConfigFile(content, sceneName)
    message.success('配置文件已下载')
  }, [tryParse, sceneName])

  return (
    <Modal
      title="场景配置"
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnHidden
      afterOpenChange={handleOpenChange}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button onClick={handleDownload}>下载文件</Button>
          <Button type="primary" onClick={handleApply}>应用配置</Button>
        </div>
      }
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ height: '60vh' }}>
        <Editor
          language="json"
          theme="vs-dark"
          value={jsonText}
          onChange={(val) => setJsonText(val ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
          }}
        />
      </div>
    </Modal>
  )
}
