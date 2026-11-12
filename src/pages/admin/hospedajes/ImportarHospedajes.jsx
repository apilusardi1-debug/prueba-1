import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TIPOS_LABEL } from '../../../components/admin/HospedajeForm.jsx'
import { hospedajesApi, habitacionesApi, importarHospedajesDeLink } from '../../../lib/supabase.js'
import { hotelIdsDeLink, traerHotelesNiara } from '../../../lib/niaraHotel.js'

const TIPOS_VALIDOS = ['Resort', 'Hotel', 'Pousada', 'Departamento']

// Niara da la ciudad (Ipojuca, Tibau do Sul); el catálogo agrupa por destino turístico.
const DESTINO_POR_CIUDAD = { ipojuca: 'Porto de Galinhas', 'tibau do sul': 'Pipa' }

function normalizar(str) {
  return (str || '').trim().toLowerCase()
}

// Niara pone casi todo en la categoría "Hotel" -- el nombre lo corrige cuando es obvio.
function tipoDesdeNiara(item) {
  const nombre = normalizar(item.nombre)
  if (/\bpou?sada\b/.test(nombre) && !/\bhotel\b/.test(nombre)) return 'Pousada'
  if (/\bresort\b/.test(nombre)) return 'Resort'
  return TIPOS_VALIDOS.includes(item.tipo) ? item.tipo : 'Hotel'
}

