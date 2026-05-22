import axios from 'axios'
import apiClient from './client'

/**
 * 通用文件上传（图片、缩略图等）
 *
 * 流程：
 *   1. 通过 apiClient 从后端获取文件服务配置（URL、token、path 等）
 *   2. 用原生 axios 直传文件服务（避免 apiClient 默认 Content-Type: application/json 干扰）
 *   3. 解析文件服务返回的 resultUrl
 */
export async function uploadFile(file: File): Promise<{ url: string }> {
  // 1. 获取上传配置（复用模型上传的配置接口）
  const { data: config } = await apiClient.get('/models/upload/config')

  // 2. 用原生 axios 直传（自动处理 multipart/form-data Content-Type）
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', config.path)

  const uploadUrl = config.url.replace(/^https?:\/\/[^/]+/, '') || config.url

  const { data: respData } = await axios.post(uploadUrl, formData, {
    headers: {
      'token': config.token,
      'clientId': config.clientId,
      'passportId': config.passportId,
    },
    timeout: 300000,
  })

  // 3. 解析文件服务返回结果
  const inner = respData.data || respData
  const fileUrl = inner.resultUrl || inner.url
  if (!fileUrl) throw new Error('文件上传失败：未获取到文件 URL')

  return { url: fileUrl }
}
