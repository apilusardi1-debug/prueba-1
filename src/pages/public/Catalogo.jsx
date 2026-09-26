import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'

// No todos los paseos se cobran por persona (ej. Buggy/Jet Ski/Quad son por
// vehículo, con varias personas incluidas) — se aclara acá abajo del precio
// para no repetir el error de mostrar "por persona" cuando no corresponde.
const UNIDAD_PRECIO_LABEL = {
  paseo:    '/ paseo',
  sesion:   '/ sesión',
  sesión:   '/ sesión',
  traslado: '/ traslado',
}

export default function Catalogo({ categoria }) {
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [destinoFiltro, setDestinoFiltro] = useState('')

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const { data, error } = await excursionesApi.getAll()
        if (!error && data) setExcursiones(data.map(normalizarExcursion))
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = excursiones.filter((ex) => {
    const matchCat = !categoria || ex.categoria === categoria
    const matchDest = !destinoFiltro || ex.destino === destinoFiltro
    const matchBusq = !busqueda || ex.nombre.toLowerCase().includes(busqueda.toLowerCase()) || ex.destino?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchDest && matchBusq
  })

  const destinosUnicos = [...new Set(excursiones.filter(e => !categoria || e.categoria === categoria).map(e => e.destino).filter(Boolean))].sort()

  const tituloLabel = categoria === 'paquetes' ? 'Paquetes Aéreos' : categoria === 'excursiones' ? 'Paseos' : categoria === 'traslados' ? 'Traslados' : 'Catálogo'
  // Los paseos (ex "Excursiones") siempre incluyen guía en español y traslado
  // privado — dato importante para el cliente, se aclara acá en vez del
  // subtítulo genérico que comparten las demás categorías.
  const subtituloLabel = categoria === 'excursiones'
    ? 'Todos nuestros paseos incluyen guía en español y traslado privado'
    : 'Encontrá tu próximo viaje al Nordeste Brasilero'

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            {tituloLabel}
          </h1>
          <p className="font-display-hero uppercase text-hero-cream mb-8"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            {subtituloLabel}
          </p>

          {/* Buscador + filtro de destino */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative w-full md:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] pointer-events-none">search</span>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por destino o nombre..."
                className="w-full pl-11 pr-5 py-3 rounded-full border-2 border-transparent bg-white text-deep-ocean font-body-md text-body-md placeholder-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-hero-yellow"
              />
            </div>
            {destinosUnicos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDestinoFiltro('')}
                  className={`font-label-lg text-label-sm uppercase px-4 py-2 rounded-full border-2 transition-colors ${
                    destinoFiltro === '' ? 'bg-hero-yellow border-hero-yellow text-hero-navy' : 'border-hero-cream/40 text-hero-cream hover:border-hero-cream'
                  }`}>
                  Todos
                </button>
                {destinosUnicos.map(d => (
                  <button key={d} onClick={() => setDestinoFiltro(d)}
                    className={`font-label-lg text-label-sm uppercase px-4 py-2 rounded-full border-2 transition-colors ${
                      destinoFiltro === d ? 'bg-hero-yellow border-hero-yellow text-hero-navy' : 'border-hero-cream/40 text-hero-cream hover:border-hero-cream'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── LISTADO ──────────────────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-8 h-8 border-4 border-hero-navy/20 border-t-hero-navy rounded-full animate-spin" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center font-body-md text-body-md text-on-surface-variant py-24">
              No encontramos {categoria === 'excursiones' ? 'paseos' : categoria === 'traslados' ? 'traslados' : 'paquetes'} con esos filtros.
            </p>
          ) : (
            <>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {filtrados.map(ex => (
                  <Link key={ex.id} to={`/excursiones/${ex.id}`}
                    className="group flex flex-col rounded-3xl overflow-hidden border-2 border-hero-navy shadow-[0_8px_24px_rgba(0,33,71,0.12)] hover:shadow-[0_12px_32px_rgba(0,33,71,0.2)] transition-shadow">
                    <div className="relative h-52 overflow-hidden bg-surface-variant flex-shrink-0">
                      <img
                        src={ex.imagen || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'}
                        alt={ex.nombre}
                        onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {ex.destino && (
                        <span className="absolute top-3 left-3 bg-hero-navy/80 backdrop-blur-sm text-hero-cream font-label-sm text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full">
                          {ex.destino}
                        </span>
                      )}
                      {/* Los paseos (categoria "excursiones") no muestran cupos — pedido explícito */}
                      {ex.categoria !== 'excursiones' && ex.cuposDisponibles <= 3 && (
                        <span className="absolute top-3 right-3 bg-red-600 text-white font-label-sm text-[10px] uppercase px-3 py-1.5 rounded-full">
                          ¡Últimos {ex.cuposDisponibles}!
                        </span>
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-1 gap-2 bg-white">
                      <h3 className="font-display-hero uppercase text-hero-navy text-lg leading-tight">{ex.nombre}</h3>
                      <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 flex-1">{ex.descripcion}</p>
                      <div className="flex items-center gap-4 font-label-sm text-label-sm uppercase text-deep-ocean/70 pt-1">
                        {ex.duracion && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">schedule</span>{ex.duracion}
                          </span>
                        )}
                        {ex.categoria !== 'excursiones' && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">group</span>{ex.cuposDisponibles} cupos
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-hero-navy px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-label-sm text-[10px] uppercase text-hero-cream/70 block leading-none mb-1">Desde</span>
                        <span className="font-display-hero text-hero-yellow text-xl leading-none">
                          {formatPrecio(ex.precio, ex.moneda)}
                          {UNIDAD_PRECIO_LABEL[ex.precioUnidad] && (
                            <span className="text-[11px] normal-case font-label-sm text-hero-cream/70 ml-1">{UNIDAD_PRECIO_LABEL[ex.precioUnidad]}</span>
                          )}
                        </span>
                      </div>
                      <span className="font-label-lg text-label-sm uppercase text-hero-cream group-hover:underline whitespace-nowrap">Ver detalle</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
