import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'
import { BotonAgregarPaseo } from '../../components/public/SeleccionPaseos.jsx'

// `categoria` es el valor crudo de la base ('excursiones', 'paquetes',
// 'traslados') — acá se traduce a lo que ve el cliente ("Excursiones" ahora
// se llama "Paseos" en todo el sitio).
const CATEGORIA_LABEL = { excursiones: 'Paseos', paquetes: 'Paquetes', traslados: 'Traslados' }

// No todos los paseos se cobran por persona (ej. Buggy/Jet Ski/Quad son por
// vehículo, con varias personas incluidas) — `precioUnidad` viene de la base
// y se traduce acá a la leyenda que va arriba del precio.
const UNIDAD_PRECIO_LABEL = {
  persona: 'Precio por persona',
  paseo:   'Precio por paseo',
  sesion:  'Precio por sesión',
  sesión:  'Precio por sesión',
  traslado: 'Precio por traslado',
}

function IconoCheck() {
  return (
    <svg className="w-4 h-4 text-hero-navy flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ExcursionDetalle() {
  const { id } = useParams()
  const { t } = useLang()
  const [ex, setEx] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const { data, error } = await excursionesApi.getById(id)
        if (!error && data) setEx(normalizarExcursion(data))
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) {
    return (
      <div className="bg-surface min-h-screen pt-32 flex justify-center">
        <div className="w-8 h-8 border-4 border-hero-navy/20 border-t-hero-navy rounded-full animate-spin" />
      </div>
    )
  }

  if (!ex) {
    return (
      <div className="bg-surface min-h-screen pt-32 px-margin-mobile text-center">
        <p className="font-display-hero uppercase text-hero-navy text-2xl mb-4">Paseo no encontrado</p>
        <Link to="/excursiones" className="font-label-lg text-label-sm uppercase text-hero-navy underline">{t('detail_back')}</Link>
      </div>
    )
  }

  const backTo = ex.categoria === 'paquetes' ? '/paquetes' : ex.categoria === 'traslados' ? '/traslados' : '/excursiones'
  const metaCards = [
    { label: t('detail_duration'), value: ex.duracion, icon: 'schedule' },
    { label: t('detail_difficulty'), value: ex.dificultad, icon: 'flag' },
    // Los paseos (categoria "excursiones") no muestran cupos — pedido explícito
    ...(ex.categoria !== 'excursiones' ? [{ label: t('detail_spots'), value: `${ex.cuposDisponibles} / ${ex.cupos}`, icon: 'group', red: ex.cuposDisponibles <= 3 }] : []),
    { label: t('detail_category'), value: CATEGORIA_LABEL[ex.categoria] || ex.categoria, icon: 'sell' },
  ].filter(m => m.value)

  return (
    <div className="bg-surface min-h-screen">
      <div className="pt-24 md:pt-28 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Link to={backTo} className="inline-flex items-center gap-1.5 font-label-lg text-label-sm uppercase text-hero-navy/70 hover:text-hero-navy mb-6">
          {t('detail_back')}
        </Link>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Foto + incluye */}
          <div>
            <div className="rounded-2xl overflow-hidden bg-surface-variant h-72 md:h-96">
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-full object-cover" />
            </div>
            {ex.incluye?.length > 0 && (
              <div className="mt-6">
                <p className="font-label-lg text-label-sm uppercase text-on-surface-variant mb-3">{t('detail_includes')}</p>
                <div className="grid gap-y-2.5 gap-x-4 sm:grid-cols-2">
                  {ex.incluye.map(item => (
                    <div key={item} className="flex items-center gap-2 font-body-md text-body-md text-deep-ocean">
                      <IconoCheck /> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {ex.destino && (
              <span className="inline-block font-label-lg text-label-sm uppercase bg-hero-cream text-hero-navy px-3 py-1 rounded-full mb-3">
                {ex.destino}
              </span>
            )}
            <h1 className="font-display-hero uppercase text-hero-navy leading-none mb-3"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '0.01em' }}>
              {ex.nombre}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-6">{ex.descripcion}</p>

            {metaCards.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {metaCards.map(({ label, value, icon, red }) => (
                  <div key={label} className="bg-white border-2 border-hero-navy/10 rounded-xl px-4 py-3 text-center">
                    <p className="font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">{label}</p>
                    <p className={`font-label-lg text-[14px] flex items-center justify-center gap-1.5 ${red ? 'text-red-600' : 'text-hero-navy'}`}>
                      <span className="material-symbols-outlined text-[16px]">{icon}</span>{value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {ex.fechas?.length > 0 && (
              <div className="mb-7">
                <p className="font-label-lg text-label-sm uppercase text-on-surface-variant mb-3">{t('detail_next_dates')}</p>
                <div className="flex flex-wrap gap-2">
                  {ex.fechas.map(f => (
                    <span key={f} className="bg-hero-cream text-hero-navy font-label-lg text-[13px] font-semibold px-3.5 py-1.5 rounded-lg">
                      {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t-2 border-hero-navy/10 pt-6">
              <div>
                <p className="font-label-sm text-[11px] uppercase text-on-surface-variant mb-1">{UNIDAD_PRECIO_LABEL[ex.precioUnidad] || t('detail_per_person')}</p>
                <p className="font-display-hero text-hero-navy leading-none" style={{ fontSize: '2rem' }}>{formatPrecio(ex.precio, ex.moneda)}</p>
              </div>
              {/* La reserva se cierra por WhatsApp desde "Mi selección", no en el sitio */}
              {ex.categoria === 'excursiones' && <BotonAgregarPaseo ex={ex} className="px-7 py-3.5" />}
            </div>
          </div>
        </div>
      </div>

      <div className="h-16" />

    </div>
  )
}
