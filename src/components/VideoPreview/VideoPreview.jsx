import { useRef, useState } from 'react'
import './VideoPreview.css'

export default function VideoPreview({ src, poster, label, playLabel = '播放精选视频', buttonLabel }) {
  const videoRef = useRef(null)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState('')
  const play = async () => {
    setError('')
    setStarted(true)
    try {
      await videoRef.current.play()
      videoRef.current.focus()
    } catch {
      setStarted(false)
      setError('暂时无法播放，可单独打开视频。')
    }
  }
  return (
    <div className={`videoPreview${started ? ' isStarted' : ''}`}>
      <video ref={videoRef} src={src} poster={poster} controls muted playsInline preload="none" aria-label={label} tabIndex={started ? 0 : -1} aria-hidden={!started} />
      {!started ? <button className="videoPreviewPlay" type="button" onClick={play} aria-label={buttonLabel || `播放：${label}`}><img src={poster} alt="" loading="lazy" /><span><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>{playLabel}</span></button> : null}
      {error ? <p className="videoPreviewError" role="status">{error}<a href={src} target="_blank" rel="noreferrer">打开视频 ↗</a></p> : null}
    </div>
  )
}
