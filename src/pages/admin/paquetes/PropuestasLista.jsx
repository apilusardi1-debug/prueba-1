import { useState, useEffect, useMemo } from 'react'
import { propuestasApi } from '../../../lib/supabase.js'
import { generarPDFCierre } from '../../../lib/pdfPlantillaCierre.js'

function formatPrecio(n, moneda = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moneda }).format(n || 0)
}
function formatearNumero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}
// El campo de seña guarda solo dígitos en el estado (compatible con parseFloat
// para el saldo); lo que se ve en el input tiene los puntos de miles puestos
// en el momento de mostrar — mismo patrón que el Generador de propuesta.
function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}
function formatearMiles(valor) {
  const digitos = soloDigitos(valor)
  return digitos ? Number(digitos).toLocaleString('es-AR') : ''
}
const TITULOS = {
  enviada: { titulo: 'Propuestas enviadas', vacio: 'No hay propuestas enviadas todavía.' },
  cerrada: { titulo: 'Propuestas cerradas', vacio: 'Todavía no se cerró ninguna propuesta.' },
  rechazada: { titulo: 'Propuestas rechazadas', vacio: 'No hay propuestas rechazadas.' },
  archivada: { titulo: 'Propuestas archivadas (esperando respuesta)', vacio: 'No hay propuestas esperando respuesta.' },
}

const ESTADO_COLOR = {
  enviada: 'bg-yellow-400',
  cerrada: 'bg-green-500',
  rechazada: 'bg-red-400',
  archivada: 'bg-blue-400',
}

