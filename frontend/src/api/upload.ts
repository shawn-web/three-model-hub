import apiClient from './client'

/** 通用文件上传 */
export async function uploadFile(formData: FormData) {
  const { data } = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  return data
}
