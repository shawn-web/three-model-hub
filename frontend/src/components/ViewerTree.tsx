import { useMemo, useCallback, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Tree } from 'antd'
import type { TreeProps, TreeDataNode } from 'antd'
import { Icon } from '@iconify/react'
import { panelLeftIcon, panelLeftCloseIcon } from './Icons'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import { useSceneStore } from '../store/scene-store'

/** 判断对象是否应在树形结构中显示 */
function shouldShowInTree(object: THREE.Object3D): boolean {
  if ((object as THREE.Object3D & { isMarker?: boolean }).isMarker) return false
  if (object.type === 'GridHelper' || object.type === 'BoxHelper') return false
  if (object.type.endsWith('Light')) return false
  if (object.type === 'ShadowMaterial') return false
  return true
}

/** 将 THREE.Object3D 层级结构转换为 antd Tree 数据 */
function buildTreeData(object: THREE.Object3D, isRoot: boolean = false): TreeDataNode[] {
  const displayName = isRoot ? '模型' : (object.name || object.type)

  const node: TreeDataNode = {
    key: object.uuid,
    title: displayName,
  }

  if (object.children.length > 0) {
    node.children = object.children
      .filter(shouldShowInTree)
      .map((child) => buildTreeData(child, false)[0])
      .filter(Boolean)
  }

  return [node]
}

/**
 * 预览页模型树面板
 * 显示模型层级结构，支持点选高亮、多选、折叠
 */
