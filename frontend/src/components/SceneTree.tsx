/**
 * 场景模型结构树组件
 *
 * 以树形结构展示模型的层级关系，支持：
 * - 选中节点：选中构件并在 3D 视图中高亮和聚焦
 * - 勾选节点：控制构件的可见性
 * - 展开收起：浏览模型的层级结构
 * - 默认展开所有节点
 * - 节点右侧编辑按钮：弹出 Modal 编辑构件属性
 * - 节点右侧删除按钮：删除构件（支持 Delete 快捷键）
 */
import { useMemo, useCallback, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Tree, theme, Modal, Button } from 'antd'
import type { TreeProps, TreeDataNode } from 'antd'
import { Icon } from '@iconify/react'
import { settingsIcon, trash2Icon } from './Icons'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'
import type { EditComponentData } from '../store/edit-store'
import { ComponentProperties, type ComponentPropertiesRef } from './ComponentProperties'

/** 判断对象是否应在树形结构中显示 */
function shouldShowInTree(object: THREE.Object3D): boolean {
  if ((object as THREE.Object3D & { isMarker?: boolean }).isMarker) return false
  if (object.type === 'GridHelper' || object.type === 'BoxHelper') return false
  if (object.type.endsWith('Light')) return false
  if (object.type === 'ShadowMaterial') return false
  return true
}

