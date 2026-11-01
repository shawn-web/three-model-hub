/**
 * GLTFLoader 的 Meshopt 扩展注册
 *
 * 后端压缩生成的 GLB 启用了 EXT_meshopt_compression（几何压缩），
 * 前端 GLTFLoader 必须先调用 setMeshoptDecoder 才能解析，
 * 否则抛 "setMeshoptDecoder must be called before loading compressed files"。
 *
 * three 自带 MeshoptDecoder（WASM），无需额外装包。
 * decoder 是 WASM 实例，初始化有成本，全局只创建一次后复用。
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/** 单例 decoder（WASM 初始化只跑一次） */
let decoderReady = false

/**
 * 给 GLTFLoader 实例注册 MeshoptDecoder。
 * 加载压缩模型前必须调用。
 */
export function configureMeshopt(loader: GLTFLoader): GLTFLoader {
  if (!decoderReady) {
    loader.setMeshoptDecoder(MeshoptDecoder)
    decoderReady = true
  } else {
    loader.setMeshoptDecoder(MeshoptDecoder)
  }
  return loader
}