export function ViewerTree() {
  const modelObject = useViewerStore((s) => s.modelObject)
  const treeVisible = useViewerStore((s) => s.treeVisible)
  const selectedComponentId = useSceneStore((s) => s.selectedComponentId)
  const [collapsed, setCollapsed] = useState(false)
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateHeight = () => {
      const h = el.clientHeight
      if (h > 0) setContainerHeight(h)
    }
    updateHeight()
    const observer = new ResizeObserver(() => updateHeight())
    observer.observe(el)
    return () => observer.disconnect()
  }, [collapsed])

  const treeData = useMemo<TreeDataNode[]>(() => {
    if (!modelObject) return []
    return buildTreeData(modelObject, true)
  }, [modelObject])

  /** 收集所有树节点 key（包括父节点和叶子节点） */
  const allKeys = useMemo(() => {
    const keys: string[] = []
    const collect = (nodes: TreeDataNode[]) => {
      for (const node of nodes) {
        keys.push(node.key as string)
        if (node.children) collect(node.children)
      }
    }
    if (treeData.length > 0) collect(treeData)
    return keys
  }, [treeData])

  /** allKeys 的 Set 版本，用于 O(1) 查找 */
  const allKeysSet = useMemo(() => new Set(allKeys), [allKeys])

  /** 首次加载时全选并确保所有模型子对象 visible = true */
  useEffect(() => {
    if (allKeys.length > 0 && checkedKeys.length === 0) {
      // 使用 setTimeout 将 setState 从 effect 同步执行上下文中移出
      const timer = setTimeout(() => {
        setCheckedKeys(allKeys)
      }, 0)
      if (modelObject) {
        modelObject.traverse((child) => { child.visible = true })
      }
      return () => clearTimeout(timer)
    }
  }, [allKeys, checkedKeys.length, modelObject])

  /** 反向同步：3D 视口选择时，树也高亮对应节点 */
  // 使用 useMemo 派生 selectedKeys，避免 effect 内 setState
  const derivedSelectedKeys = useMemo(() => {
    return selectedComponentId ? [selectedComponentId] : []
  }, [selectedComponentId])

  const handleSelect: TreeProps['onSelect'] = useCallback((keys) => {
    const key = keys[0] as string | undefined
    useSceneStore.getState().selectComponent(key ?? null)
  }, [])

  const handleCheck: TreeProps['onCheck'] = useCallback((checked) => {
    const checkedKeysList = checked as React.Key[]
    setCheckedKeys(checkedKeysList)

    if (modelObject) {
      const checkedSet = new Set<string>(checkedKeysList.map(String))
      const visibleKeys = new Set<string>()

      // 返回该层级是否有可见节点，有可见子节点时父节点也必须可见
      const collectVisible = (nodes: TreeDataNode[]): boolean => {
        let anyVisible = false
        for (const node of nodes) {
          const key = node.key as string
          if (checkedSet.has(key)) {
            const addAllDescendants = (n: TreeDataNode) => {
              visibleKeys.add(n.key as string)
              if (n.children) n.children.forEach(addAllDescendants)
            }
            addAllDescendants(node)
            anyVisible = true
          } else if (node.children) {
            if (collectVisible(node.children)) {
              visibleKeys.add(key)
              anyVisible = true
            }
          }
        }
        return anyVisible
      }
      collectVisible(treeData)

      modelObject.traverse((child) => {
        if (child === modelObject) return
        if (allKeysSet.has(child.uuid)) {
          child.visible = visibleKeys.has(child.uuid)
        }
      })
    }
  }, [modelObject, allKeysSet, treeData])

  if (!modelObject || !treeVisible) return null

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 50,
      transition: 'all 0.3s ease',
    }}>
      {/* 折叠状态下显示小按钮 */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          title="展开模型树"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(20, 20, 30, 0.9)',
            backdropFilter: 'blur(12px)',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(40, 40, 55, 0.95)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(20, 20, 30, 0.9)' }}
        >
          <Icon icon={panelLeftIcon} width={16} height={16} />
        </button>
      ) : (
        /* 展开状态：完整面板 */
        <div style={{
          width: 240,
          maxHeight: 'calc(100vh - 100px)',
          background: 'rgba(20, 20, 30, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
          className="custom-scrollbar"
        >
          {/* 标题栏 + 折叠按钮 */}
          <div style={{
            padding: '8px 8px 8px 12px',
            fontSize: 13,
            fontWeight: 600,
            color: '#ddd',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>模型结构</span>
            <button
              onClick={() => setCollapsed(true)}
              title="收起模型树"
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'transparent' }}
            >
              <Icon icon={panelLeftCloseIcon} width={14} height={14} />
            </button>
          </div>
          <div style={{ padding: '4px 8px', flex: 1, minHeight: 0, overflow: 'hidden' }} className="custom-scrollbar">
            <div ref={containerRef} style={{ height: '100%' }}>
            <Tree
              treeData={treeData}
              defaultExpandAll
              selectedKeys={derivedSelectedKeys}
              checkedKeys={checkedKeys}
              onSelect={handleSelect}
              onCheck={handleCheck}
              checkable
              showIcon={false}
              blockNode
              virtual
              height={containerHeight}
              style={{ background: 'transparent', color: '#ccc', fontSize: 12 }}
            />
            </div>
          </div>
        </div>
      )}

      {/* 动画 keyframes 通过内联样式注入 */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .custom-scrollbar .ant-tree { background: transparent !important; color: #ccc; }
        .custom-scrollbar .ant-tree-node-content-wrapper { border-radius: 4px; }
        .custom-scrollbar .ant-tree-node-content-wrapper:hover { background: rgba(255,255,255,0.08) !important; }
        .custom-scrollbar .ant-tree-node-content-wrapper.ant-tree-node-selected { background: rgba(74,158,255,0.2) !important; }
        .custom-scrollbar .ant-tree-checkbox-inner { background: transparent; border-color: rgba(255,255,255,0.3); }
        .custom-scrollbar .ant-tree-checkbox-checked .ant-tree-checkbox-inner { background: #4a9eff; border-color: #4a9eff; }
        .custom-scrollbar .ant-tree-checkbox-indeterminate .ant-tree-checkbox-inner { background: transparent; border-color: #4a9eff; }
        .custom-scrollbar .ant-tree-checkbox-indeterminate .ant-tree-checkbox-inner::after { background: #4a9eff; }
        .custom-scrollbar .ant-tree-treenode-disabled .ant-tree-node-content-wrapper { color: rgba(255,255,255,0.35); }
      `}</style>
    </div>
  )
}
