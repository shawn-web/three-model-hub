import { useRef, useState, useMemo, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { AnnotationData } from '../api/annotations'

interface AnnotationSpriteProps {
  /** 批注数据 */
  annotation: AnnotationData
  /** 在列表中的序号，用于编号显示 */
  index: number
  /** 模型包围盒尺寸，用于缩放计算 */
  modelExtent: number
  /** 点击批注时的回调 */
  onClick?: (annotation: AnnotationData) => void
}

/**
 * 批注精灵组件
 * 在 3D 空间中渲染带编号的圆形批注标记
 * 点击后展开显示批注文本内容
 */
export function AnnotationSprite({ annotation, index, modelExtent, onClick }: AnnotationSpriteProps) {
  const spriteRef = useRef<THREE.Sprite>(null)
  const { camera } = useThree()
  const [expanded, setExpanded] = useState(false)

  /** 根据相机距离动态调整缩放，保持屏幕上大小一致 */
  useFrame(() => {
    if (!spriteRef.current) return
    const pos = new THREE.Vector3(
      annotation.position.x,
      annotation.position.y,
      annotation.position.z,
    )
    const dist = camera.position.distanceTo(pos)
    const baseScale = Math.max(modelExtent * 0.015, 0.05)
    const screenScale = baseScale * dist * 0.12
    spriteRef.current.scale.setScalar(Math.max(screenScale, 0.01))
  })

  /** 生成带编号的圆形画布纹理 */
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!

    // 绘制圆形背景
    ctx.beginPath()
    ctx.arc(32, 32, 28, 0, Math.PI * 2)
    ctx.fillStyle = '#ff6b35'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()

    // 绘制编号文字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = String(index + 1)
    ctx.fillText(label, 32, 33)

    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [index])

  const position = useMemo(
    () => new THREE.Vector3(annotation.position.x, annotation.position.y, annotation.position.z),
    [annotation.position],
  )

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
    onClick?.(annotation)
  }, [annotation, onClick])

  return (
    <group>
      <sprite ref={spriteRef} position={position} onClick={handleClick}>
        <spriteMaterial
          map={texture}
          transparent
          depthTest={false}
          sizeAttenuation={false}
        />
      </sprite>
      {expanded && (
        <Html position={position} center style={{ pointerEvents: 'auto' }}>
          <div className="bg-[rgba(20,20,30,0.92)] text-white py-[10px] px-[14px] rounded-lg text-[13px] max-w-[280px] leading-normal shadow-[0_2px_12px_rgba(0,0,0,0.5)] border border-[rgba(255,107,53,0.5)] select-none relative -mt-[40px]">
            {annotation.author && (
              <div className="text-[11px] text-[#aaa] mb-1">
                {annotation.author}
              </div>
            )}
            <div>{annotation.text}</div>
            <div
              onClick={() => setExpanded(false)}
              className="absolute top-1 right-2 cursor-pointer text-[#aaa] text-xs"
            >
              x
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
