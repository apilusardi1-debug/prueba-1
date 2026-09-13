import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { destinos, formatPrecio } from '../../data/mockData.js'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function Destinos() {
  const { t } = useLang()
  const [excursiones, setExcursiones] = useState([])

  useEffect(() => {
    excursionesApi.getAll().then(({ data }) => {
      if (data) setExcursiones(data.map(normalizarExcursion))
    }).catch(() => {})
  }, [])

  // Precio "desde" real por destino (paquetes cargados en el admin), en vez
  // de los datos de mockData.js que quedaban desactualizados sin relación
  // con el inventario real.
  const desdePorDestino = useMemo(() => {
    const map = {}
    excursiones
      .filter((e) => e.categoria === 'paquetes')
      .forEach((e) => {
        if (!map[e.destino] || e.precio < map[e.destino].precio) {
          map[e.destino] = { precio: e.precio, moneda: e.moneda }
        }
      })
    return map
  }, [excursiones])

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            {t('nav_destinations')}
          </h1>
          <p className="font-display-hero uppercase text-hero-cream"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            Nordeste brasileño — los mejores destinos de playa de Brasil
          </p>
        </div>
      </section>

      {/* ── LISTADO ──────────────────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinos.map((d) => {
              const desde = desdePorDestino[d.nombre]
              return (
                <Link key={d.id} to={`/destinos/${d.id}`}
                  className="group flex flex-col bg-white border-2 border-hero-navy/10 hover:border-hero-navy rounded-2xl overflow-hidden transition-colors">
                  <div className="relative h-56 overflow-hidden">
                    <img src={d.imagen} alt={d.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean/85 via-deep-ocean/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-5">
                      <h2 className="font-display-hero uppercase text-hero-yellow leading-none mb-1"
                        style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)' }}>
                        {d.nombre}
                      </h2>
                      <p className="font-label-lg text-label-sm uppercase text-sand-beige/90">{d.estado}</p>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <p className="font-body-md text-body-md text-on-surface-variant flex-1 line-clamp-2">{d.descripcion}</p>
                    <div className="pt-3 border-t border-surface-variant flex items-center justify-between gap-3">
                      {desde ? (
                        <span className="font-label-lg text-label-sm uppercase text-hero-navy font-bold whitespace-nowrap">
                          Desde {formatPrecio(desde.precio, desde.moneda)}
                        </span>
                      ) : (
                        <span className="font-body-md text-body-md text-on-surface-variant">Consultá disponibilidad</span>
                      )}
                      <span className="font-label-lg text-label-sm uppercase text-hero-navy group-hover:underline whitespace-nowrap">Explorar →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