/** 递归构建树形数据：将 Three.js Object3D 层级转为 Ant Design TreeDataNode */
function buildTreeData(object: THREE.Object3D, isRoot: boolean = false, editData?: Record<string, EditComponentData>): TreeDataNode[] {
  const getDisplayName = () => {
    if (isRoot) return '模型根节点'
    if (object.name?.startsWith('ModelWrapper_') && object.userData?.displayName) return object.userData.displayName
    const customName = editData?.[object.uuid]?.name
    if (customName) return customName
    return object.name || object.type
  }
  const displayName = getDisplayName()

  const node: TreeDataNode = {
    key: object.uuid,
    title: displayName,
  }

  if (object.children.length > 0) {
    node.children = object.children
      .filter(shouldShowInTree)
      .map((child) => buildTreeData(child, false, editData)[0])
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
  const sceneVersion = useEditStore((s) => s.sceneVersion)
  const setSelectedComponentId = useEditStore((s) => s.setSelectedComponentId)
  const editData = useEditStore((s) => s.editData)
  const activeTab = useEditStore((s) => s.activeTab)
  // 使用 uncheckedKeys 追踪用户取消勾选的节点，默认所有节点均勾选
  const [uncheckedKeys, setUncheckedKeys] = useState<Set<React.Key>>(new Set())
  // 展开的节点 keys（用户可以折叠/展开）
  const [userExpandedKeys, setUserExpandedKeys] = useState<React.Key[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [treeVersion, setTreeVersion] = useState(0)
  const { token } = theme.useToken()
  const treeRef = useRef<InstanceType<typeof Tree> | null>(null)
  const propsRef = useRef<ComponentPropertiesRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)

  // 根节点 key（不可删除）
  const rootKey = modelObject?.uuid ?? ''

  const treeData = useMemo<TreeDataNode[]>(() => {
    if (!modelObject) return []
    return buildTreeData(modelObject, true, editData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelObject, editData, treeVersion, sceneVersion])

  const allKeys = useMemo(() => {
    if (!modelObject) return []
    return collectAllKeys(modelObject)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelObject, treeVersion, sceneVersion])

  // 计算实际勾选的 keys = allKeys 中未被用户取消勾选的节点
  const checkedKeys = useMemo(() => allKeys.filter(k => !uncheckedKeys.has(k)), [allKeys, uncheckedKeys])
  // 展开的 keys：用户手动操作过则使用用户值，否则默认全部展开
  const expandedKeys = userExpandedKeys ?? allKeys

  // 监听容器高度变化，用于虚拟滚动
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
  }, [activeTab])

  /** 删除构件：从 Three.js 场景中移除并在 editData 中标记为已删除 */
  const handleDeleteNode = useCallback((uuid: string) => {
    if (!modelObject || uuid === rootKey) return
    const obj = modelObject.getObjectByProperty('uuid', uuid)
    if (!obj) return
    // 在 editData 中标记已删除，保存时会写入后端
    useEditStore.getState().deleteComponent(uuid, obj.name || null)
    // 从 Three.js 场景中移除
    obj.removeFromParent()
    if (selectedComponentId === uuid) {
      setSelectedComponentId(null)
    }
    setDeleteTarget(null)
    setTreeVersion((v) => v + 1)
  }, [modelObject, rootKey, selectedComponentId, setSelectedComponentId])

  /** Delete 快捷键删除选中构件 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' && selectedComponentId && selectedComponentId !== rootKey) {
        setDeleteTarget(selectedComponentId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedComponentId, rootKey])

  const handleSelect: TreeProps['onSelect'] = useCallback((keys) => {
    const key = keys[0] as string | undefined
    // 再次点击已选中的节点则取消选中
    if (!key || key !== selectedComponentId) {
      setSelectedComponentId(key ?? null)
    } else {
      setSelectedComponentId(null)
    }
  }, [setSelectedComponentId, selectedComponentId])

  const handleCheck: TreeProps['onCheck'] = useCallback((checked) => {
    const checkedKeysList = checked as React.Key[]
    // 计算取消勾选的 keys
    const newUnchecked = new Set<React.Key>(allKeys.filter(k => !checkedKeysList.includes(k)))
    setUncheckedKeys(newUnchecked)

    if (modelObject) {
      const visibleKeys = new Set<string>()

      const collectVisible = (nodes: TreeDataNode[]) => {
        for (const node of nodes) {
          const key = node.key as string
          if (checkedKeysList.includes(key)) {
            const addAllDescendants = (n: TreeDataNode) => {
              visibleKeys.add(n.key as string)
              if (n.children) n.children.forEach(addAllDescendants)
            }
            addAllDescendants(node)
          } else if (node.children) {
            collectVisible(node.children)
          }
        }
      }
      collectVisible(treeData)

      const containerKeys = new Set<string>()
      const collectContainers = (nodes: TreeDataNode[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            containerKeys.add(node.key as string)
            collectContainers(node.children)
          }
        }
      }
      collectContainers(treeData)

      modelObject.traverse((child) => {
        if (child === modelObject) return
        if (allKeys.includes(child.uuid)) {
          child.visible = containerKeys.has(child.uuid) || visibleKeys.has(child.uuid)
        }
      })
    }
  }, [modelObject, allKeys, treeData])

  /** 查找节点显示名 */
  const getNodeName = useCallback((uuid: string): string => {
    const find = (nodes: TreeDataNode[]): string => {
      for (const node of nodes) {
        if (node.key === uuid) return node.title as string
        if (node.children) {
          const r = find(node.children)
          if (r) return r
        }
      }
      return ''
    }
    return find(treeData)
  }, [treeData])

  /** 自定义树节点渲染：名称截断 + hover 显示编辑/删除按钮 */
  const titleRender = useCallback((nodeData: TreeDataNode) => {
    const isRoot = nodeData.key === rootKey
    // 按钮区域宽度：2个按钮 * 12px + 2个gap * 4px = 32px（非根节点），根节点只有1个按钮 = 16px
    const actionWidth = isRoot ? 16 : 32
    return (
      <span className="group/node" style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            maxWidth: `calc(100% - ${actionWidth}px)`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={nodeData.title as string}
        >
          {nodeData.title as string}
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation()
            setSelectedComponentId(nodeData.key as string)
            setEditingId(nodeData.key as string)
          }}
          className="cursor-pointer opacity-0 group-hover/node:opacity-100 transition-opacity"
          style={{ flexShrink: 0, color: token.colorTextSecondary, display: 'inline-flex' }}
        >
          <Icon icon={settingsIcon} width={12} />
        </span>
        {!isRoot && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              setSelectedComponentId(nodeData.key as string)
              setDeleteTarget(nodeData.key as string)
            }}
            className="cursor-pointer opacity-0 group-hover/node:opacity-100 transition-opacity"
            style={{ flexShrink: 0, color: token.colorError, display: 'inline-flex' }}
          >
            <Icon icon={trash2Icon} width={12} />
          </span>
        )}
      </span>
    )
  }, [setSelectedComponentId, token.colorTextSecondary, token.colorError, rootKey])

  if (!modelObject) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <style>{`
        .scene-model-tree .ant-tree-treenode {
          overflow: hidden;
        }
        .scene-model-tree .ant-tree-node-content-wrapper {
          min-width: 0;
          overflow: hidden;
        }
      `}</style>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <Tree
          ref={treeRef}
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={setUserExpandedKeys}
          selectedKeys={selectedComponentId ? [selectedComponentId] : []}
          checkedKeys={checkedKeys}
          onSelect={handleSelect}
          onCheck={handleCheck}
          checkable
          showIcon={false}
          blockNode
          virtual
          height={containerHeight}
          titleRender={titleRender}
          className="scene-model-tree"
          style={{ background: 'transparent', fontSize: 12, overflowX: 'hidden' }}
        />
      </div>

      <Modal
        title="编辑构件属性"
        open={editingId !== null}
        onCancel={() => setEditingId(null)}
        width={360}
        destroyOnHidden
        footer={[
          <Button key="cancel" size="small" onClick={() => setEditingId(null)}>
            取消
          </Button>,
          <Button key="save" type="primary" size="small" onClick={() => {
            propsRef.current?.save()
            setEditingId(null)
          }}>
            保存
          </Button>,
        ]}
      >
        <ComponentProperties ref={propsRef} />
      </Modal>

      <Modal
        title="确认删除"
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        width={320}
        footer={[
          <Button key="cancel" size="small" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>,
          <Button key="delete" type="primary" danger size="small" onClick={() => deleteTarget && handleDeleteNode(deleteTarget)}>
            删除
          </Button>,
        ]}
      >
        <p style={{ fontSize: 13 }}>
          确定要删除构件「{deleteTarget ? getNodeName(deleteTarget) : ''}」吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  )
}
