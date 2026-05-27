import { useEffect, useRef, useState } from 'react'
import { Video20 } from './FluentIcon'

interface VideoThumbnailProps {
  url: string
  /** 截取第几秒的帧 */
  seekTime?: number
  className?: string
  fallbackSize?: number
}

/**
 * 视频缩略图组件
 * 通过 canvas 截取视频帧生成缩略图
 */
export function VideoThumbnail({ url, seekTime = 1, className, fallbackSize = 40 }: VideoThumbnailProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    const video = document.createElement('video')
    videoRef.current = video
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.src = url

    const cleanup = () => {
      video.pause()
      video.src = ''
      video.load()
      videoRef.current = null
    }

    const captureFrame = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 180
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        if (!cancelled) setThumbUrl(dataUrl)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    video.addEventListener('loadeddata', () => {
      if (cancelled) return
      if (video.duration > 0 && seekTime > 0 && seekTime < video.duration) {
        video.currentTime = seekTime
      } else {
        captureFrame()
      }
    })

    video.addEventListener('seeked', () => {
      if (cancelled) return
      captureFrame()
    })

    video.addEventListener('error', () => {
      if (!cancelled) setError(true)
    })

    video.load()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [url, seekTime])

  if (error || !thumbUrl) {
    return (
      <div className="flex-col items-center gap-1" style={{ display: 'flex' }}>
        <Video20 size={fallbackSize} color="var(--ant-color-text-tertiary)" />
      </div>
    )
  }

  return <img src={thumbUrl} className={className} alt="视频缩略图" />
}