const TIPO_LABEL = {
  simple: { label: 'Simple', color: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
  combinada: { label: 'Combinada', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' },
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
function resumenTramo(fecha, origenCiudad, origenCodigo, sale, destinoCiudad, destinoCodigo, llega, escalaCiudad, escalaCodigo, escalaLlega, escalaSale) {
  if (!fecha && !origenCiudad && !destinoCiudad) return null
  const fechaTxt = fecha ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : ''
  const hayEscala = escalaCiudad || escalaCodigo
  const horaEscala = (escalaLlega || escalaSale) ? ` ${escalaLlega || '--:--'}-${escalaSale || '--:--'}` : ''
  const tramoEscala = hayEscala ? ` → escala ${escalaCiudad || '—'} (${escalaCodigo || '—'})${horaEscala}` : ''
  return `${fechaTxt ? `${fechaTxt} — ` : ''}${origenCiudad || '—'} (${origenCodigo || '—'}) ${sale || ''}${tramoEscala} → ${destinoCiudad || '—'} (${destinoCodigo || '—'}) ${llega || ''}`
}

// Destino real de la propuesta: si es combinada, la secuencia de lugares que
// arman los transfers cargados (salida -> destino de cada tramo, sin repetir
// consecutivos); si es simple, la ciudad de destino del vuelo.
function destinoPropuesta(p) {
  if (p.tipo_propuesta === 'combinada' && (p.destinos_detalle || []).length) {
    const lugares = []
    p.destinos_detalle.forEach(d => {
      if (d.salida && lugares[lugares.length - 1] !== d.salida) lugares.push(d.salida)
      if (d.destino && lugares[lugares.length - 1] !== d.destino) lugares.push(d.destino)
    })
    return lugares.join(' + ')
  }
  return p.vuelo?.destino_ciudad || ''
}

function fechasViaje(p) {
  const ida = p.vuelo?.ida_fecha
  const vuelta = p.vuelo?.vuelta_fecha
  if (!ida) return null
  const opts = { day: '2-digit', month: 'short' }
  const idaTxt = new Date(ida + 'T00:00:00').toLocaleDateString('es-AR', opts)
  if (!vuelta) return idaTxt
  const vueltaTxt = new Date(vuelta + 'T00:00:00').toLocaleDateString('es-AR', opts)
  return `${idaTxt} – ${vueltaTxt}`
}

export default function PropuestasLista({ estado }) {
  const [propuestas, setPropuestas] = useState([])
  // Solo se usa en la pagina de "enviadas": las propuestas a las que ya se les
  // eligió vuelo/hospedaje (se generó el PDF de cierre) pero todavia no se
  // confirmaron ni rechazaron — quedan en una segunda seccion debajo, esperando
  // la respuesta final del cliente.
  const [archivadas, setArchivadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesandoId, setProcesandoId] = useState(null)
  const { titulo, vacio } = TITULOS[estado] || TITULOS.enviada

  // Filtros: busqueda libre (cliente/whatsapp/destino), tipo de propuesta,
  // destino puntual, rango de fechas de creacion y orden.
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDestino, setFiltroDestino] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [orden, setOrden] = useState('fecha_desc')

  // Modal de detalle/cierre: el cliente se muestra confirmado (no hay nada que
  // elegir ahi), pero el vuelo y el hospedaje elegidos por el cliente (cuando
  // se cargó mas de una opción) y si quiere o no los traslados si son
  // decisiones que hay que tomar al cerrar.
  const [cerrandoPropuesta, setCerrandoPropuesta] = useState(null)
  const [vueloIdx, setVueloIdx] = useState(0)
  const [hospedajeIdx, setHospedajeIdx] = useState(0)
  const [trasladosIncluidos, setTrasladosIncluidos] = useState(true)
  const [seguroViaje, setSeguroViaje] = useState(false)
  const [vencimiento, setVencimiento] = useState('')
  const [sena, setSena] = useState('')
  // Valor equivalente en reales (BRL) "congelado" a un tipo de cambio fijado ese
  // dia — dato manual (no hay conversion automatica), opcional: si se deja
  // vacio, esa linea no aparece en el PDF de cierre.
  const [valorCongeladoBrl, setValorCongeladoBrl] = useState('')
  const [generandoCierre, setGenerandoCierre] = useState(false)
  const [errorCierre, setErrorCierre] = useState('')

  useEffect(() => { cargar() }, [estado])

  async function cargar() {
    setLoading(true)
    const { data } = await propuestasApi.getByEstado(estado)
    setPropuestas(data || [])
    if (estado === 'enviada') {
      const { data: dataArchivadas } = await propuestasApi.getByEstado('archivada')
      setArchivadas(dataArchivadas || [])
    }
    setLoading(false)
  }

  // Lista de destinos unicos presentes en las propuestas cargadas, para el
  // select de filtro — no hay un catalogo fijo de destinos como con las
  // excursiones, se arma dinamicamente con lo que hay.
  const destinosDisponibles = useMemo(() => {
    const set = new Set()
    for (const p of [...propuestas, ...archivadas]) {
      const d = destinoPropuesta(p)
      if (d) set.add(d)
    }
    return [...set].sort()
  }, [propuestas, archivadas])

  // Mismo criterio de busqueda/filtro/orden para la lista principal y la de
  // archivadas (comparten la misma barra de filtros arriba de la pagina).
  function aplicarFiltros(lista) {
    const texto = busqueda.trim().toLowerCase()
    return lista
      .filter(p => {
        if (texto) {
          const enDestino = destinoPropuesta(p).toLowerCase().includes(texto)
          const enCliente = p.cliente_nombre?.toLowerCase().includes(texto)
          const enWhatsapp = p.cliente_whatsapp?.includes(texto)
          if (!enCliente && !enWhatsapp && !enDestino) return false
        }
        if (filtroTipo && (p.tipo_propuesta || 'simple') !== filtroTipo) return false
        if (filtroDestino && destinoPropuesta(p) !== filtroDestino) return false
        if (desde && new Date(p.created_at) < new Date(desde)) return false
        if (hasta && new Date(p.created_at) > new Date(hasta + 'T23:59:59')) return false
        return true
      })
      .sort(ORDENES[orden].fn)
  }

  const propuestasFiltradas = useMemo(() => aplicarFiltros(propuestas), [propuestas, busqueda, filtroTipo, filtroDestino, desde, hasta, orden])
  const archivadasFiltradas = useMemo(() => aplicarFiltros(archivadas), [archivadas, busqueda, filtroTipo, filtroDestino, desde, hasta, orden])

  async function cambiarEstado(id, nuevoEstado) {
    setProcesandoId(id)
    const { data, error } = await propuestasApi.actualizarEstado(id, nuevoEstado)
    setProcesandoId(null)
    if (error) { alert('No se pudo actualizar la propuesta: ' + error.message); return }
    // Si el nuevo estado es el que esta lista muestra (ej: archivada -> enviada
    // en la misma pagina de "enviadas"), la agregamos de vuelta en vez de solo
    // sacarla, para que aparezca al toque sin recargar la pagina.
    setPropuestas(prev => nuevoEstado === estado ? [data, ...prev.filter(p => p.id !== id)] : prev.filter(p => p.id !== id))
    setArchivadas(prev => prev.filter(p => p.id !== id))
    setCerrandoPropuesta(null)
  }

  function abrirDetalle(p) {
    setCerrandoPropuesta(p)
    setVueloIdx(0)
    setHospedajeIdx(0)
    setTrasladosIncluidos(p.traslados_incluidos ?? true)
    setSeguroViaje(p.seguro_viaje ?? false)
    setVencimiento(p.vencimiento_saldo || '')
    setSena(p.sena != null ? String(p.sena) : '')
    setValorCongeladoBrl(p.valor_congelado_brl != null ? String(p.valor_congelado_brl) : '')
    setErrorCierre('')
  }

  async function confirmarCierre() {
    setGenerandoCierre(true)
    setErrorCierre('')
    try {
      const hospedajeElegido = (cerrandoPropuesta.hospedajes_detalle || [])[hospedajeIdx]
      const vuelosDisponibles = cerrandoPropuesta.vuelos?.length ? cerrandoPropuesta.vuelos : (cerrandoPropuesta.vuelo ? [cerrandoPropuesta.vuelo] : [])
      const vueloElegido = vuelosDisponibles[vueloIdx]
      const datosActualizados = {
        vencimiento_saldo: vencimiento || null,
        traslados_incluidos: trasladosIncluidos,
        seguro_viaje: seguroViaje,
        sena: parseFloat(sena) || 0,
        valor_congelado_brl: valorCongeladoBrl ? parseFloat(valorCongeladoBrl) : null,
        // Guardamos solo el vuelo y el hospedaje que el cliente eligio (si habia
        // mas de una opcion ofrecida) — asi el PDF de cierre y la propuesta ya
        // cerrada quedan con el dato correcto, sin ambiguedad.
        vuelo: vueloElegido || cerrandoPropuesta.vuelo,
        vuelos: vueloElegido ? [vueloElegido] : cerrandoPropuesta.vuelos,
        hospedajes_detalle: hospedajeElegido ? [hospedajeElegido] : cerrandoPropuesta.hospedajes_detalle,
      }
      const { data: propuestaActualizada, error: errorUpdate } = await propuestasApi.update(cerrandoPropuesta.id, datosActualizados)
      if (errorUpdate) throw errorUpdate
      const doc = await generarPDFCierre(propuestaActualizada || { ...cerrandoPropuesta, ...datosActualizados })
      const bytes = await doc.save()
      descargarPdf(bytes, `Cierre_${(cerrandoPropuesta.cliente_nombre || 'propuesta').replace(/\s+/g, '_')}.pdf`)
      // No queda cerrada todavia — pasa a "archivada" (esperando respuesta) hasta
      // que el cliente confirme o rechace desde esa segunda seccion.
      const { data: propuestaArchivada, error: errorEstado } = await propuestasApi.actualizarEstado(cerrandoPropuesta.id, 'archivada')
      if (errorEstado) throw errorEstado
      setPropuestas(prev => prev.filter(p => p.id !== cerrandoPropuesta.id))
      setArchivadas(prev => [propuestaArchivada || { ...cerrandoPropuesta, ...datosActualizados, estado: 'archivada' }, ...prev])
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
    setFiltroTipo('')
    setFiltroDestino('')
    setDesde('')
    setHasta('')
    setOrden('fecha_desc')
  }

  const hayFiltrosActivos = busqueda || filtroTipo || filtroDestino || desde || hasta || orden !== 'fecha_desc'

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  // "vuelos" es el array completo cargado en el Generador; si la propuesta es
  // vieja y no lo tiene, cae al "vuelo" singular de siempre.
  const vuelosOpciones = cerrandoPropuesta?.vuelos?.length ? cerrandoPropuesta.vuelos : (cerrandoPropuesta?.vuelo ? [cerrandoPropuesta.vuelo] : [])
  const vuelo = vuelosOpciones[vueloIdx] || cerrandoPropuesta?.vuelo || {}
  const hospedajesOpciones = cerrandoPropuesta?.hospedajes_detalle || []
  const tramoIda = resumenTramo(vuelo.ida_fecha, vuelo.origen_ciudad, vuelo.origen_codigo, vuelo.ida_sale, vuelo.destino_ciudad, vuelo.destino_codigo, vuelo.ida_llega, vuelo.ida_escala_ciudad, vuelo.ida_escala_codigo, vuelo.ida_escala_llega, vuelo.ida_escala_sale)
  const tramoVuelta = resumenTramo(vuelo.vuelta_fecha, vuelo.destino_ciudad, vuelo.destino_codigo, vuelo.vuelta_sale, vuelo.origen_ciudad, vuelo.origen_codigo, vuelo.vuelta_llega, vuelo.vuelta_escala_ciudad, vuelo.vuelta_escala_codigo, vuelo.vuelta_escala_llega, vuelo.vuelta_escala_sale)
  // Ruta fija de los traslados en propuesta simple (aeropuerto-hotel) — se
  // muestra junto al Sí/No para que quede claro que trayecto se esta
  // confirmando, no solo si hay o no traslados.
  const trasladoRuta = [vuelo.traslado_ida && 'Aeropuerto → Hotel', vuelo.traslado_vuelta && 'Hotel → Aeropuerto'].filter(Boolean).join(' · ')
  const esCombinada = cerrandoPropuesta?.tipo_propuesta === 'combinada'
  const trayectosTransfer = esCombinada ? (cerrandoPropuesta?.destinos_detalle || []).filter(d => d.salida?.trim() || d.destino?.trim()) : []
  const puedeAbrir = estado === 'enviada' || estado === 'cerrada'

  // Pago: mismo criterio que el Generador — en simple los hospedajes cargados
  // son opciones alternativas (se toma el elegido), en combinada se suman.
  const hospedajeElegidoPago = hospedajesOpciones[hospedajeIdx]
  const totalPago = esCombinada
    ? hospedajesOpciones.reduce((sum, h) => sum + (parseFloat(h.precio) || 0), 0)
    : (parseFloat(hospedajeElegidoPago?.precio) || 0)
  const saldoPago = Math.max(totalPago - (parseFloat(sena) || 0), 0)
  const monedaPago = cerrandoPropuesta?.moneda || 'BRL'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{titulo}</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          {propuestasFiltradas.length} de {propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''}
        </p>
      </div>

      {propuestas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, WhatsApp o destino..."
            className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[220px] flex-1 max-w-xs"
          />

          <span className="w-px h-5 bg-gray-200 dark:bg-zinc-700 mx-1" />

          <button onClick={() => setFiltroTipo('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filtroTipo ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
            Todas
          </button>
          {Object.entries(TIPO_LABEL).map(([k, v]) => (
            <button key={k} onClick={() => setFiltroTipo(k)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroTipo === k ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
              {v.label}
            </button>
          ))}

          <span className="w-px h-5 bg-gray-200 dark:bg-zinc-700 mx-1" />

          <select
            value={filtroDestino}
            onChange={e => setFiltroDestino(e.target.value)}
            className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Todos los destinos</option>
            {destinosDisponibles.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <span className="text-gray-300 dark:text-zinc-600 text-sm">–</span>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />

          <select value={orden} onChange={e => setOrden(e.target.value)}
            className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400">
            {Object.entries(ORDENES).map(([key, o]) => <option key={key} value={key}>{o.label}</option>)}
          </select>

          {hayFiltrosActivos && (
            <button onClick={limpiarFiltros} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 underline">
              Limpiar
            </button>
          )}
        </div>
      )}

      {propuestas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">{vacio}</div>
      ) : propuestasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">Ningún resultado con esos filtros.</div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Destino</th>
                <th className="px-5 py-3 text-left">Fechas</th>
                <th className="px-5 py-3 text-left">Pasajeros</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Hospedaje</th>
                <th className="px-5 py-3 text-left">Total</th>
                <th className="px-5 py-3 text-left">{estado === 'cerrada' ? 'Cerrada' : 'Enviada'}</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {propuestasFiltradas.map(p => {
                const hospedajes = p.hospedajes_detalle || []
                const tipo = TIPO_LABEL[p.tipo_propuesta || 'simple']
                const adultos = p.cantidad_adultos ?? (p.tipo_propuesta ? null : p.cantidad_pasajeros)
                const menores = p.cantidad_menores || 0
                return (
                  <tr key={p.id}
                    onClick={() => puedeAbrir && abrirDetalle(p)}
                    className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${puedeAbrir ? 'cursor-pointer' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ESTADO_COLOR[estado] || 'bg-gray-300'}`} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-zinc-100 text-sm truncate">{p.cliente_nombre || '–'}</p>
                          {p.cliente_whatsapp && (
                            <a href={`https://wa.me/${p.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="text-green-600 dark:text-green-400 hover:underline text-xs">💬 {p.cliente_whatsapp}</a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 max-w-[200px]">
                      <p className="truncate">{destinoPropuesta(p) || '–'}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {fechasViaje(p) || '–'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {adultos > 0 && <span>👤 {adultos} ad.</span>}
                      {menores > 0 && <span className="ml-1">👶 {menores} men.</span>}
                      {!adultos && !menores && '–'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${tipo.color}`}>{tipo.label}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 text-xs max-w-[160px]">
                      {hospedajes.length === 0 && '–'}
                      {hospedajes.length === 1 && <span className="truncate block">{hospedajes[0].nombre}</span>}
                      {hospedajes.length > 1 && <span>{hospedajes.length} opciones</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 text-xs font-medium whitespace-nowrap">
                      {formatPrecio(p.total, p.moneda)}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {fechaTexto(p)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {estado === 'enviada' && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); cambiarEstado(p.id, 'rechazada') }}
                              disabled={procesandoId === p.id}
                              className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              Rechazar
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); abrirDetalle(p) }}
                              disabled={procesandoId === p.id}
                              className="text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              Elegir
                            </button>
                          </>
                        )}
                        {estado === 'cerrada' && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); cambiarEstado(p.id, 'enviada') }}
                              disabled={procesandoId === p.id}
                              className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              Volver a enviada
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); abrirDetalle(p) }}
                              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 whitespace-nowrap"
                            >
                              Ver detalle
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Segunda seccion, solo en la pagina de "enviadas": propuestas a las que
          ya se les eligió vuelo/hospedaje y se generó el PDF de cierre, pero
          todavia esperan que el cliente confirme o rechace. */}
      {estado === 'enviada' && (
        <div className="pt-6 border-t border-gray-100 dark:border-zinc-800 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Propuestas archivadas (esperando respuesta)</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              {archivadasFiltradas.length} de {archivadas.length} propuesta{archivadas.length !== 1 ? 's' : ''}
            </p>
          </div>

          {archivadas.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">No hay propuestas esperando respuesta.</div>
          ) : archivadasFiltradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">Ningún resultado con esos filtros.</div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Cliente</th>
                    <th className="px-5 py-3 text-left">Destino</th>
                    <th className="px-5 py-3 text-left">Fechas</th>
                    <th className="px-5 py-3 text-left">Tipo</th>
                    <th className="px-5 py-3 text-left">Hospedaje</th>
                    <th className="px-5 py-3 text-left">Total</th>
                    <th className="px-5 py-3 text-left"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {archivadasFiltradas.map(p => {
                    const hospedajes = p.hospedajes_detalle || []
                    const tipo = TIPO_LABEL[p.tipo_propuesta || 'simple']
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ESTADO_COLOR.archivada}`} />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-zinc-100 text-sm truncate">{p.cliente_nombre || '–'}</p>
                              {p.cliente_whatsapp && (
                                <a href={`https://wa.me/${p.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer"
                                  className="text-green-600 dark:text-green-400 hover:underline text-xs">💬 {p.cliente_whatsapp}</a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 max-w-[200px]">
                          <p className="truncate">{destinoPropuesta(p) || '–'}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                          {fechasViaje(p) || '–'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${tipo.color}`}>{tipo.label}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 text-xs max-w-[160px]">
                          {hospedajes.length === 0 && '–'}
                          {hospedajes.length >= 1 && <span className="truncate block">{hospedajes[0].nombre}</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 text-xs font-medium whitespace-nowrap">
                          {formatPrecio(p.total, p.moneda)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => cambiarEstado(p.id, 'enviada')}
                              disabled={procesandoId === p.id}
                              className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              Volver a enviada
                            </button>
                            <button
                              onClick={() => cambiarEstado(p.id, 'rechazada')}
                              disabled={procesandoId === p.id}
                              className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              Rechazada
                            </button>
                            <button
                              onClick={() => cambiarEstado(p.id, 'cerrada')}
                              disabled={procesandoId === p.id}
                              className="text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50 whitespace-nowrap"
                            >
                              Confirmada
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {cerrandoPropuesta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !generandoCierre && setCerrandoPropuesta(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">
                {estado === 'enviada' ? `Confirmar selección de ${cerrandoPropuesta.cliente_nombre}` : `Propuesta de ${cerrandoPropuesta.cliente_nombre}`}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                {estado === 'enviada' ? 'Confirmá lo que eligió el cliente para generar el PDF de cierre y pasarla a archivadas, esperando su respuesta final.' : 'Datos con los que quedó cerrada esta propuesta.'}
              </p>
            </div>

            {/* Cliente: no hay nada que elegir, se muestra ya confirmado */}
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="font-medium">{cerrandoPropuesta.cliente_nombre}</span>
                {cerrandoPropuesta.cliente_whatsapp && <span className="text-xs text-gray-400 dark:text-zinc-500">· {cerrandoPropuesta.cliente_whatsapp}</span>}
              </div>
            </div>

            {/* Vuelo elegido por el cliente — seleccionable si se cargó mas de una
                opción (igual que el hospedaje), de lo contrario solo se muestra. */}
            {vuelosOpciones.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
                  {estado === 'enviada' && vuelosOpciones.length > 1 ? 'Vuelo que eligió el cliente' : 'Vuelo'}
                </p>
                <div className="space-y-2">
                  {vuelosOpciones.map((v, i) => {
                    const seleccionado = vueloIdx === i
                    const Elemento = estado === 'enviada' ? 'button' : 'div'
                    const ida = resumenTramo(v.ida_fecha, v.origen_ciudad, v.origen_codigo, v.ida_sale, v.destino_ciudad, v.destino_codigo, v.ida_llega, v.ida_escala_ciudad, v.ida_escala_codigo, v.ida_escala_llega, v.ida_escala_sale)
                    const vuelta = resumenTramo(v.vuelta_fecha, v.destino_ciudad, v.destino_codigo, v.vuelta_sale, v.origen_ciudad, v.origen_codigo, v.vuelta_llega, v.vuelta_escala_ciudad, v.vuelta_escala_codigo, v.vuelta_escala_llega, v.vuelta_escala_sale)
                    return (
                      <Elemento key={i} type={estado === 'enviada' ? 'button' : undefined}
                        onClick={estado === 'enviada' ? () => setVueloIdx(i) : undefined}
                        className={`w-full border rounded-xl p-2.5 text-left transition-colors space-y-1 ${
                          seleccionado ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-zinc-700'
                        } ${estado === 'enviada' ? 'hover:border-brand-300' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            {ida && <p className="text-xs text-gray-600 dark:text-zinc-300">IDA: {ida}</p>}
                            {vuelta && <p className="text-xs text-gray-600 dark:text-zinc-300">VUELTA: {vuelta}</p>}
                            {(v.costo_neto || v.venta) && (
                              <p className="text-xs text-gray-400 dark:text-zinc-500">
                                {v.costo_neto && `Neto: ${formatearNumero(v.costo_neto)}`}
                                {v.costo_neto && v.venta && ' · '}
                                {v.venta && `Venta: ${formatearNumero(v.venta)}${v.venta_publica === false ? ' (privada)' : ''}`}
                              </p>
                            )}
                            {(v.traslado_costo_neto || v.traslado_venta) && (
                              <p className="text-xs text-gray-400 dark:text-zinc-500">
                                Traslado — {v.traslado_costo_neto && `Neto: ${formatearNumero(v.traslado_costo_neto)}`}
                                {v.traslado_costo_neto && v.traslado_venta && ' · '}
                                {v.traslado_venta && `Venta: ${formatearNumero(v.traslado_venta)}${v.traslado_venta_publica === false ? ' (privada)' : ''}`}
                              </p>
                            )}
                          </div>
                          {seleccionado && <span className="text-brand-600 dark:text-brand-400 text-sm flex-shrink-0">✓</span>}
                        </div>
                      </Elemento>
                    )
                  })}
                </div>
              </div>
            )}

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
                          <p className="text-xs text-gray-400 dark:text-zinc-500">
                            Venta: {formatPrecio(h.precio, h.moneda === 'ARS' ? 'ARS' : 'BRL')}{h.precio_publico === false ? ' (privada)' : ''}
                            {h.costo_interno ? ` · Neto: ${formatearNumero(h.costo_interno)}` : ''}
                          </p>
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
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
                ¿Incluye traslados?
                {trasladoRuta && <span className="font-normal text-gray-400 dark:text-zinc-500"> ({trasladoRuta})</span>}
              </p>
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

            {/* Combinada: cada transfer tiene su propio tramo salida -> destino
                (distinto al fijo aeropuerto-hotel de la simple) — se listan todos
                juntos como chequeo general antes de cerrar. */}
            {trayectosTransfer.length > 0 && (
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">Transfers</p>
                {trayectosTransfer.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>
                      <span className="font-medium">{d.salida || '—'} → {d.destino || '—'}</span>
                      {(d.valor_agencia_traslado || d.valor_cliente_traslado) && (
                        <span className="text-gray-400 dark:text-zinc-500">
                          {' — '}
                          {d.valor_agencia_traslado && `Neto: ${formatearNumero(d.valor_agencia_traslado)}`}
                          {d.valor_agencia_traslado && d.valor_cliente_traslado && ' · '}
                          {d.valor_cliente_traslado && `Venta: ${formatearNumero(d.valor_cliente_traslado)}${d.valor_cliente_traslado_publica === false ? ' (privada)' : ''}`}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Seguro de viaje */}
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">¿Incluye seguro de viaje?</p>
              {estado === 'enviada' ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSeguroViaje(true)}
                    className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
                      seguroViaje ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
                    }`}>
                    Sí
                  </button>
                  <button type="button" onClick={() => setSeguroViaje(false)}
                    className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
                      !seguroViaje ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
                    }`}>
                    No
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-zinc-300">{seguroViaje ? 'Sí' : 'No'}</p>
              )}
            </div>

            {/* Pago: el total sale solo (precio del hospedaje elegido, o la suma en
                combinada) — lo unico que se carga a mano es cuanto ya pagó el
                cliente, el saldo se calcula solo. */}
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Pago</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 block">Saldo</label>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{formatPrecio(saldoPago, monedaPago)}</p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 block">Pago inicial</label>
                  {estado === 'enviada' ? (
                    <input type="text" inputMode="numeric" value={formatearMiles(sena)} onChange={e => setSena(soloDigitos(e.target.value))} placeholder="0"
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-zinc-300">{formatPrecio(sena, monedaPago)}</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 block">Valor total</label>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{formatPrecio(totalPago, monedaPago)}</p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">Vencimiento del saldo</label>
                {estado === 'enviada' ? (
                  <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                ) : (
                  <p className="text-sm text-gray-700 dark:text-zinc-300">{vencimiento ? new Date(vencimiento + 'T00:00:00').toLocaleDateString('es-AR') : 'No definido'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">Valor congelado en reales (opcional)</label>
                {estado === 'enviada' ? (
                  <input type="text" inputMode="numeric" value={formatearMiles(valorCongeladoBrl)} onChange={e => setValorCongeladoBrl(soloDigitos(e.target.value))} placeholder="R$"
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                ) : (
                  <p className="text-sm text-gray-700 dark:text-zinc-300">{valorCongeladoBrl ? `R$ ${formatearNumero(valorCongeladoBrl)}` : 'No definido'}</p>
                )}
              </div>
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
                  {generandoCierre ? 'Generando...' : 'Generar y archivar'}
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