// Las descripciones de Niara vienen a veces en portugués y a veces ya en español: se
// traduce con detección automática del idioma (sl=auto) para no estropear lo que ya está bien.
async function traducirTexto(texto, to = 'es') {
  if (!texto || !texto.trim()) return texto || ''
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(texto)}`
    )
    if (!res.ok) return texto
    const data = await res.json()
    return (data?.[0] || []).map(chunk => chunk[0]).join('')
  } catch {
    return texto
  }
}

// El traductor "traduce" nombres propios de la zona.
function corregirTraduccion(texto) {
  return (texto || '')
    .replace(/Puerto de Gallinas|Puerto de Galinhas/g, 'Porto de Galinhas')
    .replace(/\bOporto\b/g, 'Porto')
    .replace(/Gilberto Freire\b/g, 'Gilberto Freyre')
}

// Servicios repetidos o mal escritos que trae Niara.
const AMENITIES_DESCARTAR = ['wireless internet', 'acceso a internet de alta velocidad', 'acceso a internet']
const AMENITIES_CORREGIR = {
  'estacionamento gratuito': 'Estacionamiento gratuito',
  'estacionamento con costo': 'Estacionamiento con costo',
  'recepcion 24 horas': 'Recepción 24 horas',
  'tarjetas de credito aceptadas': 'Tarjetas de crédito aceptadas',
  'servicio diario de limpieza': 'Servicio diario de limpieza',
  'lavanderia/tintorería': 'Lavandería/Tintorería',
}
function limpiarAmenities(lista) {
  const vistos = new Set()
  return (lista || [])
    .map(a => (a || '').trim())
    .filter(Boolean)
    .filter(a => !AMENITIES_DESCARTAR.includes(normalizar(a)))
    .map(a => AMENITIES_CORREGIR[normalizar(a)] || a)
    .filter(a => (vistos.has(normalizar(a)) ? false : vistos.add(normalizar(a))))
}

async function datosDesdeNiara(item) {
  const ciudad = (item.destino || '').split(',')[0].trim()
  const imagen = item.imagen || ''
  // Los .png de la galería suelen ser banners de promoción, no fotos.
  const galeria = (item.imagenes || []).filter(u => u && u !== imagen && !/\.png(\?|$)/i.test(u))
  const precioNoche = item.noches > 0 && item.precio
    ? Math.round((item.precio / item.noches) * 100) / 100
    : (item.precio ?? null)

  // Los amenities ya vienen en español (locale=es-MX): no se traducen.
  const descripcion = corregirTraduccion(await traducirTexto(item.descripcion))

  return {
    nombre: (item.nombre || '').replace(/\s+/g, ' ').trim(),
    tipo: tipoDesdeNiara(item),
    destino: DESTINO_POR_CIUDAD[normalizar(ciudad)] || ciudad,
    ubicacion: ciudad,
    direccion: (item.direccion || '').replace(/\s+/g, ' ').trim(),
    descripcion,
    imagen,
    galeria,
    amenities: limpiarAmenities(item.amenities),
    estrellas: item.estrellas || 0,
    capacidad: 0,
    precio_min: precioNoche,
    contacto: '',
    whatsapp: '',
    activa: true,
    origen: 'Niara',
  }
}

// Las habitaciones vienen en español (locale=es-MX), sin necesidad de traducir.
function habitacionesDesdeNiara(item) {
  return (item.habitaciones || []).map(h => ({
    nombre: h.nombre || '',
    superficie: h.superficie || null,
    capacidad: h.capacidad || 0,
    cantidad: h.cantidad || 0,
    camas: h.camas || '',
    // "Vista aleatoria" no le dice nada al cliente.
    vista: (h.vista || '').split(', ').filter(v => v && v !== 'Vista aleatoria').join(', '),
    descripcion: h.descripcion || '',
    imagen: h.imagen || '',
    galeria: h.galeria || [],
    amenities: limpiarAmenities(h.amenities),
  }))
}

// Link de ficha de hotel -> se lee directo; link de cotización -> Edge Function.
async function buscarEnNiara(link) {
  const ids = hotelIdsDeLink(link)
  if (ids.length) {
    const hospedajes = await traerHotelesNiara(ids)
    if (!hospedajes.length) return { error: 'No se pudo leer ese hotel en Niara. Revisá el link.' }
    return { hospedajes }
  }
  const { data, error } = await importarHospedajesDeLink(link)
  if (error || data?.error) return { error: data?.error || error?.message || 'No se pudo leer ese link.' }
  return { hospedajes: data?.hospedajes || [] }
}

function Estrellas({ n }) {
  if (!n) return null
  return <span className="text-amber-400 text-xs">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

export default function ImportarHospedajes() {
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [resultados, setResultados] = useState([])
  const [existentes, setExistentes] = useState(new Map()) // nombre normalizado -> id del hospedaje ya cargado
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 })
  const [resumen, setResumen] = useState(null)

  async function buscar() {
    if (!link.trim()) return
    setError(null)
    setResumen(null)
    setResultados([])
    setBuscando(true)
    try {
      const [{ data: catalogo }, res] = await Promise.all([
        hospedajesApi.getAll(),
        buscarEnNiara(link.trim()),
      ])
      if (res.error) {
        setError(res.error)
        return
      }
      const encontrados = res.hospedajes
      const mapaExistentes = new Map((catalogo || []).map(h => [normalizar(h.nombre), h.id]))
      setExistentes(mapaExistentes)
      setResultados(encontrados)
      setSeleccionados(new Set(
        encontrados.filter(h => !mapaExistentes.has(normalizar(h.nombre))).map(h => h.hotel_id)
      ))
    } catch (e) {
      setError(e.message || 'No se pudo leer ese link.')
    } finally {
      setBuscando(false)
    }
  }

  function toggle(hotelId) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(hotelId) ? next.delete(hotelId) : next.add(hotelId)
      return next
    })
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(resultados.map(h => h.hotel_id)))
  }
  function seleccionarNinguno() {
    setSeleccionados(new Set())
  }

  async function importar() {
    const elegidos = resultados.filter(h => seleccionados.has(h.hotel_id))
    if (!elegidos.length) return
    setImportando(true)
    setProgreso({ hecho: 0, total: elegidos.length })
    let ok = 0
    let actualizados = 0
    const errores = []

    for (const item of elegidos) {
      try {
        const idExistente = existentes.get(normalizar(item.nombre))
        const habitaciones = habitacionesDesdeNiara(item)

        if (idExistente) {
          // Ya está en el catálogo -- no se duplica, solo se le cargan/
          // reemplazan las habitaciones (no se tocan nombre/descripcion/etc,
          // por si fueron editados a mano).
          const { error: errDel } = await habitacionesApi.deleteByHospedaje(idExistente)
          if (errDel) throw errDel
          if (habitaciones.length) {
            const { error: errHab } = await habitacionesApi.createMany(
              habitaciones.map(h => ({ ...h, hospedaje_id: idExistente }))
            )
            if (errHab) throw errHab
          }
          actualizados++
        } else {
          const datos = await datosDesdeNiara(item)
          const { data: creado, error: err } = await hospedajesApi.create(datos)
          if (err) throw err

          if (habitaciones.length) {
            const { error: errHab } = await habitacionesApi.createMany(
              habitaciones.map(h => ({ ...h, hospedaje_id: creado.id }))
            )
            if (errHab) throw errHab
          }
          ok++
        }
      } catch (e) {
        errores.push({ nombre: item.nombre, mensaje: e.message || 'error desconocido' })
      }
      setProgreso(p => ({ ...p, hecho: p.hecho + 1 }))
    }

    setImportando(false)
    setResumen({ ok, actualizados, errores })
    setResultados([])
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Importar desde Niara</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          Pegá el link de un hotel de Niara (el de la ficha del hotel) o de una cotización, y elegí qué hospedajes sumar al catálogo, con fotos, ubicación, descripción y tipos de habitación.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6">
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Link de Niara (hotel o cotización)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') buscar() }}
            placeholder="https://dreamstours.niara.tech/hotels4/HOTEL_OMNI_..."
            className="flex-1 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={buscar}
            disabled={buscando || !link.trim()}
            className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {buscando && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400 mt-3 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}
      </div>

      {resumen && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-zinc-100">
              {resumen.ok > 0 && <>{resumen.ok} hospedaje{resumen.ok !== 1 ? 's' : ''} importado{resumen.ok !== 1 ? 's' : ''}</>}
              {resumen.ok > 0 && resumen.actualizados > 0 && ' · '}
              {resumen.actualizados > 0 && <>{resumen.actualizados} actualizado{resumen.actualizados !== 1 ? 's' : ''} con sus habitaciones</>}
            </p>
            {resumen.errores.length > 0 && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                {resumen.errores.length} con error: {resumen.errores.map(e => e.nombre).join(', ')}
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setResumen(null); setLink('') }} className="border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2 px-4 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              Importar otro link
            </button>
            <button onClick={() => navigate('/admin/hospedajes')} className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white py-2 px-4 rounded-xl text-sm font-semibold transition-colors">
              Ver listado
            </button>
          </div>
        </div>
      )}

      {importando && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 text-center space-y-3">
          <p className="text-sm text-gray-600 dark:text-zinc-400">Traduciendo e importando {progreso.hecho} / {progreso.total}...</p>
          <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-200"
              style={{ width: `${progreso.total ? (progreso.hecho / progreso.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {!importando && resultados.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {resultados.length} encontrados · {seleccionados.size} seleccionados
            </p>
            <div className="flex items-center gap-3">
              <button onClick={seleccionarTodos} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">Todos</button>
              <button onClick={seleccionarNinguno} className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium">Ninguno</button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
            {resultados.map(h => {
              const yaExiste = existentes.has(normalizar(h.nombre))
              const marcado = seleccionados.has(h.hotel_id)
              return (
                <label key={h.hotel_id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={marcado} onChange={() => toggle(h.hotel_id)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-400 flex-shrink-0" />
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
                    {h.imagen ? <img src={h.imagen} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900 dark:text-zinc-100 truncate">{h.nombre}</p>
                      {yaExiste && (
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full flex-shrink-0">Ya en el catálogo</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                      {TIPOS_LABEL[tipoDesdeNiara(h)] || tipoDesdeNiara(h)} · {DESTINO_POR_CIUDAD[normalizar((h.destino || '').split(',')[0])] || (h.destino || '').split(',')[0]}
                      {h.habitaciones?.length > 0 && ` · ${h.habitaciones.length} tipo${h.habitaciones.length !== 1 ? 's' : ''} de habitación`}
                    </p>
                  </div>
                  <Estrellas n={h.estrellas} />
                </label>
              )
            })}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              onClick={importar}
              disabled={seleccionados.size === 0}
              className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Importar {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
