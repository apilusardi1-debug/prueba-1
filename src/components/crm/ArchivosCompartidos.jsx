// Archivos compartidos del chat, como "Multimedia, enlaces y docs" de WhatsApp: fotos, videos y
// documentos que mandó el cliente o el equipo, agrupados por mes (lo más nuevo arriba). Sale de
// los mensajes ya cargados del chat, así que se actualiza solo cuando entra un archivo nuevo.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'

const BUCKET = 'whatsapp-media'
const TIPOS_MEDIA = ['image', 'video', 'sticker']

function tituloMes(fecha) {
  const d = new Date(fecha)
  const hoy = new Date()
  if (d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth()) return 'Este mes'
  const mes = d.toLocaleString('es-AR', { month: 'long' })
  return d.getFullYear() === hoy.getFullYear() ? mes : `${mes} ${d.getFullYear()}`
}

function agruparPorMes(lista) {
  const grupos = []
  for (const m of lista) {
    const titulo = tituloMes(m.created_at)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.titulo === titulo) ultimo.items.push(m)
    else grupos.push({ titulo, items: [m] })
  }
  return grupos
}

function quienEnvio(m) {
  return m.direccion === 'entrante' ? 'Cliente' : 'Nosotros'
}

export default function ArchivosCompartidos({ mensajes }) {
  const [abierto, setAbierto] = useState(false)
  const [pestana, setPestana] = useState('media')
  const [urls, setUrls] = useState({})

  const { media, docs } = useMemo(() => {
    const conArchivo = mensajes.filter(m => m.media_path).slice().reverse()
    return {
      media: conArchivo.filter(m => TIPOS_MEDIA.includes(m.tipo)),
      docs: conArchivo.filter(m => m.tipo === 'document'),
    }
  }, [mensajes])

  const lista = pestana === 'media' ? media : docs

  // Links firmados de a tandas, solo de lo que todavía no tiene link
  useEffect(() => {
    if (!abierto || !supabase) return
    const faltan = lista.map(m => m.media_path).filter(p => !urls[p])
    if (!faltan.length) return
    let cancelado = false
    supabase.storage.from(BUCKET).createSignedUrls(faltan, 3600).then(({ data }) => {
      if (cancelado || !data) return
      setUrls(prev => {
        const nuevas = { ...prev }
        for (const r of data) if (r.signedUrl) nuevas[r.path] = r.signedUrl
        return nuevas
      })
    })
    return () => { cancelado = true }
  }, [abierto, lista])

  useEffect(() => {
    if (!abierto) return
    const cerrarConEsc = e => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', cerrarConEsc)
    return () => window.removeEventListener('keydown', cerrarConEsc)
  }, [abierto])

  const total = media.length + docs.length

  return (
    <>
      <button
        onClick={() => { setPestana(media.length || !docs.length ? 'media' : 'docs'); setAbierto(true) }}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-zinc-700 px-4 py-3 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold">
          <svg className="w-5 h-5 text-gray-400 dark:text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-9 9" /></svg>
          Archivos compartidos
        </span>
        <span className="text-gray-400 dark:text-zinc-500">{total} ›</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAbierto(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex gap-1 rounded-full bg-gray-100 dark:bg-zinc-800 p-1">
                {[['media', `Fotos y videos (${media.length})`], ['docs', `Documentos (${docs.length})`]].map(([id, texto]) => (
                  <button
                    key={id}
                    onClick={() => setPestana(id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${pestana === id ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'}`}
                  >{texto}</button>
                ))}
              </div>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-xl text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!lista.length && (
                <p className="py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
                  {pestana === 'media' ? 'No se compartieron fotos ni videos en este chat.' : 'No se compartieron documentos en este chat.'}
                </p>
              )}
              {agruparPorMes(lista).map(grupo => (
                <div key={grupo.titulo} className="mb-5">
                  <p className="mb-2 text-sm font-semibold capitalize text-gray-700 dark:text-zinc-300">{grupo.titulo}</p>
                  {pestana === 'media' ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {grupo.items.map(m => {
                        const url = urls[m.media_path]
                        return (
                          <a
                            key={m.id}
                            href={url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${quienEnvio(m)} · ${new Date(m.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                            className="relative block aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800"
                          >
                            {url && m.tipo === 'video' && <video src={url} preload="metadata" muted className="h-full w-full object-cover" />}
                            {url && m.tipo !== 'video' && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                            {m.tipo === 'video' && <span className="absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">▶</span>}
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{quienEnvio(m)}</span>
                          </a>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {grupo.items.map(m => (
                        <a
                          key={m.id}
                          href={urls[m.media_path] || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-zinc-800 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700"
                        >
                          <span className="text-xl">📄</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900 dark:text-zinc-100">{m.media_nombre || 'Documento'}</span>
                            <span className="block text-xs text-gray-400 dark:text-zinc-500">
                              {quienEnvio(m)} · {new Date(m.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-gray-500 dark:text-zinc-400">Abrir</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
