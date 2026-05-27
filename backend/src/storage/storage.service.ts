import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import * as crypto from 'crypto'
import * as path from 'path'
import FormData = require('form-data')

/** 上传进度回调类型 */
export type ProgressCallback = (percent: number) => void

/** 上传结果 */
export interface UploadResult {
  /** 文件访问 URL */
  url: string
  /** 文件在存储服务中的 key/fileName */
  fileKey: string
}

/**
 * 文件存储服务
 * 对接已有的文件上传服务，支持单文件和分片上传
 */
@Injectable()
export class StorageService {
  private readonly uploadUrl: string
  private readonly deleteUrl: string
  private readonly token: string
  private readonly basePath: string

  constructor(private configService: ConfigService) {
    const baseUrl = this.configService.get<string>('FILE_SERVICE_URL') || ''
    this.uploadUrl = baseUrl
    // 删除接口地址：从上传 URL 推导出服务根地址
    const urlObj = new URL(baseUrl)
    this.deleteUrl = `${urlObj.protocol}//${urlObj.host}/hz-file-upload/file/delete`
    this.token = this.configService.get<string>('FILE_SERVICE_TOKEN') || ''
    this.basePath = this.configService.get<string>('FILE_SERVICE_PATH') || 'libs/model'
  }

  /**
   * 上传文件到文件服务
   * @param fileBuffer 文件二进制数据
   * @param fileName 文件名
   * @param subPath 子路径（可选，如模型ID）
   * @param onProgress 上传进度回调（0-100）
   * @param customBasePath 自定义基础路径（可选，覆盖默认 basePath）
   * @returns 上传结果（URL、fileKey）
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    subPath?: string,
    onProgress?: ProgressCallback,
    customBasePath?: string,
  ): Promise<UploadResult> {
    const basePath = customBasePath || this.basePath
    const uploadPath = subPath
      ? `${basePath}/${subPath}`
      : basePath

    const formData = new FormData()

    // 文件服务不支持中文文件名，非 ASCII 时生成纯 ASCII 安全名称（保留扩展名）
    const safeFileName = /[^\x00-\x7F]/.test(fileName)
      ? `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${path.extname(fileName).toLowerCase()}`
      : fileName

    // 根据文件扩展名设置正确的 MIME 类型（文件服务会校验）
    const ext = path.extname(fileName).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp', '.ico': 'image/x-icon',
      '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
      '.pdf': 'application/pdf',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    formData.append('file', fileBuffer, { filename: safeFileName, contentType })
    formData.append('path', uploadPath)

    let response: any
    try {
      response = await axios.post(this.uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'token': this.token,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (e) => {
          if (e.total && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        },
      })
    } catch (err: any) {
      const status = err?.response?.status
      const data = err?.response?.data
      console.error('[StorageService] 文件上传请求失败:', {
        status,
        data,
        message: err?.message,
        uploadPath,
        fileName,
      })
      throw new Error(`文件上传失败：文件服务返回错误 (${status || '未知'}) - ${typeof data === 'string' ? data : JSON.stringify(data)}`)
    }

    // 文件服务返回结构：{ statusCode: "200", data: { resultUrl: "https://...", fileName: "xxx" } }
    console.log('[StorageService] 上传响应:', JSON.stringify(response.data))
    if (response.data) {
      const data = response.data
      // 检查业务错误码（文件服务 HTTP 200 但业务可能失败）
      if (data.statusCode && data.statusCode !== '200') {
        throw new Error(`文件上传失败：${data.statusMessage || '未知错误'}`)
      }
      const innerData = data.data || data

      const url = innerData.resultUrl || innerData.url
      if (url) {
        const fileKey = innerData.fileName || innerData.fileKey || this.extractFileNameFromUrl(url)
        return { url, fileKey }
      }
      if (typeof data === 'string') {
        const fileKey = this.extractFileNameFromUrl(data)
        return { url: data, fileKey }
      }
    }

    console.error('[StorageService] 文件上传响应解析失败:', JSON.stringify(response.data))
    throw new Error('文件上传失败：未获取到文件 URL')
  }

  /**
   * 删除文件
   * @param fileName 文件名
   */
  async deleteFile(fileName: string): Promise<void> {
    await axios.delete(this.deleteUrl, {
      params: { bucket: 'huazhu', fileName },
      headers: {
        'token': this.token,
      },
    })
  }

  /** 从 URL 中提取文件名 */
  private extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const parts = urlObj.pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] || ''
    } catch {
      return url.split('/').pop() || ''
    }
  }

  /** 获取上传配置，供前端直传文件服务使用 */
  getUploadConfig() {
    return {
      url: this.uploadUrl,
      token: this.token,
      path: this.basePath,
      clientId: this.configService.get<string>('FILE_SERVICE_CLIENT_ID') || '1001',
      passportId: this.configService.get<string>('FILE_SERVICE_PASSPORT_ID') || '',
    }
  }

  /** 计算文件 SHA256 哈希 */
  calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  /** 检测文件格式 */
  detectFormat(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase().replace('.', '')
    return ext || 'glb'
  }
}
