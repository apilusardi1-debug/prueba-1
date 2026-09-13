import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { destinos } from '../../data/mockData.js'
import { excursionesApi, normalizarExcursion, hospedajesApi } from '../../lib/supabase.js'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

const HOSPEDAJES_PREVIEW = 6

function Estrellas({ n }) {
  if (!n) return null
  return (
    <span className="text-hero-yellow text-sm tracking-tight">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

function CardPaquete({ ex }) {
  return (
    <Link to={`/excursiones/${ex.id}`}
      className="group block rounded-3xl overflow-hidden border-2 border-hero-navy shadow-[0_8px_24px_rgba(0,33,71,0.12)] hover:shadow-[0_12px_32px_rgba(0,33,71,0.2)] transition-shadow">
      <div className="h-52 overflow-hidden bg-surface-variant">
        <img src={ex.imagen} alt={ex.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="bg-hero-navy px-5 py-4">
        <h3 className="font-display-hero uppercase text-hero-cream text-lg leading-tight mb-2 line-clamp-2">{ex.nombre}</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="font-label-sm text-[11px] uppercase text-hero-cream/90 whitespace-nowrap">
            Desde {ex.moneda === 'USD' ? 'US$' : 'R$'} {ex.precio}
          </span>
          {ex.duracion && (
            <span className="font-label-sm text-[11px] uppercase text-hero-yellow font-bold whitespace-nowrap">{ex.duracion}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function CardHospedaje({ h }) {
  return (
    <Link to={`/hoteles/${h.id}`}
      className="group block rounded-2xl overflow-hidden bg-white border border-hero-navy/10 hover:border-hero-navy/40 hover:shadow-[0_10px_30px_rgba(0,33,71,0.08)] transition-all">
      <div className="h-44 overflow-hidden bg-surface-variant">
        {h.imagen ? (
          <img src={h.imagen} alt={h.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-body-md text-body-md">Sin foto</div>
        )}
      </div>
      <div className="p-4">
        {h.tipo && (
          <span className="inline-block font-label-lg text-label-sm uppercase bg-hero-cream text-hero-navy px-2.5 py-0.5 rounded-full mb-2">
            {h.tipo}
          </span>
        )}
        <h3 className="font-display-hero uppercase text-hero-navy text-base leading-tight mb-1">{h.nombre}</h3>
        <Estrellas n={h.estrellas} />
      </div>
    </Link>
  )
}

export default function DestinoDetalle() {
  const { id } = useParams()
  const { t } = useLang()
  const { config } = useSiteConfig()
  const destino = destinos.find((d) => d.id === id)

  const [excursiones, setExcursiones] = useState([])
  const [hospedajes, setHospedajes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!destino) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      excursionesApi.getAll(),
      hospedajesApi.getAll(),
    ]).then(([{ data: exData }, { data: hospData }]) => {
      setExcursiones((exData || []).map(normalizarExcursion).filter((e) => e.destino === destino.nombre))
      setHospedajes((hospData || []).filter((h) => h.destino === destino.nombre))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [destino?.id])

  if (!destino) {
    return (
      <div className="bg-surface min-h-screen pt-32 px-margin-mobile text-center">
        <p className="text-5xl mb-4">📍</p>
        <p className="font-display-hero uppercase text-hero-navy text-2xl mb-4">Destino no encontrado</p>
        <Link to="/destinos" className="font-label-lg text-label-lg uppercase text-hero-navy underline">← Volver a destinos</Link>
      </div>
    )
  }

  const paquetesDestino = excursiones.filter((e) => e.categoria === 'paquetes')
  const excursionesDestino = excursiones.filter((e) => e.categoria === 'excursiones')
  const hayContenido = paquetesDestino.length > 0 || excursionesDestino.length > 0 || hospedajes.length > 0
  const whatsappHref = `https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(`Hola! Quiero consultar por un viaje a ${destino.nombre}`)}`

  return (
    <div className="bg-surface">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[520px] md:min-h-[620px] flex flex-col justify-end pt-32 pb-12 md:pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={destino.imagen} alt={destino.nombre} className="w-full h-full object-cover" />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
          <Link to="/destinos" className="inline-flex items-center gap-1.5 font-label-lg text-label-sm uppercase text-hero-cream/80 hover:text-hero-cream mb-5">
            ← {t('nav_destinations')}
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl md:text-4xl leading-none">{destino.icono}</span>
            <span className="font-label-lg text-label-sm uppercase text-hero-cream/80 tracking-wide">{destino.estado} · Brasil</span>
          </div>
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none mb-5"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '0.01em' }}>
            {destino.nombre}
          </h1>
          <p className="font-body-lg text-body-lg text-hero-cream/90 max-w-xl mb-8 leading-relaxed">
            {destino.descripcion}
          </p>
          <div className="flex gap-4 flex-wrap">
            {hayContenido && (
              <a href="#contenido"
                className="border-2 border-hero-yellow text-hero-cream font-label-lg text-label-lg uppercase px-8 py-3 rounded-full transition-colors hover:bg-hero-yellow hover:text-hero-navy">
                Ver paquetes
              </a>
            )}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
              className="bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-8 py-3 rounded-full hover:opacity-90 transition-opacity inline-flex items-center gap-2">
              Consultar disponibilidad
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── CONTENIDO ────────────────────────────────────────── */}
      <div id="contenido" className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-14 md:py-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-hero-navy/20 border-t-hero-navy rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Paquetes */}
            {paquetesDestino.length > 0 && (
              <div className="mb-16">
                <h2 className="font-display-hero uppercase text-hero-navy mb-8"
                  style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
                  {t('nav_packages')}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paquetesDestino.map((ex) => <CardPaquete key={ex.id} ex={ex} />)}
                </div>
              </div>
            )}

            {/* Excursiones */}
            {excursionesDestino.length > 0 && (
              <div className="mb-16">
                <h2 className="font-display-hero uppercase text-hero-navy mb-8"
                  style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
                  {t('nav_excursions')}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {excursionesDestino.map((ex) => <CardPaquete key={ex.id} ex={ex} />)}
                </div>
              </div>
            )}

            {/* Hospedajes */}
            {hospedajes.length > 0 && (
              <div className="mb-16">
                <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
                  <h2 className="font-display-hero uppercase text-hero-navy"
                    style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
                    Hospedajes en {destino.nombre}
                  </h2>
                  {hospedajes.length > HOSPEDAJES_PREVIEW && (
                    <Link to={`/hoteles?destino=${encodeURIComponent(destino.nombre)}`}
                      className="inline-flex items-center gap-1.5 font-label-lg text-label-sm uppercase text-hero-navy hover:opacity-70 transition-opacity">
                      Ver los {hospedajes.length} hospedajes
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hospedajes.slice(0, HOSPEDAJES_PREVIEW).map((h) => <CardHospedaje key={h.id} h={h} />)}
                </div>
              </div>
            )}

            {/* Sin contenido todavía */}
            {!hayContenido && (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🏖️</p>
                <p className="font-display-hero uppercase text-hero-navy text-2xl mb-3">Muy pronto en {destino.nombre}</p>
                <p className="font-body-md text-body-md text-on-surface-variant mb-8 max-w-md mx-auto">
                  Estamos armando paquetes y hospedajes para este destino. Escribinos y te ayudamos a organizar tu viaje a medida.
                </p>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-hero-navy text-white font-label-lg text-label-lg uppercase px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity">
                  Consultá disponibilidad
                  <span className="material-symbols-outlined text-hero-yellow text-[20px]">flight</span>
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CTA WHATSAPP ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-[3fr_2fr] md:min-h-[360px]">
        <div className="bg-hero-sky px-margin-mobile md:px-20 py-14 md:py-0 flex flex-col justify-center">
          <h2 className="font-display-hero uppercase text-white mb-8"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '0.01em' }}>
            ¿Querés armar tu viaje a {destino.nombre} a medida?
          </h2>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
            className="self-start inline-flex items-center gap-2 bg-hero-navy text-white font-display-hero uppercase text-xl px-8 py-4 rounded-full hover:opacity-90 transition-opacity">
            Hablar por WhatsApp
            <span className="material-symbols-outlined text-hero-yellow text-2xl">flight</span>
          </a>
        </div>
        <div className="relative h-56 md:h-full overflow-hidden">
          <img src={destino.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </section>
    </div>
  )
}
