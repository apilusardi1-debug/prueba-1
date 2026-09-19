import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

const BUCKET = 'whatsapp-media'
const ETIQUETAS_AUTOMATICAS = ['Imagen', 'Audio', 'Video', 'Documento', 'Sticker']

// El texto de un mensaje con archivo es la etiqueta automática ("Imagen",
// "Documento: x.pdf") salvo que el cliente haya escrito un pie de foto: la
// etiqueta sobra debajo del archivo, el pie de foto no.
export function textoVisible(msg) {
  if (!msg.tipo || msg.tipo === 'texto') return msg.texto
  const t = msg.texto || ''
  if (ETIQUETAS_AUTOMATICAS.includes(t) || t.startsWith('Documento: ')) return ''
  return t
}

export default function MediaMensaje({ msg }) {
  const [url, setUrl] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!msg.media_path || !supabase) return
    let cancelado = false
    supabase.storage.from(BUCKET).createSignedUrl(msg.media_path, 3600).then(({ data, error }) => {
      if (cancelado) return
      if (error || !data?.signedUrl) setFallo(true)
      else setUrl(data.signedUrl)
    })
    return () => { cancelado = true }
  }, [msg.media_path])

  if (!msg.media_path || fallo) {
    return <p className="text-xs italic text-gray-400 dark:text-zinc-400">No se pudo cargar el archivo ({msg.texto || msg.tipo})</p>
  }
  if (!url) return <p className="text-xs text-gray-400 dark:text-zinc-400">Cargando archivo...</p>

  if (msg.tipo === 'image' || msg.tipo === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={msg.texto || 'Imagen'} className={`rounded-lg max-w-full ${msg.tipo === 'sticker' ? 'max-h-32' : 'max-h-72'}`} />
      </a>
    )
  }
  if (msg.tipo === 'audio') {
    return <audio controls src={url} className="w-64 max-w-full" />
  }
  if (msg.tipo === 'video') {
    return <video controls src={url} className="rounded-lg max-w-full max-h-72" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/10 px-3 py-2 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/20"
    >
      <span className="truncate">{msg.media_nombre || 'Documento'}</span>
      <span className="text-xs opacity-70 shrink-0">Abrir</span>
    </a>
  )
}
