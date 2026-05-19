import { useMemo, useCallback, useState, useEffect } from 'react'
import { Tree, theme } from 'antd'
import type { TreeProps, TreeDataNode } from 'antd'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'

/** 将 THREE.Object3D 层级结构转换为 antd Tree 数据 */
function buildTreeData(object: THREE.Object3D, isRoot: boolean = false): TreeDataNode[] {
  const displayName = isRoot ? '模型根节点' : (object.name || object.type)

  const node: TreeDataNode = {
    key: object.uuid,
    title: displayName,
  }

  if (object.children.length > 0) {
    node.children = object.children
      .filter((child) => !(child as any).isMarker)
      .map((child) => buildTreeData(child, false)[0])
      .filter(Boolean)
  }

  return [node]
}

/** 收集所有节点的 key */
function collectAllKeys(object: THREE.Object3D): string[] {
  const keys: string[] = [object.uuid]
  object.children
    .filter((child) => !(child as any).isMarker)
    .forEach((child) => keys.push(...collectAllKeys(child)))
  return keys
}

/**
 * 编辑器组件树面板
 * 支持可见性控制、点选高亮、展开折叠
 */
export function SceneTree() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const setSelectedComponentId = useEditStore((s) => s.setSelectedComponentId)
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])
  const { token } = theme.useToken()

  const treeData = useMemo<TreeDataNode[]>(() => {
    if (!modelObject) return []
    return buildTreeData(modelObject, true)
  }, [modelObject])

  const allKeys = useMemo(() => {
    if (!modelObject) return []
    return collectAllKeys(modelObject)
  }, [modelObject])

  // 首次加载时全选
  useEffect(() => {
    if (allKeys.length > 0 && checkedKeys.length === 0) {
      setCheckedKeys(allKeys)
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
        child.visible = keys.includes(child.uuid)
      })
    }
  }, [modelObject])

  if (!modelObject) return null

  return (
    <div style={{ padding: '4px 8px' }}>
      <div style={{
        padding: '8px 4px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: token.colorTextSecondary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}>
        模型结构
      </div>
      <Tree
        treeData={treeData}
        defaultExpandAll
        selectedKeys={selectedComponentId ? [selectedComponentId] : []}
        checkedKeys={checkedKeys}
        onSelect={handleSelect}
        onCheck={handleCheck}
        checkable
        showIcon={false}
        blockNode
        style={{ background: 'transparent', fontSize: 12, marginTop: 4 }}
      />
    </div>
  )
}
