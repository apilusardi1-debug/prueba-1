import { useState, useEffect, useMemo } from 'react'
import { propuestasApi } from '../../../lib/supabase.js'
import { generarPDFCierre } from '../../../lib/pdfPlantillaCierre.js'

function formatPrecio(n, moneda = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moneda }).format(n || 0)
}

const TITULOS = {
  enviada: { titulo: 'Propuestas enviadas', vacio: 'No hay propuestas enviadas todavía.' },
  cerrada: { titulo: 'Propuestas cerradas', vacio: 'Todavía no se cerró ninguna propuesta.' },
  rechazada: { titulo: 'Propuestas rechazadas', vacio: 'No hay propuestas rechazadas.' },
}

const ESTADO_COLOR = {
  enviada: 'bg-yellow-400',
  cerrada: 'bg-green-500',
  rechazada: 'bg-red-400',
}

const ORDENES = {
  fecha_desc: { label: 'Más recientes primero', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  fecha_asc: { label: 'Más antiguas primero', fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
  monto_desc: { label: 'Monto: mayor a menor', fn: (a, b) => (b.total || 0) - (a.total || 0) },
  monto_asc: { label: 'Monto: menor a mayor', fn: (a, b) => (a.total || 0) - (b.total || 0) },
}

function descargarPdf(bytes, nombreArchivo) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

// Resumen de una pata del vuelo (ej: "10 dic — Buenos Aires (EZE) 08:15 → Recife (REC) 14:40").
function resumenTramo(fecha, origenCiudad, origenCodigo, sale, destinoCiudad, destinoCodigo, llega) {
  if (!fecha && !origenCiudad && !destinoCiudad) return null
  const fechaTxt = fecha ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : ''
  return `${fechaTxt ? `${fechaTxt} — ` : ''}${origenCiudad || '—'} (${origenCodigo || '—'}) ${sale || ''} → ${destinoCiudad || '—'} (${destinoCodigo || '—'}) ${llega || ''}`
}

export default function PropuestasLista({ estado }) {
  const [propuestas, setPropuestas] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesandoId, setProcesandoId] = useState(null)
  const { titulo, vacio } = TITULOS[estado] || TITULOS.enviada

  // Filtros: busqueda por cliente, rango de fechas y orden.
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [orden, setOrden] = useState('fecha_desc')

  // Modal de detalle/cierre: vuelo y cliente se muestran confirmados (no hay
  // nada que elegir ahi), pero el hospedaje elegido por el cliente y si quiere
  // o no los traslados si son decisiones que hay que tomar al cerrar.
  const [cerrandoPropuesta, setCerrandoPropuesta] = useState(null)
  const [hospedajeIdx, setHospedajeIdx] = useState(0)
  const [trasladosIncluidos, setTrasladosIncluidos] = useState(true)
  const [vencimiento, setVencimiento] = useState('')
  const [generandoCierre, setGenerandoCierre] = useState(false)
  const [errorCierre, setErrorCierre] = useState('')

  useEffect(() => { cargar() }, [estado])

  async function cargar() {
    setLoading(true)
    const { data } = await propuestasApi.getByEstado(estado)
    setPropuestas(data || [])
    setLoading(false)
  }

  const propuestasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return propuestas
      .filter(p => {
        if (texto && !p.cliente_nombre?.toLowerCase().includes(texto) && !p.cliente_whatsapp?.includes(texto)) return false
        if (desde && new Date(p.created_at) < new Date(desde)) return false
        if (hasta && new Date(p.created_at) > new Date(hasta + 'T23:59:59')) return false
        return true
      })
      .sort(ORDENES[orden].fn)
  }, [propuestas, busqueda, desde, hasta, orden])

  async function cambiarEstado(id, nuevoEstado) {
    setProcesandoId(id)
    await propuestasApi.actualizarEstado(id, nuevoEstado)
    setPropuestas(prev => prev.filter(p => p.id !== id))
    setProcesandoId(null)
    setCerrandoPropuesta(null)
  }

  function abrirDetalle(p) {
    setCerrandoPropuesta(p)
    setHospedajeIdx(0)
    setTrasladosIncluidos(p.traslados_incluidos ?? true)
    setVencimiento(p.vencimiento_saldo || '')
    setErrorCierre('')
  }

  async function confirmarCierre() {
    setGenerandoCierre(true)
    setErrorCierre('')
    try {
      const hospedajeElegido = (cerrandoPropuesta.hospedajes_detalle || [])[hospedajeIdx]
      const datosActualizados = {
        vencimiento_saldo: vencimiento || null,
        traslados_incluidos: trasladosIncluidos,
        // Guardamos solo el hospedaje que el cliente eligio (si habia mas de uno
        // ofrecido) — asi el PDF de cierre y la propuesta ya cerrada quedan con
        // el dato correcto, sin ambiguedad.
        hospedajes_detalle: hospedajeElegido ? [hospedajeElegido] : cerrandoPropuesta.hospedajes_detalle,
      }
      const { data: propuestaActualizada } = await propuestasApi.update(cerrandoPropuesta.id, datosActualizados)
      const doc = await generarPDFCierre(propuestaActualizada || { ...cerrandoPropuesta, ...datosActualizados })
      const bytes = await doc.save()
      descargarPdf(bytes, `Cierre_${(cerrandoPropuesta.cliente_nombre || 'propuesta').replace(/\s+/g, '_')}.pdf`)
      await propuestasApi.actualizarEstado(cerrandoPropuesta.id, 'cerrada')
      setPropuestas(prev => prev.filter(p => p.id !== cerrandoPropuesta.id))
      setCerrandoPropuesta(null)
    } catch (e) {
      setErrorCierre('No se pudo generar el cierre: ' + e.message)
    } finally {
      setGenerandoCierre(false)
    }
  }

  // Re-descarga el PDF de una propuesta ya cerrada, con los datos tal cual quedaron
  // guardados (no vuelve a tocar la base ni pide nada nuevo).
  async function redescargarCierre() {
    setGenerandoCierre(true)
    setErrorCierre('')
    try {
      const doc = await generarPDFCierre(cerrandoPropuesta)
      const bytes = await doc.save()
      descargarPdf(bytes, `Cierre_${(cerrandoPropuesta.cliente_nombre || 'propuesta').replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      setErrorCierre('No se pudo generar el PDF: ' + e.message)
    } finally {
      setGenerandoCierre(false)
    }
  }

  function fechaTexto(p) {
    if (estado === 'cerrada' && p.cerrada_at) return new Date(p.cerrada_at).toLocaleDateString('es-AR')
    if (estado === 'rechazada' && p.cerrada_at) return new Date(p.cerrada_at).toLocaleDateString('es-AR')
    return new Date(p.created_at).toLocaleDateString('es-AR')
  }

  function limpiarFiltros() {
    setBusqueda('')
    setDesde('')
    setHasta('')
    setOrden('fecha_desc')
  }

  const hayFiltrosActivos = busqueda || desde || hasta || orden !== 'fecha_desc'

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  const vuelo = cerrandoPropuesta?.vuelo || {}
  const hospedajesOpciones = cerrandoPropuesta?.hospedajes_detalle || []
  const tramoIda = resumenTramo(vuelo.ida_fecha, vuelo.origen_ciudad, vuelo.origen_codigo, vuelo.ida_sale, vuelo.destino_ciudad, vuelo.destino_codigo, vuelo.ida_llega)
  const tramoVuelta = resumenTramo(vuelo.vuelta_fecha, vuelo.destino_ciudad, vuelo.destino_codigo, vuelo.vuelta_sale, vuelo.origen_ciudad, vuelo.origen_codigo, vuelo.vuelta_llega)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{titulo}</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          {propuestasFiltradas.length} de {propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''}
        </p>
      </div>

      {propuestas.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-400 dark:text-zinc-500 mb-1 block">Buscar cliente</label>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o WhatsApp..."
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-zinc-500 mb-1 block">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-zinc-500 mb-1 block">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-zinc-500 mb-1 block">Ordenar por</label>
            <select value={orden} onChange={e => setOrden(e.target.value)}
              className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {Object.entries(ORDENES).map(([key, o]) => <option key={key} value={key}>{o.label}</option>)}
            </select>
          </div>
          {hayFiltrosActivos && (
            <button onClick={limpiarFiltros} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 font-medium px-2 py-2">
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      )}

      {propuestas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">{vacio}</div>
      ) : propuestasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">Ningún resultado con esos filtros.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {propuestasFiltradas.map(p => {
            const nHospedajes = (p.hospedajes_detalle || []).length
            return (
              <div key={p.id}
                onClick={() => (estado === 'enviada' || estado === 'cerrada') && abrirDetalle(p)}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 transition-all ${
                  estado === 'enviada' || estado === 'cerrada' ? 'cursor-pointer hover:border-brand-300 hover:shadow-md' : ''
                }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm flex-shrink-0">
                    {p.cliente_nombre?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${ESTADO_COLOR[estado] || 'bg-gray-300'}`} title={titulo} />
                </div>
                <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">{p.cliente_nombre}</p>
                {p.cliente_whatsapp && (
                  <a href={`https://wa.me/${p.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-xs text-green-600 dark:text-green-400 hover:underline">💬 {p.cliente_whatsapp}</a>
                )}
                <p className="text-lg font-bold text-brand-700 dark:text-brand-400 mt-2">{formatPrecio(p.total, p.moneda)}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{fechaTexto(p)}</p>
                  {nHospedajes > 0 && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{nHospedajes} hospedaje{nHospedajes !== 1 ? 's' : ''}</p>
                  )}
                </div>
                {estado === 'enviada' && (
                  <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-gray-50 dark:border-zinc-800">
                    <button
                      onClick={e => { e.stopPropagation(); cambiarEstado(p.id, 'rechazada') }}
                      disabled={procesandoId === p.id}
                      className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 whitespace-nowrap"
                    >
                      ✕ Rechazada
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); abrirDetalle(p) }}
                      disabled={procesandoId === p.id}
                      className="text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50 whitespace-nowrap"
                    >
                      ✓ Cerrar propuesta
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {cerrandoPropuesta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !generandoCierre && setCerrandoPropuesta(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">
                {estado === 'enviada' ? `Cerrar propuesta de ${cerrandoPropuesta.cliente_nombre}` : `Propuesta de ${cerrandoPropuesta.cliente_nombre}`}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                {estado === 'enviada' ? 'Confirmá lo que eligió el cliente para generar el PDF de cierre.' : 'Datos con los que quedó cerrada esta propuesta.'}
              </p>
            </div>

            {/* Cliente y vuelo: no hay nada que elegir, se muestran ya confirmados */}
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="font-medium">{cerrandoPropuesta.cliente_nombre}</span>
                {cerrandoPropuesta.cliente_whatsapp && <span className="text-xs text-gray-400 dark:text-zinc-500">· {cerrandoPropuesta.cliente_whatsapp}</span>}
              </div>
              {tramoIda && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span>IDA: {tramoIda}</span>
                </div>
              )}
              {tramoVuelta && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span>VUELTA: {tramoVuelta}</span>
                </div>
              )}
            </div>

            {/* Hospedaje elegido por el cliente — seleccionable si todavia esta enviada,
                de lo contrario solo se muestra el que quedo elegido. */}
            {hospedajesOpciones.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
                  {estado === 'enviada' && hospedajesOpciones.length > 1 ? 'Hospedaje que eligió el cliente' : 'Hospedaje'}
                </p>
                <div className="space-y-2">
                  {hospedajesOpciones.map((h, i) => {
                    const seleccionado = hospedajeIdx === i
                    const Elemento = estado === 'enviada' ? 'button' : 'div'
                    return (
                      <Elemento key={i} type={estado === 'enviada' ? 'button' : undefined}
                        onClick={estado === 'enviada' ? () => setHospedajeIdx(i) : undefined}
                        className={`w-full flex items-center gap-3 border rounded-xl p-2.5 text-left transition-colors ${
                          seleccionado ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-zinc-700'
                        } ${estado === 'enviada' ? 'hover:border-brand-300' : ''}`}>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
                          {h.imagen && <img src={h.imagen} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{h.nombre}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500">{formatPrecio(h.precio, h.moneda === 'ARS' ? 'ARS' : 'BRL')}</p>
                        </div>
                        {seleccionado && <span className="text-brand-600 dark:text-brand-400 text-sm flex-shrink-0">✓</span>}
                      </Elemento>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Traslados */}
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">¿Incluye traslados?</p>
              {estado === 'enviada' ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTrasladosIncluidos(true)}
                    className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
                      trasladosIncluidos ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
                    }`}>
                    Sí
                  </button>
                  <button type="button" onClick={() => setTrasladosIncluidos(false)}
                    className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
                      !trasladosIncluidos ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
                    }`}>
                    No
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-zinc-300">{trasladosIncluidos ? 'Sí' : 'No'}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">Vencimiento del saldo</label>
              {estado === 'enviada' ? (
                <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              ) : (
                <p className="text-sm text-gray-700 dark:text-zinc-300">{vencimiento ? new Date(vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : 'No definido'}</p>
              )}
            </div>

            {errorCierre && <p className="text-xs text-red-500">{errorCierre}</p>}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setCerrandoPropuesta(null)} disabled={generandoCierre}
                className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 disabled:opacity-50">
                {estado === 'enviada' ? 'Cancelar' : 'Cerrar'}
              </button>
              {estado === 'enviada' ? (
                <button onClick={confirmarCierre} disabled={generandoCierre}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50">
                  {generandoCierre ? 'Generando...' : 'Generar y cerrar'}
                </button>
              ) : (
                <button onClick={redescargarCierre} disabled={generandoCierre}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50">
                  {generandoCierre ? 'Generando...' : 'Descargar PDF'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
