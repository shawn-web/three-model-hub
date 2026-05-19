import * as THREE from 'three'

export interface FitToViewOptions {
  padding?: number
  animated?: boolean
}

export function fitToView(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  object: THREE.Object3D,
  options: FitToViewOptions = {},
): void {
  const { padding = 1.2 } = options
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)))
  cameraZ *= padding

  const direction = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize()

  camera.position.copy(center).add(direction.multiplyScalar(cameraZ))
  controls.target.copy(center)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  controls.update()

  camera.near = maxDim / 100
  camera.far = maxDim * 100
  camera.updateProjectionMatrix()
}
