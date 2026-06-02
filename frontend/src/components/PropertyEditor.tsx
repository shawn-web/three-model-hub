import { useEditStore } from '../store/edit-store'
import * as THREE from 'three'
import type { Color } from 'antd/es/color-picker'
import {
  Form,
  Input,
  InputNumber,
  Slider,
  Switch,
  ColorPicker,
  Collapse,
  Divider,
  Typography,
  Space,
  Empty,
} from 'antd'
import { Target20, ArrowRotateClockwise20, ArrowMaximize20 } from './FluentIcon'

const { Text } = Typography

/** 将弧度转换为角度 */
const radToDeg = (rad: number) => (rad * 180) / Math.PI

/** 将角度转换为弧度 */
const degToRad = (deg: number) => (deg * Math.PI) / 180

/** 透明度滑块标记点 */
const opacityMarks: Record<number, string> = {
  0: '0%',
  0.5: '50%',
  1: '100%',
}

/** 变换轴配置 */
const AXIS_LABELS = ['X', 'Y', 'Z'] as const

export function PropertyEditor() {
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const modelObject = useEditStore((s) => s.modelObject)
  const editData = useEditStore((s) => s.editData)
  const updateComponentTransform = useEditStore((s) => s.updateComponentTransform)
  const updateComponentMaterial = useEditStore((s) => s.updateComponentMaterial)
  const updateComponentVisibility = useEditStore((s) => s.updateComponentVisibility)
  const updateComponentName = useEditStore((s) => s.updateComponentName)
  const updateComponentDescription = useEditStore((s) => s.updateComponentDescription)

  if (!selectedComponentId || !modelObject) {
    return (
      <div style={{ padding: '24px 8px', textAlign: 'center' }}>
        <Empty
          description="请选择一个构件以编辑属性"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ fontSize: 11 }}
        />
      </div>
    )
  }

  const obj = modelObject.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | undefined
  if (!obj) {
    return (
      <div style={{ padding: '24px 8px', textAlign: 'center' }}>
        <Empty
          description="未找到对应构件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ fontSize: 11 }}
        />
      </div>
    )
  }

  const data = editData[selectedComponentId]
  const position = data?.position ?? (obj.position.toArray() as [number, number, number])
  const rotation = data?.rotation ?? ([obj.rotation.x, obj.rotation.y, obj.rotation.z] as [number, number, number])
  const scale = data?.scale ?? (obj.scale.toArray() as [number, number, number])
  const color = data?.color
  const opacity = data?.opacity ?? 1
  const visible = data?.visible ?? obj.visible
  const name = data?.name ?? obj.name ?? ''
  const description = data?.description ?? ''

  /** 从 store 中获取当前选中的 Three.js 对象 */
  const getObj = () => modelObject.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | null

  /** 处理位置变更 */
  const handlePositionChange = (axis: number, value: number | null) => {
    const o = getObj()
    if (!o) return
    const v = value ?? 0
    const newPos = [...position] as [number, number, number]
    newPos[axis] = v
    o.position.set(...newPos)
    updateComponentTransform(selectedComponentId, { position: newPos })
  }

  /** 处理旋转变更（角度转弧度） */
  const handleRotationChange = (axis: number, value: number | null) => {
    const o = getObj()
    if (!o) return
    const v = value ?? 0
    const newRot = [...rotation] as [number, number, number]
    newRot[axis] = degToRad(v)
    o.rotation.set(...newRot)
    updateComponentTransform(selectedComponentId, { rotation: newRot })
  }

  /** 处理缩放变更 */
  const handleScaleChange = (axis: number, value: number | null) => {
    const o = getObj()
    if (!o) return
    const v = value ?? 1
    const newScale = [...scale] as [number, number, number]
    newScale[axis] = v
    o.scale.set(...newScale)
    updateComponentTransform(selectedComponentId, { scale: newScale })
  }

  /** 处理颜色变更 */
  const handleColorChange = (value: Color | string) => {
    const o = getObj()
    if (!o) return
    const hex = typeof value === 'string' ? value : value?.toHexString?.() || '#ffffff'
    o.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial
          if (!mat.userData._originalColor) {
            mat.userData._originalColor = '#' + mat.color.getHexString()
          }
          mat.color.set(hex)
        })
      }
    })
    updateComponentMaterial(selectedComponentId, { color: hex })
  }

  /** 处理透明度变更 */
  const handleOpacityChange = (value: number) => {
    const o = getObj()
    if (!o) return
    o.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((m) => {
          m.transparent = value < 1
          m.opacity = value
          m.needsUpdate = true
        })
      }
    })
    updateComponentMaterial(selectedComponentId, { opacity: value })
  }

  /** 处理可见性切换 */
  const handleVisibilityChange = (v: boolean) => {
    const o = getObj()
    if (!o) return
    o.visible = v
    updateComponentVisibility(selectedComponentId, v)
  }

  /** 处理名称变更 */
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const o = getObj()
    if (!o) return
    o.name = e.target.value
    updateComponentName(selectedComponentId, e.target.value || null)
  }

  /** 处理描述变更 */
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateComponentDescription(selectedComponentId, e.target.value || null)
  }

  /** 渲染变换轴输入行 */
  const renderAxisInputs = (
    values: [number, number, number],
    onChange: (axis: number, value: number | null) => void,
    step: number,
    formatValue: (v: number) => number,
  ) => (
    <div className="flex gap-2">
      {AXIS_LABELS.map((label, i) => (
        <div key={label} className="flex-1">
          <Text type="secondary" className="text-[11px]">{label}</Text>
          <InputNumber
            size="small"
            step={step}
            value={formatValue(values[i])}
            onChange={(v) => onChange(i, v)}
            className="w-full"
            controls={false}
          />
        </div>
      ))}
    </div>
  )

  /** 折叠面板配置 */
  const collapseItems = [
    {
      key: 'position',
      label: (
        <Space size={4}>
          <Target20 size={14} />
          <span>位置</span>
        </Space>
      ),
      children: renderAxisInputs(position, handlePositionChange, 0.1, (v) => parseFloat(v.toFixed(2))),
    },
    {
      key: 'rotation',
      label: (
        <Space size={4}>
          <ArrowRotateClockwise20 size={14} />
          <span>旋转 (度)</span>
        </Space>
      ),
      children: renderAxisInputs(rotation, handleRotationChange, 1, radToDeg),
    },
    {
      key: 'scale',
      label: (
        <Space size={4}>
          <ArrowMaximize20 size={14} />
          <span>缩放</span>
        </Space>
      ),
      children: renderAxisInputs(scale, handleScaleChange, 0.1, (v) => parseFloat(v.toFixed(2))),
    },
  ]

  return (
    <div className="py-3 px-4">
      {/* 标题 */}
      <div className="font-semibold text-[13px] mb-3 text-[--ant-color-primary]">
        {name || obj.type}
      </div>

      {/* 基本信息 */}
      <Form layout="vertical" size="small">
        {/* 名称 */}
        <Form.Item label={<Text type="secondary" className="text-[11px]">名称</Text>} className="mb-3">
          <Input
            value={name}
            placeholder={obj.type}
            onChange={handleNameChange}
          />
        </Form.Item>

        {/* 描述 */}
        <Form.Item label={<Text type="secondary" className="text-[11px]">描述</Text>} className="mb-3">
          <Input.TextArea
            value={description}
            placeholder="添加描述..."
            onChange={handleDescriptionChange}
            rows={2}
          />
        </Form.Item>
      </Form>

      <Divider className="my-2 mb-3" />

      {/* 变换属性（折叠面板） */}
      <Collapse
        size="small"
        ghost
        items={collapseItems}
        defaultActiveKey={['position', 'rotation', 'scale']}
        className="mb-3"
      />

      <Divider className="my-2 mb-3" />

      {/* 材质属性 */}
      <Form layout="vertical" size="small">
        {/* 颜色 */}
        <Form.Item label={<Text type="secondary" className="text-[11px]">颜色</Text>} className="mb-3">
          <ColorPicker
            value={color || '#ffffff'}
            onChangeComplete={handleColorChange}
            showText
          />
        </Form.Item>

        {/* 透明度 */}
        <Form.Item
          label={<Text type="secondary" className="text-[11px]">透明度: {(opacity * 100).toFixed(0)}%</Text>}
          className="mb-3"
        >
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={handleOpacityChange}
            marks={opacityMarks}
            tooltip={{ formatter: (v) => `${((v ?? 0) * 100).toFixed(0)}%` }}
          />
        </Form.Item>

        {/* 可见性 */}
        <Form.Item className="mb-0">
          <div className="flex items-center justify-between">
            <Text type="secondary" className="text-[11px]">可见</Text>
            <Switch
              size="small"
              checked={visible}
              onChange={handleVisibilityChange}
              checkedChildren="显示"
              unCheckedChildren="隐藏"
            />
          </div>
        </Form.Item>
      </Form>
    </div>
  )
}
