import { useState, useEffect } from 'react'
import { agenciaVideosApi } from '../../lib/supabase.js'
import VideoAgenciaForm, { EMPTY_VIDEO_AGENCIA, datosDesdeFormVideo } from '../../components/admin/VideoAgenciaForm.jsx'

export default function Videos() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState(null) // null | id
  const [form, setForm] = useState(EMPTY_VIDEO_AGENCIA)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [aBorrar, setABorrar] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data, error } = await agenciaVideosApi.getAllAdmin()
      if (!error && data) setVideos(data)
    } catch (_) {}
    setLoading(false)
  }

  function abrirCrear() {
    setForm(EMPTY_VIDEO_AGENCIA)
    setError(null)
    setCreando(true)
  }

  function abrirEditar(v) {
    setForm({ titulo: v.titulo || '', video_url: v.video_url || '', thumbnail_url: v.thumbnail_url || '', activo: v.activo })
    setError(null)
    setEditando(v.id)
  }

  function cerrarModal() {
    setCreando(false)
    setEditando(null)
  }

  async function guardar() {
    if (!form.video_url) {
      setError('Subí un video antes de guardar.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      if (creando) {
        const orden = videos.length ? Math.max(...videos.map(v => v.orden)) + 1 : 0
        const { data, error } = await agenciaVideosApi.create({ ...datosDesdeFormVideo(form), orden })
        if (error) throw error
        if (data) setVideos(prev => [...prev, data])
      } else {
        const { data, error } = await agenciaVideosApi.update(editando, datosDesdeFormVideo(form))
        if (error) throw error
        if (data) setVideos(prev => prev.map(v => v.id === editando ? data : v))
      }
      cerrarModal()
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'intentá de nuevo'))
    }
    setGuardando(false)
  }

  async function eliminar() {
    if (!aBorrar) return
    try {
      await agenciaVideosApi.delete(aBorrar.id)
      setVideos(prev => prev.filter(v => v.id !== aBorrar.id))
    } catch (_) {}
    setABorrar(null)
  }

  async function mover(idx, direccion) {
    const destino = idx + direccion
    if (destino < 0 || destino >= videos.length) return
    const actual = videos[idx]
    const vecino = videos[destino]
    const nuevaLista = [...videos]
    nuevaLista[idx] = vecino
    nuevaLista[destino] = actual
    setVideos(nuevaLista)
    try {
      await Promise.all([
        agenciaVideosApi.update(actual.id, { orden: vecino.orden }),
        agenciaVideosApi.update(vecino.id, { orden: actual.orden }),
      ])
    } catch (_) {
      cargar()
    }
  }

  async function toggleActivo(v) {
    const { data, error } = await agenciaVideosApi.update(v.id, { activo: !v.activo })
    if (!error && data) setVideos(prev => prev.map(x => x.id === v.id ? data : x))
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando videos...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Videos</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Videos propios de la agencia para la sección de reels de la Home</p>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 dark:bg-brand-500 text-white hover:bg-brand-700 dark:hover:bg-brand-600 shadow-sm transition-colors">
          + Subir video
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">
          Todavía no hay videos cargados. Subí el primero.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
          {videos.map((v, idx) => (
            <div key={v.id}
              className={`bg-white dark:bg-zinc-900 rounded-2xl border-2 overflow-hidden flex flex-col transition-all ${
                v.activo ? 'border-transparent' : 'border-transparent opacity-50'
              }`}
              style={{ outline: '1px solid #e5e7eb' }}
            >
              <div className="relative bg-gray-100 dark:bg-zinc-800" style={{ aspectRatio: '9/16' }}>
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={v.titulo} className="w-full h-full object-cover" />
                ) : (
                  <video src={v.video_url + '#t=0.5'} preload="metadata" className="w-full h-full object-cover" muted />
                )}
                {!v.activo && (
                  <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Oculto</span>
                )}
              </div>
              <div className="p-2.5 flex flex-col gap-2">
                <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 truncate">{v.titulo || 'Sin título'}</p>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                      className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:hover:border-gray-200 transition-colors text-xs">
                      ↑
                    </button>
                    <button onClick={() => mover(idx, 1)} disabled={idx === videos.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:hover:border-gray-200 transition-colors text-xs">
                      ↓
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleActivo(v)} title={v.activo ? 'Ocultar' : 'Mostrar'}
                      className="text-[11px] font-medium py-1 px-2 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 transition-colors">
                      {v.activo ? '👁' : '🚫'}
                    </button>
                    <button onClick={() => abrirEditar(v)}
                      className="text-[11px] font-medium py-1 px-2 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => setABorrar(v)}
                      className="text-[11px] py-1 px-1.5 rounded-md border border-red-100 dark:border-red-900 text-red-400 dark:text-red-500 hover:border-red-300 hover:text-red-600 transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {(creando || editando !== null) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={cerrarModal}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-5 text-gray-900 dark:text-zinc-100">{creando ? 'Subir video' : 'Editar video'}</h2>

            <VideoAgenciaForm form={form} setForm={setForm} error={error} />

            <div className="flex gap-3 mt-6">
              <button onClick={cerrarModal} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {aBorrar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-center font-bold text-base text-gray-900 dark:text-zinc-100 mb-1">¿Eliminar video?</h3>
            <p className="text-center text-sm text-gray-400 dark:text-zinc-500 mb-6">
              "{aBorrar.titulo || 'Este video'}" se va a eliminar y no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setABorrar(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={eliminar} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
