import { useState, useEffect, useRef } from 'react'
import Ic from './dashboard/Ic.jsx'
import { respuestasRapidasApi, subirAdjuntoRespuesta, urlAdjuntoRespuesta } from '../../lib/supabase.js'
import { buscarRespuestas, resolverCampos } from '../../lib/respuestasRapidas.js'
import { LIMITE_ADJUNTO_MB, NOMBRE_TIPO_ADJUNTO, tipoAdjunto, formatoTamano } from '../../lib/adjuntosWhatsapp.js'

const ACEPTA = 'image/jpeg,image/png,video/mp4,video/3gpp,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
const NOMBRE_TIPO = { image: 'Foto', video: 'Video', audio: 'Audio', document: 'Documento' }
const ICONO_TIPO = { image: 'camera', video: 'film', audio: 'file', document: 'file' }
// WhatsApp corta el pie de una foto/video/documento en 1.024 caracteres y un texto en 4.096
const LIMITE_TEXTO = { conArchivo: 1024, soloTexto: 4096 }
const CAMPOS = [
  { clave: '{nombre}', ayuda: 'Primer nombre del contacto' },
  { clave: '{agente}', ayuda: 'Quien está respondiendo' },
]

const INPUT = 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

// Así se ve el mensaje en el celular del cliente. Los campos se muestran con
// nombres de ejemplo.
function VistaCelular({ texto, adjunto }) {
  const conCampos = resolverCampos(texto, { nombre: 'María', agente: 'Vicky' })
  return (
    <div className="mx-auto w-[290px] overflow-hidden rounded-[2rem] border-[8px] border-gray-800 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800">
        <Ic n="arrow" className="h-4 w-4 rotate-180 text-gray-400 dark:text-zinc-500" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400"><Ic n="user" className="h-3.5 w-3.5" /></span>
        <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Cliente</span>
      </div>
      <div className="chat-fondo flex min-h-[320px] flex-col items-end justify-start p-3">
        {(texto.trim() || adjunto) ? (
          <div className="max-w-[92%] bg-[#1c4444] px-3 py-2 text-sm text-white shadow-sm">
            {adjunto && (adjunto.tipo === 'image' && adjunto.previewUrl ? (
              <img src={adjunto.previewUrl} alt="" className="mb-2 max-h-40 w-full rounded object-cover" />
            ) : (
              <div className="mb-2 flex items-center gap-2 rounded bg-black/20 px-2.5 py-2">
                <Ic n={ICONO_TIPO[adjunto.tipo]} className="h-4 w-4" />
                <span className="min-w-0 truncate text-xs">{adjunto.nombre}</span>
              </div>
            ))}
            {conCampos.trim() && <p className="whitespace-pre-wrap break-words">{conCampos}</p>}
          </div>
        ) : (
          <p className="m-auto self-center text-center text-xs text-gray-400 dark:text-zinc-500">Acá vas a ver cómo le llega el mensaje al cliente</p>
        )}
      </div>
    </div>
  )
}

