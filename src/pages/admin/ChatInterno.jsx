// Vista de admin del chat interno de operaciones: una conversación por guía/chofer con
// el historial completo de avisos (mismo texto que ven ellos en /guia/:token o
// /chofer/:token) y si cada uno lo abrió (Leído) o tocó "Recebido". No se responde desde
// acá: guía y chofer usan su propio WhatsApp para contactar al pasajero.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { guiasApi, choferesApi, operacionesApi } from '../../lib/supabase.js'
import { useSincronizado } from '../../lib/useSincronizado.js'
import Ic, { IcGrande } from '../../components/admin/dashboard/Ic.jsx'

function formatoFecha(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatoHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function formatoRelativo(iso) {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return formatoHora(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function estadoAviso(a) {
  if (a.confirmado_at) return 'confirmado'
  if (a.leido_at) return 'leido'
  return 'enviado'
}

function Tick({ estado, className = 'h-3.5 w-3.5' }) {
  if (estado === 'confirmado') return <Ic n="checks" className={`${className} text-green-500`} />
  if (estado === 'leido') return <Ic n="checks" className={`${className} text-gray-400 dark:text-zinc-500`} />
  return <Ic n="check" className={`${className} text-gray-400 dark:text-zinc-500`} />
}

function Avatar({ tipo }) {
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
      tipo === 'guia' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
    }`}>
      <Ic n={tipo === 'guia' ? 'user' : 'car'} className="h-4 w-4" />
    </div>
  )
}

function Mensaje({ aviso }) {
  const estado = estadoAviso(aviso)
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{aviso.operaciones?.excursiones?.nombre || 'Excursión'}</p>
          <p className="text-xs capitalize text-gray-400 dark:text-zinc-500">{formatoFecha(aviso.operaciones?.fecha)}</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          estado === 'confirmado' ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
            : estado === 'leido' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
            : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
        }`}>
          <Tick estado={estado} className="h-3 w-3" />
          {estado === 'confirmado' ? `Recebido às ${formatoHora(aviso.confirmado_at)}`
            : estado === 'leido' ? `Leído às ${formatoHora(aviso.leido_at)}`
            : 'Enviado'}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-zinc-300">{aviso.mensaje}</p>

      {aviso.pasajeros?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 dark:border-zinc-800 pt-3">
          {aviso.pasajeros.map((p, i) => (
            <span key={i} className="rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-0.5 text-[11px] text-gray-500 dark:text-zinc-400">
              {p.nombre} · {p.personas} pax
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatInterno() {
  const [guias, setGuias] = useState([])
  const [choferes, setChoferes] = useState([])
  const [avisos, setAvisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null) // { tipo, id }

  const cargar = useCallback(async () => {
    const [{ data: g }, { data: c }, { data: a }] = await Promise.all([
      guiasApi.getAll(), choferesApi.getAll(), operacionesApi.getTodosAvisos(),
    ])
    setGuias(g || [])
    setChoferes(c || [])
    setAvisos(a || [])
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useSincronizado(cargar, ['operaciones_avisos', 'guias', 'choferes'])

  const contactos = useMemo(() => {
    const lista = [
      ...guias.map((g) => ({ tipo: 'guia', id: g.id, nombre: g.nombre, whatsapp: g.whatsapp })),
      ...choferes.map((c) => ({ tipo: 'chofer', id: c.id, nombre: c.nombre, whatsapp: c.whatsapp })),
    ]
    return lista
      .map((ct) => {
        const propios = avisos.filter((a) => a.destinatario === ct.tipo && a[`${ct.tipo}_id`] === ct.id)
        return { ...ct, avisos: propios, ultimo: propios[0] || null, pendientes: propios.filter((a) => !a.confirmado_at).length }
      })
      .filter((ct) => !busqueda || ct.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => {
        if (a.ultimo && b.ultimo) return new Date(b.ultimo.created_at) - new Date(a.ultimo.created_at)
        if (a.ultimo) return -1
        if (b.ultimo) return 1
        return a.nombre.localeCompare(b.nombre)
      })
  }, [guias, choferes, avisos, busqueda])

  const activo = contactos.find((c) => c.tipo === seleccionado?.tipo && c.id === seleccionado?.id) || null

  return (
    <div className="flex overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900" style={{ height: 'calc(100vh - 160px)', minHeight: '480px' }}>
      {/* ── Lista de guías/choferes ── */}
      <div className={`${activo ? 'hidden lg:flex' : 'flex'} w-full shrink-0 flex-col border-r border-gray-100 dark:border-zinc-800 lg:w-80`}>
        <div className="border-b border-gray-100 p-4 dark:border-zinc-800">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500">
              <Ic n="search" className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar guía o chofer..."
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>
          ) : contactos.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-zinc-600">
              <IcGrande n="user" />
              <p className="text-sm">Sin resultados</p>
            </div>
          ) : (
            contactos.map((ct) => {
              const esActivo = seleccionado?.tipo === ct.tipo && seleccionado?.id === ct.id
              return (
                <button
                  key={`${ct.tipo}-${ct.id}`}
                  onClick={() => setSeleccionado({ tipo: ct.tipo, id: ct.id })}
                  className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors dark:border-zinc-800/60 ${
                    esActivo ? 'bg-brand-50 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <Avatar tipo={ct.tipo} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{ct.nombre}</p>
                      {ct.ultimo && <span className="shrink-0 text-[11px] text-gray-400 dark:text-zinc-500">{formatoRelativo(ct.ultimo.created_at)}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500">
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{ct.tipo === 'guia' ? 'Guía' : 'Chofer'}</span>
                      {ct.ultimo ? (
                        <>
                          <span>·</span>
                          <Tick estado={estadoAviso(ct.ultimo)} className="h-3 w-3" />
                          <span className="truncate">{ct.ultimo.operaciones?.excursiones?.nombre}</span>
                        </>
                      ) : (
                        <span>· Sin avisos todavía</span>
                      )}
                    </div>
                  </div>
                  {ct.pendientes > 0 && (
                    <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {ct.pendientes}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Historial del contacto elegido ── */}
      <div className={`${activo ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {!activo ? (
          <div className="hidden flex-1 items-center justify-center text-gray-400 dark:text-zinc-600 lg:flex">
            <div className="text-center">
              <IcGrande n="chat" />
              <p className="text-sm">Elegí un guía o chofer para ver sus avisos</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <button
                onClick={() => setSeleccionado(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800 lg:hidden"
              >
                <Ic n="arrow" className="h-4 w-4 rotate-180" />
              </button>
              <Avatar tipo={activo.tipo} />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{activo.nombre}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  {activo.tipo === 'guia' ? 'Guía' : 'Chofer'}{activo.whatsapp ? ` · +${activo.whatsapp}` : ''}
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {activo.avisos.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-zinc-600">
                  <IcGrande n="chat" />
                  <p className="text-sm">Todavía no tiene ningún aviso</p>
                </div>
              ) : (
                activo.avisos.map((a) => <Mensaje key={a.id} aviso={a} />)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
