import { useMemo, useCallback } from 'react'
import { Tree, Empty } from 'antd'
import type { TreeProps, TreeDataNode } from 'antd'
import { Eye20, EyeOff20 } from './FluentIcon'
import { useEditStore } from '../store/edit-store'
import type { EditComponentData } from '../store/edit-store'
import * as THREE from 'three'

/** 扩展 Object3D 类型，包含标点标记属性 */
interface MarkerObject3D extends THREE.Object3D {
  isMarker?: boolean
}

/**
 * 将 THREE.Object3D 层级结构转换为 antd Tree 所需的 treeData 格式
 * 递归遍历所有子节点，生成对应的树形数据
 */
function buildTreeData(
  object: THREE.Object3D,
  editData: Record<string, EditComponentData>,
  isRoot: boolean = false,
): TreeDataNode[] {
  const data = editData[object.uuid]
  const visible = data?.visible ?? object.visible
  const displayName = isRoot ? '整体模型' : (data?.name || object.name || object.type)

  const node: TreeDataNode = {
    key: object.uuid,
    title: displayName,
    // 在自定义渲染时通过 data- 属性传递可见性状态
    className: visible ? 'tree-node-visible' : 'tree-node-hidden',
    // 存储额外数据供渲染使用
    // @ts-expect-error antd TreeDataNode 允许扩展属性
    visible,
    isRoot,
  }

  if (object.children.length > 0) {
    node.children = object.children
      .filter((child) => !(child as MarkerObject3D).isMarker)
      .map((child) => buildTreeData(child, editData, false)[0])
      .filter(Boolean)
  }

  return [node]
}

export function ComponentTree() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const editData = useEditStore((s) => s.editData)
  const selectComponent = useEditStore((s) => s.selectComponent)
  const updateComponentVisibility = useEditStore((s) => s.updateComponentVisibility)

  // 根据模型对象和编辑数据生成树形数据
  const treeData = useMemo<TreeDataNode[]>(() => {
    if (!modelObject) return []
    return buildTreeData(modelObject, editData, true)
  }, [modelObject, editData])

  // 当前选中的节点（antd 需要字符串数组）
  const selectedKeys = useMemo(() => {
    return selectedComponentId ? [selectedComponentId] : []
  }, [selectedComponentId])

  /**
   * 处理节点选中事件
   * 根节点选中时取消选择（传入 null），子节点选中时传入对应 uuid
   */
  const handleSelect: TreeProps['onSelect'] = useCallback((keys) => {
    if (keys.length === 0) {
      // 取消选中
      selectComponent(null)
      return
    }
    const key = keys[0] as string
    // 判断是否为根节点
    const isRoot = modelObject?.uuid === key
    selectComponent(isRoot ? null : key)
  }, [selectComponent, modelObject])

  /**
   * 处理节点勾选事件（用于切换可见性）
   * 勾选 = 显示，取消勾选 = 隐藏
   */
  // 可见性切换在 titleRender 中通过点击图标实现

  /**
   * 自定义节点标题渲染
   * 在节点名称右侧显示可见性图标
   */
  const titleRender = useCallback((nodeData: TreeDataNode & { visible?: boolean; isRoot?: boolean }) => {
    const isRoot = nodeData.isRoot
    const visible = nodeData.visible !== false

    return (
      <span className="inline-flex items-center gap-1 w-full">
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {nodeData.title as string}
        </span>
        {!isRoot && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              // 手动触发可见性切换
              const key = nodeData.key as string
              const object = modelObject?.getObjectByProperty('uuid', key)
              if (!object) return
              const data = editData[key]
              const currentVisible = data?.visible ?? object.visible
              object.visible = !currentVisible
              updateComponentVisibility(key, !currentVisible)
            }}
            className="cursor-pointer text-xs"
            title={visible ? '隐藏' : '显示'}
          >
            {visible ? (
              <Eye20 size={14} color="var(--ant-color-primary)" />
            ) : (
              <EyeOff20 size={14} color="var(--ant-color-text-quaternary)" />
            )}
          </span>
        )}
      </span>
    )
  }, [modelObject, editData, updateComponentVisibility])

  if (!modelObject) {
    return (
      <div className="p-4">
        <Empty description="未加载模型" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  return (
    <Tree
      treeData={treeData}
      defaultExpandAll
      selectedKeys={selectedKeys}
      onSelect={handleSelect}
      showIcon={false}
      titleRender={titleRender}
      blockNode
    />
  )
}
