import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { hospedajesApi, habitacionesApi } from '../../lib/supabase.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

function Estrellas({ n }) {
  if (!n) return null
  return (
    <span className="text-hero-yellow text-base tracking-tight">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

function IconoCheck() {
  return (
    <svg className="w-4 h-4 text-hero-navy flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function HotelDetalle() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const habitacionParam = searchParams.get('habitacion')
  // Links del generador de propuestas agregan esto para que el cliente vea
  // SOLO esta ficha (sin poder navegar a otros hospedajes del sitio) — el
  // resto de la navegación se oculta acá y en PublicLayout.
  const standalone = searchParams.get('standalone') === '1'
  const { config } = useSiteConfig()
  const [h, setH] = useState(null)
  const [habitaciones, setHabitaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [habitacionActiva, setHabitacionActiva] = useState(null)

  useEffect(() => {
    setLoading(true)
    setHabitacionActiva(null)
    Promise.all([
      hospedajesApi.getById(id),
      habitacionesApi.getByHospedaje(id),
    ]).then(([{ data: hospedaje }, { data: habs }]) => {
      setH(hospedaje || null)
      setHabitaciones(habs || [])
      // Si el link trae una habitacion puntual (ej: desde una propuesta en PDF),
      // arranca mostrando esa directamente en vez de las fotos generales del hotel.
      if (habitacionParam) {
        const hab = (habs || []).find(x => x.id === habitacionParam)
        if (hab) setHabitacionActiva(hab)
      }
      setLoading(false)
    })
  }, [id, habitacionParam])

  const fotosHotel = h ? [h.imagen, ...(h.galeria || [])].filter(Boolean) : []
  const fotos = habitacionActiva ? [habitacionActiva.imagen, ...(habitacionActiva.galeria || [])].filter(Boolean) : fotosHotel
  const videoActivo = habitacionActiva ? habitacionActiva.video : h?.video
  const [fotoActiva, setFotoActiva] = useState('')
  useEffect(() => { setFotoActiva(fotos[0] || '') }, [habitacionActiva, h?.id])

  if (loading) {
    return (
      <div className="bg-surface min-h-screen pt-32 flex justify-center">
        <div className="w-8 h-8 border-4 border-hero-navy/20 border-t-hero-navy rounded-full animate-spin" />
      </div>
    )
  }

  if (!h) {
    return (
      <div className="bg-surface min-h-screen pt-32 px-margin-mobile text-center">
        <p className="font-display-hero uppercase text-hero-navy text-2xl mb-4">Hospedaje no encontrado</p>
        <Link to="/hoteles" className="font-label-lg text-label-lg uppercase text-hero-navy underline">← Volver al listado</Link>
      </div>
    )
  }

  const direccionCompleta = [h.direccion, h.destino].filter(Boolean).join(', ')
  const mapsUrl = direccionCompleta ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta)}` : null
  const whatsapp = h.whatsapp || config?.whatsapp || ''
  const mensaje = `Hola! Me interesa el hospedaje ${h.nombre}${h.destino ? ` en ${h.destino}` : ''}`
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`

  return (
    <div className="bg-surface min-h-screen">
      <div className="pt-24 md:pt-28 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {!standalone && (
          <Link to="/hoteles" className="inline-flex items-center gap-1.5 font-label-lg text-label-sm uppercase text-hero-navy/70 hover:text-hero-navy mb-6">
            ← Volver a hoteles
          </Link>
        )}

        <div className="grid md:grid-cols-2 gap-10">
          {/* Fotos */}
          <div>
            {habitacionActiva && (
              <div className="flex items-center justify-between mb-2">
                <p className="font-label-lg text-label-sm uppercase text-on-surface-variant">
                  Fotos: <span className="text-hero-navy">{habitacionActiva.nombre}</span>
                </p>
                <button onClick={() => setHabitacionActiva(null)} className="font-label-lg text-label-sm uppercase text-hero-navy underline">
                  Ver fotos del hotel
                </button>
              </div>
            )}
            <div className="rounded-2xl overflow-hidden mb-2 bg-surface-variant h-72 md:h-96">
              {fotoActiva ? (
                <img src={fotoActiva} alt={h.nombre} className="w-full h-full object-cover" />
              ) : videoActivo ? (
                <video key={videoActivo} src={videoActivo} controls playsInline className="w-full h-full object-cover bg-black" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-body-md text-body-md">Sin foto</div>
              )}
            </div>
            {fotos.length > 1 && (
              <div className="grid grid-cols-6 gap-1.5">
                {fotos.map((f, i) => (
                  <button key={i} onClick={() => setFotoActiva(f)}
                    className={`rounded-lg overflow-hidden h-14 border-2 transition-colors ${fotoActiva === f ? 'border-hero-navy' : 'border-transparent opacity-80 hover:opacity-100'}`}>
                    <img src={f} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {fotoActiva && videoActivo && (
              <div className="rounded-2xl overflow-hidden mt-3 bg-black">
                <video key={videoActivo} src={videoActivo} controls playsInline className="w-full max-h-96" />
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <span className="inline-block font-label-lg text-label-sm uppercase bg-hero-cream text-hero-navy px-3 py-1 rounded-full mb-3">
              {h.tipo}
            </span>
            <h1 className="font-display-hero uppercase text-hero-navy leading-none mb-2"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '0.01em' }}>
              {h.nombre}
            </h1>
            <Estrellas n={h.estrellas} />
            {direccionCompleta && (
              <p className="font-body-md text-body-md text-on-surface-variant flex items-center flex-wrap gap-x-1.5 mt-2 mb-5">
                <span>📍 {direccionCompleta}</span>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-hero-navy underline font-medium">
                    Ver mapa
                  </a>
                )}
              </p>
            )}
            {h.descripcion && (
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line mb-5">{h.descripcion}</p>
            )}
            {h.capacidad > 0 && (
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">👥 Hasta {h.capacidad} personas</p>
            )}
            {(h.amenities || []).length > 0 && (
              <div className="mb-6">
                <p className="font-label-lg text-label-sm uppercase text-on-surface-variant mb-3">Servicios del hotel</p>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                  {h.amenities.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 font-body-md text-body-md text-deep-ocean">
                      <IconoCheck /> {a}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-hero-navy text-white font-display-hero uppercase text-lg px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity">
              Consultar disponibilidad
              <span className="material-symbols-outlined text-hero-yellow text-xl">chat</span>
            </a>
          </div>
        </div>

        {/* Habitaciones */}
        {habitaciones.length > 0 && (
          <div className="mt-14 pt-10 border-t border-surface-variant">
            <h2 className="font-display-hero uppercase text-hero-navy mb-6"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', letterSpacing: '0.01em' }}>
              Tipos de habitación
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {habitaciones.map(hab => {
                const totalFotos = [hab.imagen, ...(hab.galeria || [])].filter(Boolean).length
                const seleccionada = habitacionActiva?.id === hab.id
                return (
                  <button key={hab.id} onClick={() => setHabitacionActiva(hab)}
                    className={`flex gap-3 border-2 rounded-xl p-3 text-left transition-colors ${
                      seleccionada ? 'border-hero-navy bg-hero-cream/40' : 'border-hero-navy/10 hover:border-hero-navy/40 bg-white'
                    }`}>
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-surface-variant flex-shrink-0">
                      {hab.imagen ? (
                        <img src={hab.imagen} alt="" className="w-full h-full object-cover" />
                      ) : hab.video ? (
                        <video src={`${hab.video}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      ) : null}
                      {totalFotos > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 bg-hero-navy/80 text-white text-[10px] font-semibold px-1.5 rounded">
                          {totalFotos} fotos
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display-hero uppercase text-hero-navy text-sm leading-tight">{hab.nombre}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                        {[
                          hab.superficie ? `${hab.superficie} m²` : null,
                          hab.capacidad ? `hasta ${hab.capacidad} huéspedes` : null,
                          hab.camas || null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {hab.vista && <p className="font-body-md text-body-md text-on-surface-variant/70 text-sm">{hab.vista}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="h-16" />
    </div>
  )
}
