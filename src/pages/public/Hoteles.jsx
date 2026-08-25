import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { hospedajesApi } from '../../lib/supabase.js'

function Estrellas({ n }) {
  if (!n) return null
  return (
    <span className="text-hero-yellow text-sm tracking-tight">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

export default function Hoteles() {
  const [hospedajes, setHospedajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [destino, setDestino] = useState('')

  useEffect(() => {
    hospedajesApi.getAll().then(({ data }) => {
      setHospedajes(data || [])
      setLoading(false)
    })
  }, [])

  const destinos = useMemo(
    () => Array.from(new Set(hospedajes.map(h => h.destino).filter(Boolean))).sort(),
    [hospedajes]
  )

  const filtrados = useMemo(() => {
    return hospedajes.filter(h => {
      if (destino && h.destino !== destino) return false
      if (busqueda && !h.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [hospedajes, busqueda, destino])

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            Hoteles y Posadas
          </h1>
          <p className="font-display-hero uppercase text-hero-cream mb-8"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            Los mejores alojamientos del Nordeste Brasileño
          </p>

          {/* Buscador + filtro de destino */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full md:w-72 px-5 py-3 rounded-full border-2 border-hero-navy/0 bg-white text-deep-ocean font-body-md text-body-md placeholder-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-hero-yellow"
            />
            {destinos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDestino('')}
                  className={`font-label-lg text-label-sm uppercase px-4 py-2 rounded-full border-2 transition-colors ${
                    destino === '' ? 'bg-hero-yellow border-hero-yellow text-hero-navy' : 'border-hero-cream/40 text-hero-cream hover:border-hero-cream'
                  }`}>
                  Todos
                </button>
                {destinos.map(d => (
                  <button key={d} onClick={() => setDestino(d)}
                    className={`font-label-lg text-label-sm uppercase px-4 py-2 rounded-full border-2 transition-colors ${
                      destino === d ? 'bg-hero-yellow border-hero-yellow text-hero-navy' : 'border-hero-cream/40 text-hero-cream hover:border-hero-cream'
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
              No encontramos hospedajes con esos filtros.
            </p>
          ) : (
            <>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                {filtrados.length} hospedaje{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtrados.map(h => (
                  <Link key={h.id} to={`/hoteles/${h.id}`}
                    className="group flex flex-col bg-white border-2 border-hero-navy/10 hover:border-hero-navy rounded-2xl overflow-hidden transition-colors">
                    <div className="relative h-52 overflow-hidden bg-surface-variant">
                      {h.imagen ? (
                        <img src={h.imagen} alt={h.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : null}
                      <span className="absolute top-3 left-3 bg-white/90 text-hero-navy font-label-lg text-label-sm uppercase px-3 py-1 rounded-full">
                        {h.tipo}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col flex-1 gap-1.5">
                      <h3 className="font-display-hero uppercase text-hero-navy text-lg leading-tight">{h.nombre}</h3>
                      <Estrellas n={h.estrellas} />
                      <p className="font-label-lg text-label-sm uppercase text-deep-ocean/70">{h.destino}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant flex-1 line-clamp-2 mt-1">{h.descripcion}</p>
                      <div className="mt-3 pt-3 border-t border-surface-variant flex items-center justify-end">
                        <span className="font-label-lg text-label-sm uppercase text-hero-navy group-hover:underline">Ver más →</span>
                      </div>
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
