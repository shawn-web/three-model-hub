import * as THREE from 'three'

export interface FitToViewOptions {
  padding?: number
  animated?: boolean
  direction?: THREE.Vector3
}

export function fitToView(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  object: THREE.Object3D,
  options: FitToViewOptions = {},
): void {
  const { padding = 1.2, direction } = options
  const box = new THREE.Box3().setFromObject(object)

  // 处理空包围盒（模型无几何体）
  if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.max.x)) {
    const dir = direction?.clone().normalize() || new THREE.Vector3(1, 1, 1).normalize()
    camera.position.copy(dir.multiplyScalar(10))
    controls.target.set(0, 0, 0)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    controls.update()
    camera.near = 0.01
    camera.far = 1000
    camera.updateProjectionMatrix()
    return
  }

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)))
  cameraZ *= padding

  const dir = direction?.clone().normalize() || new THREE.Vector3().subVectors(camera.position, controls.target).normalize()

  camera.position.copy(center).add(dir.multiplyScalar(cameraZ))
  controls.target.copy(center)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  controls.update()

  camera.near = maxDim / 100
  camera.far = maxDim * 100
  camera.updateProjectionMatrix()
}
