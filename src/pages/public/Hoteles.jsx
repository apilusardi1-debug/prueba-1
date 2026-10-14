import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { hospedajesApi } from '../../lib/supabase.js'
import { useSeo } from '../../lib/seo.js'
import { useTextos } from '../../context/LanguageContext.jsx'

function Estrellas({ n }) {
  if (!n) return null
  return (
    <span className="text-hero-yellow text-sm tracking-tight">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

const TEXTOS = {
  es: {
    titulo: 'Hoteles y posadas', bajada: 'Los mejores alojamientos del Nordeste Brasileño',
    seoDescripcion: 'Hoteles, posadas y departamentos en el Nordeste de Brasil, elegidos por DreamTours. Consultá disponibilidad y armá tu paquete.',
    buscar: 'Buscar por nombre...', todos: 'Todos', sinResultados: 'No encontramos hospedajes con esos filtros.',
    resultados: n => `${n} hospedaje${n !== 1 ? 's' : ''} encontrado${n !== 1 ? 's' : ''}`, verMas: 'Ver más →',
    tipos: { Pousada: 'Posada' },
  },
  pt: {
    titulo: 'Hotéis e pousadas', bajada: 'As melhores hospedagens do Nordeste brasileiro',
    seoDescripcion: 'Hotéis, pousadas e apartamentos no Nordeste do Brasil, escolhidos pela DreamTours. Consulte a disponibilidade e monte seu pacote.',
    buscar: 'Buscar por nome...', todos: 'Todos', sinResultados: 'Não encontramos hospedagens com esses filtros.',
    resultados: n => `${n} hospedage${n !== 1 ? 'ns' : 'm'} encontrada${n !== 1 ? 's' : ''}`, verMas: 'Ver mais →',
    tipos: { Departamento: 'Apartamento' },
  },
  en: {
    titulo: 'Hotels and inns', bajada: 'The best places to stay in Northeast Brazil',
    seoDescripcion: 'Hotels, inns and apartments in Northeast Brazil, hand-picked by DreamTours. Check availability and build your package.',
    buscar: 'Search by name...', todos: 'All', sinResultados: 'No accommodation matches those filters.',
    resultados: n => `${n} place${n !== 1 ? 's' : ''} found`, verMas: 'See more →',
    tipos: { Departamento: 'Apartment', Pousada: 'Inn' },
  },
}

export default function Hoteles() {
  const tx = useTextos(TEXTOS)
  useSeo({ titulo: tx.titulo, descripcion: tx.seoDescripcion })
  const [searchParams] = useSearchParams()
  const [hospedajes, setHospedajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  // Permite llegar acá desde una ficha de destino (/destinos/:id) ya
  // filtrado por ese destino, sin perder la posibilidad de cambiarlo.
  const [destino, setDestino] = useState(searchParams.get('destino') || '')

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
            {tx.titulo}
          </h1>
          <p className="font-display-hero uppercase text-hero-cream mb-8"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            {tx.bajada}
          </p>

          {/* Buscador + filtro de destino */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder={tx.buscar} aria-label={tx.buscar}
              className="w-full md:w-72 px-5 py-3 rounded-full border-2 border-hero-navy/0 bg-white text-deep-ocean font-body-md text-body-md placeholder-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-hero-yellow"
            />
            {destinos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDestino('')}
                  className={`font-label-lg text-label-sm uppercase px-4 py-2 rounded-full border-2 transition-colors ${
                    destino === '' ? 'bg-hero-yellow border-hero-yellow text-hero-navy' : 'border-hero-cream/40 text-hero-cream hover:border-hero-cream'
                  }`}>
                  {tx.todos}
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
      <section className="py-14 md:py-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-8 h-8 border-4 border-hero-navy/20 border-t-hero-navy rounded-full animate-spin" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center font-body-md text-body-md text-on-surface-variant py-24">
              {tx.sinResultados}
            </p>
          ) : (
            <>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                {tx.resultados(filtrados.length)}
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
                        {tx.tipos[h.tipo] || h.tipo}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col flex-1 gap-1.5">
                      <h3 className="font-display-hero uppercase text-hero-navy text-lg leading-tight">{h.nombre}</h3>
                      <Estrellas n={h.estrellas} />
                      <p className="font-label-lg text-label-sm uppercase text-deep-ocean/85">{h.destino}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant flex-1 line-clamp-2 mt-1">{h.descripcion}</p>
                      <div className="mt-3 pt-3 border-t border-surface-variant flex items-center justify-end">
                        <span className="font-label-lg text-label-sm uppercase text-hero-navy group-hover:underline">{tx.verMas}</span>
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