function EditorRespuesta({ respuesta, onCerrar, onGuardada, onEliminada }) {
  const [titulo, setTitulo] = useState(respuesta?.titulo || '')
  const [texto, setTexto] = useState(respuesta?.texto || '')
  const [adjunto, setAdjunto] = useState(respuesta?.adjunto_path
    ? { path: respuesta.adjunto_path, tipo: respuesta.adjunto_tipo || 'document', mime: respuesta.adjunto_mime, nombre: respuesta.adjunto_nombre || 'archivo', tamano: null, previewUrl: null }
    : null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [menuCampos, setMenuCampos] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [error, setError] = useState('')
  const textoRef = useRef(null)
  const archivoRef = useRef(null)

  // Foto de una respuesta ya guardada: se pide la vista firmada del archivo
  useEffect(() => {
    if (!respuesta?.adjunto_path || respuesta.adjunto_tipo !== 'image') return
    let vivo = true
    urlAdjuntoRespuesta(respuesta.adjunto_path).then(url => { if (vivo && url) setAdjunto(a => a && !a.previewUrl ? { ...a, previewUrl: url } : a) })
    return () => { vivo = false }
  }, [respuesta])

  // Las vistas locales de una foto recién elegida se liberan al cambiarla o cerrar
  useEffect(() => {
    const url = adjunto?.previewUrl
    return () => { if (url && url.startsWith('blob:')) URL.revokeObjectURL(url) }
  }, [adjunto?.previewUrl])

  const limiteTexto = adjunto && adjunto.tipo !== 'audio' ? LIMITE_TEXTO.conArchivo : LIMITE_TEXTO.soloTexto

  async function tomarArchivo(file) {
    if (!file) return
    const tipo = tipoAdjunto(file)
    const limite = LIMITE_ADJUNTO_MB[tipo]
    if (file.size > limite * 1024 * 1024) {
      setError(`El archivo pesa ${formatoTamano(file.size)}. El máximo para ${NOMBRE_TIPO_ADJUNTO[tipo]} es ${limite} MB.`)
      return
    }
    setError('')
    setSubiendo(true)
    const { path, error: errSubida } = await subirAdjuntoRespuesta(file)
    setSubiendo(false)
    if (errSubida || !path) {
      setError('No se pudo subir el archivo: ' + (errSubida?.message || 'error desconocido'))
      return
    }
    setAdjunto({ path, tipo, mime: file.type || 'application/octet-stream', nombre: file.name, tamano: file.size, previewUrl: tipo === 'image' ? URL.createObjectURL(file) : null })
  }

  function insertarCampo(campo) {
    const el = textoRef.current
    const ini = el?.selectionStart ?? texto.length
    const fin = el?.selectionEnd ?? texto.length
    setTexto(texto.slice(0, ini) + campo + texto.slice(fin))
    setMenuCampos(false)
    setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(ini + campo.length, ini + campo.length)
    }, 0)
  }

  async function guardar() {
    const t = titulo.trim()
    const x = texto.trim()
    if (!t) return setError('Poné un nombre para la respuesta: es lo que escribís después de la barra (Ej: /hola).')
    if (!x && !adjunto) return setError('Escribí un texto o adjuntá un archivo.')
    if (x.length > limiteTexto) return setError(`El texto tiene ${x.length} caracteres y WhatsApp admite hasta ${limiteTexto.toLocaleString('es-AR')}${adjunto ? ' cuando lleva archivo' : ''}.`)
    if (subiendo) return
    setError('')
    setGuardando(true)
    const datos = { titulo: t, texto: x }
    // Las columnas del archivo solo se tocan si hay o había uno
    if (adjunto || respuesta?.adjunto_path) {
      datos.adjunto_path = adjunto?.path ?? null
      datos.adjunto_tipo = adjunto?.tipo ?? null
      datos.adjunto_mime = adjunto?.mime ?? null
      datos.adjunto_nombre = adjunto?.nombre ?? null
    }
    const { data, error: errGuardar } = respuesta
      ? await respuestasRapidasApi.update(respuesta.id, datos)
      : await respuestasRapidasApi.create(datos)
    setGuardando(false)
    if (errGuardar || !data) {
      setError(/adjunto_/.test(errGuardar?.message || '')
        ? 'Falta correr la migración de adjuntos en Supabase (20260928120000_respuestas_rapidas_adjunto.sql).'
        : 'No se pudo guardar: ' + (errGuardar?.message || 'error desconocido'))
      return
    }
    onGuardada(data)
  }

  async function eliminar() {
    setGuardando(true)
    const { error: errBorrar } = await respuestasRapidasApi.delete(respuesta.id)
    setGuardando(false)
    if (errBorrar) return setError('No se pudo eliminar: ' + errBorrar.message)
    onEliminada(respuesta.id)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-4 w-full max-w-5xl rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
            <Ic n="pencil" className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Nombre de la respuesta (Ej: hola)"
              autoFocus={!respuesta}
              className="w-full min-w-0 bg-transparent text-lg font-bold text-gray-900 placeholder-gray-300 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCerrar} disabled={guardando} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
            <button
              onClick={guardar}
              disabled={guardando || subiendo}
              className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-zinc-300">Archivo adjunto <span className="font-normal text-gray-400 dark:text-zinc-500">(opcional)</span></p>
              <input ref={archivoRef} type="file" hidden accept={ACEPTA} onChange={e => { tomarArchivo(e.target.files?.[0]); e.target.value = '' }} />
              {adjunto ? (
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-zinc-700">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {adjunto.tipo === 'image' && adjunto.previewUrl ? <img src={adjunto.previewUrl} alt="" className="h-full w-full object-cover" /> : <Ic n={ICONO_TIPO[adjunto.tipo]} className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-zinc-200">{adjunto.nombre}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{NOMBRE_TIPO[adjunto.tipo]}{adjunto.tamano ? ` - ${formatoTamano(adjunto.tamano)}` : ''}{adjunto.tipo === 'audio' ? ' - el texto se envía como mensaje aparte' : ''}</p>
                  </div>
                  <button onClick={() => archivoRef.current?.click()} className="text-xs font-medium text-brand-600 dark:text-brand-400">Cambiar</button>
                  <button onClick={() => setAdjunto(null)} className="text-xs font-medium text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400">Quitar</button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={e => { e.preventDefault(); setArrastrando(false); tomarArchivo(e.dataTransfer.files?.[0]) }}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${arrastrando ? 'border-brand-400 bg-brand-50/40 dark:bg-zinc-800' : 'border-gray-200 dark:border-zinc-700'}`}
                >
                  <Ic n="up" className="h-6 w-6 text-gray-300 dark:text-zinc-600" />
                  {subiendo ? (
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Subiendo archivo...</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 dark:text-zinc-300">
                        <button onClick={() => archivoRef.current?.click()} className="font-medium text-brand-600 underline dark:text-brand-400">Cargá</button> o arrastrá tu archivo acá
                      </p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">Foto hasta 5 MB, video o audio hasta 16 MB, documento hasta 50 MB</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-zinc-300">Texto</p>
              <div className="rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-brand-400 dark:border-zinc-700">
                <textarea
                  ref={textoRef}
                  rows={8}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  placeholder="Escribí el mensaje. Usá los campos para que se completen solos."
                  className="w-full resize-y rounded-t-xl bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
                <div className="relative flex items-center justify-between rounded-b-xl border-t border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/60">
                  <button
                    onClick={() => setMenuCampos(v => !v)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    title="Insertar un campo que se completa solo"
                  >
                    <span className="font-mono">{'{ }'}</span> Campos
                  </button>
                  <span className={`text-xs ${texto.length > limiteTexto ? 'font-semibold text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}>{texto.length.toLocaleString('es-AR')} / {limiteTexto.toLocaleString('es-AR')}</span>
                  {menuCampos && (
                    <div className="absolute bottom-full left-2 z-10 mb-1 w-64 rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {CAMPOS.map(c => (
                        <button key={c.clave} onClick={() => insertarCampo(c.clave)} className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <p className="font-mono text-xs font-semibold text-gray-700 dark:text-zinc-300">{c.clave}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500">{c.ayuda}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}

            {respuesta && (
              confirmarBorrado ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-gray-600 dark:text-zinc-300">¿Eliminar esta respuesta para siempre?</span>
                  <button onClick={eliminar} disabled={guardando} className="font-semibold text-red-600 dark:text-red-400">Sí, eliminar</button>
                  <button onClick={() => setConfirmarBorrado(false)} className="text-gray-400 dark:text-zinc-500">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmarBorrado(true)} className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400">
                  <Ic n="trash" className="h-4 w-4" /> Eliminar respuesta
                </button>
              )
            )}
          </div>

          <div className="lg:pt-2">
            <VistaCelular texto={texto} adjunto={adjunto} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RespuestasRapidasAdmin() {
  const [respuestas, setRespuestas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  // null = cerrado, 'nueva' = alta, o la respuesta que se está editando
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    respuestasRapidasApi.getAll().then(({ data }) => {
      setRespuestas(data || [])
      setLoading(false)
    })
  }, [])

  const visibles = buscarRespuestas(respuestas, busqueda)

  function guardada(data) {
    setRespuestas(prev => (prev.some(r => r.id === data.id) ? prev.map(r => r.id === data.id ? data : r) : [...prev, data])
      .sort((a, b) => a.titulo.localeCompare(b.titulo)))
    setEditando(null)
  }

  function eliminada(id) {
    setRespuestas(prev => prev.filter(r => r.id !== id))
    setEditando(null)
  }

  async function alternarActivo(r) {
    setRespuestas(prev => prev.map(x => x.id === r.id ? { ...x, activo: !x.activo } : x))
    await respuestasRapidasApi.update(r.id, { activo: !r.activo })
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Respuestas rápidas</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">Mensajes guardados, con archivo adjunto si hace falta, para responder en CRM → WhatsApp: con el botón del chat o escribiendo <span className="font-mono">/</span> y parte del nombre (Ej: <span className="font-mono">/hola</span>).</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">En el texto podés usar <span className="font-mono">{'{nombre}'}</span> (primer nombre del contacto) y <span className="font-mono">{'{agente}'}</span> (quien responde): se completan solos al usar la respuesta.</p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Ic n="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o texto..." className={`${INPUT} pl-9`} />
        </div>
        <button
          onClick={() => setEditando('nueva')}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          <Ic n="plus" className="h-4 w-4" /> Nueva respuesta
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Cargando...</p>
        ) : respuestas.length === 0 ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Todavía no hay respuestas guardadas. Tocá "Nueva respuesta" para armar la primera.</p>
        ) : visibles.length === 0 ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">No hay respuestas con eso.</p>
        ) : (
          <div className="max-h-[65vh] divide-y divide-gray-50 overflow-y-auto dark:divide-zinc-800">
            {visibles.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                <button onClick={() => setEditando(r)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-gray-800 hover:text-brand-600 dark:text-zinc-200 dark:hover:text-brand-400">
                    {r.adjunto_path && <Ic n="clip" className="mr-1 inline-block h-3.5 w-3.5 align-[-2px] text-gray-400 dark:text-zinc-500" />}
                    {r.titulo}
                  </p>
                  <p className="truncate text-xs text-gray-400 dark:text-zinc-500">{r.texto || 'Solo archivo adjunto'}</p>
                </button>
                <button
                  onClick={() => alternarActivo(r)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${r.activo ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'}`}
                >
                  {r.activo ? 'Activa' : 'Inactiva'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {!loading && respuestas.length > 0 && (
        <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">{visibles.length === respuestas.length ? `${respuestas.length} respuestas` : `${visibles.length} de ${respuestas.length} respuestas`}</p>
      )}

      {editando && (
        <EditorRespuesta
          key={editando === 'nueva' ? 'nueva' : editando.id}
          respuesta={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={guardada}
          onEliminada={eliminada}
        />
      )}
    </div>
  )
}
