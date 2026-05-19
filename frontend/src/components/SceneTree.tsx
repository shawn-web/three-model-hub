/**
 * 场景模型结构树组件
 *
 * 以树形结构展示模型的层级关系，支持：
 * - 选中节点：选中构件并在 3D 视图中高亮和聚焦
 * - 勾选节点：控制构件的可见性
 * - 展开收起：浏览模型的层级结构
 * - 默认展开所有节点
 * - 与右侧属性面板联动
 */
import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { Tree, theme } from 'antd'
import type { TreeProps, TreeDataNode } from 'antd'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'

/** 判断对象是否应在树形结构中显示 */
function shouldShowInTree(object: THREE.Object3D): boolean {
  if ((object as any).isMarker) return false
  if (object.name?.startsWith('ModelWrapper_')) return false
  if (object.type === 'GridHelper' || object.type === 'BoxHelper') return false
  if (object.type.endsWith('Light')) return false
  if (object.type === 'ShadowMaterial') return false
  return true
}

/** 递归构建树形数据：将 Three.js Object3D 层级转为 Ant Design TreeDataNode */
function buildTreeData(object: THREE.Object3D, isRoot: boolean = false): TreeDataNode[] {
  const displayName = isRoot ? '模型根节点' : (object.name || object.type)

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

/** 递归收集所有节点的 UUID（用于默认展开和勾选） */
function collectAllKeys(object: THREE.Object3D): string[] {
  const keys: string[] = [object.uuid]
  object.children
    .filter(shouldShowInTree)
    .forEach((child) => keys.push(...collectAllKeys(child)))
  return keys
}

/** 场景模型结构树组件 */
export function SceneTree() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const setSelectedComponentId = useEditStore((s) => s.setSelectedComponentId)
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const { token } = theme.useToken()
  const treeRef = useRef<any>(null)

  const treeData = useMemo<TreeDataNode[]>(() => {
    if (!modelObject) return []
    return buildTreeData(modelObject, true)
  }, [modelObject])

  const allKeys = useMemo(() => {
    if (!modelObject) return []
    return collectAllKeys(modelObject)
  }, [modelObject])

  useEffect(() => {
    if (allKeys.length > 0 && checkedKeys.length === 0) {
      setCheckedKeys(allKeys)
      setExpandedKeys(allKeys)
    }
  }, [allKeys, checkedKeys.length])

  const handleSelect: TreeProps['onSelect'] = useCallback((keys) => {
    const key = keys[0] as string | undefined
    setSelectedComponentId(key ?? null)
  }, [setSelectedComponentId])

  const handleCheck: TreeProps['onCheck'] = useCallback((checked) => {
    const keys = checked as React.Key[]
    setCheckedKeys(keys)

    if (modelObject) {
      modelObject.traverse((child) => {
        if (allKeys.includes(child.uuid)) {
          child.visible = keys.includes(child.uuid)
        }
      })
    }
  }, [modelObject, allKeys])

  if (!modelObject) return null

  return (
    <Tree
      ref={treeRef}
      treeData={treeData}
      expandedKeys={expandedKeys}
      onExpand={setExpandedKeys}
      selectedKeys={selectedComponentId ? [selectedComponentId] : []}
      checkedKeys={checkedKeys}
      onSelect={handleSelect}
      onCheck={handleCheck}
      checkable
      showIcon={false}
      blockNode
      style={{ background: 'transparent', fontSize: 12 }}
    />
  )
}
