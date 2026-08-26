import { useRef, useState } from 'react'
import { subirVideoAgencia, subirThumbnailVideoAgencia } from '../../lib/supabase.js'

export const EMPTY_VIDEO_AGENCIA = {
  titulo: '', video_url: '', thumbnail_url: '', activo: true,
}

export default function VideoAgenciaForm({ form, setForm, error }) {
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [subiendoThumb, setSubiendoThumb] = useState(false)
  const videoRef = useRef()
  const thumbRef = useRef()

  async function handleVideo(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoVideo(true)
    const { url, error } = await subirVideoAgencia(archivo)
    if (error) console.error('Error al subir video:', error)
    else setForm(p => ({ ...p, video_url: url }))
    setSubiendoVideo(false)
  }

  async function handleThumbnail(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoThumb(true)
    const { url, error } = await subirThumbnailVideoAgencia(archivo)
    if (error) console.error('Error al subir miniatura:', error)
    else setForm(p => ({ ...p, thumbnail_url: url }))
    setSubiendoThumb(false)
  }

  return (
    <div className="space-y-3 text-sm">
      {error && <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Video *</label>
        <input ref={videoRef} type="file" accept="video/*" onChange={handleVideo} className="hidden" />
        {form.video_url ? (
          <div className="relative">
            <video src={form.video_url} controls className="w-full max-h-64 rounded-lg bg-black" style={{ aspectRatio: '9/16', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
            <button type="button" onClick={() => { setForm(p => ({ ...p, video_url: '' })); if (videoRef.current) videoRef.current.value = '' }}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">✕ Quitar</button>
          </div>
        ) : (
          <button type="button" onClick={() => videoRef.current?.click()} disabled={subiendoVideo}
            className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg py-6 text-gray-400 dark:text-zinc-500 text-sm hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-50">
            {subiendoVideo ? '⏳ Subiendo... (puede tardar según el tamaño)' : '🎬 Subir video (máx. 50MB)'}
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Miniatura (opcional)</label>
        <input ref={thumbRef} type="file" accept="image/*" onChange={handleThumbnail} className="hidden" />
        {form.thumbnail_url ? (
          <div className="relative w-28">
            <img src={form.thumbnail_url} alt="preview" className="w-28 rounded-lg" style={{ aspectRatio: '9/16', objectFit: 'cover' }} />
            <button type="button" onClick={() => { setForm(p => ({ ...p, thumbnail_url: '' })); if (thumbRef.current) thumbRef.current.value = '' }}
              className="absolute top-1 right-1 bg-black/60 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => thumbRef.current?.click()} disabled={subiendoThumb}
            className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium disabled:opacity-50">
            {subiendoThumb ? '⏳ Subiendo...' : '+ Agregar miniatura'}
          </button>
        )}
        <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">Si no cargás una, se muestra el video directamente como miniatura.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Título (opcional)</label>
        <input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
          className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-zinc-400">
        <input type="checkbox" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))}
          className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-400" />
        Visible en la Home
      </label>
    </div>
  )
}

export function datosDesdeFormVideo(form) {
  return {
    titulo: form.titulo.trim(),
    video_url: form.video_url.trim(),
    thumbnail_url: form.thumbnail_url.trim(),
    activo: form.activo,
  }
}
