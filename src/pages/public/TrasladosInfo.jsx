import { useState, useEffect } from 'react'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { BTN_PRINCIPAL } from '../../components/public/botones.js'
import { useSeo } from '../../lib/seo.js'

// Página que explica cómo funcionan los traslados. Antes /traslados era el
// catálogo de paseos filtrado (buscador, "1 resultado encontrado", cupos),
// que no tiene sentido para un servicio a medida. El precio "desde" sale del
// producto de categoría "traslados" de la base, así se actualiza solo.

const TIPOS = [
  { icono: 'flight_land', titulo: 'Llegada y salida', texto: 'Del aeropuerto a tu hospedaje y de vuelta, con el horario coordinado según tu vuelo.' },
  { icono: 'route', titulo: 'Entre ciudades', texto: 'Conexiones entre los destinos del Nordeste, para cuando tu viaje combina más de un lugar.' },
  { icono: 'tune', titulo: 'Recorridos a medida', texto: 'Armamos el trayecto que necesites, con la parada y el horario que te queden cómodos.' },
]

const PASOS = [
  { titulo: 'Escribinos tus datos', texto: 'Fecha y hora, número de vuelo, desde dónde y hasta dónde vas, cuántas personas viajan y qué equipaje llevan.' },
  { titulo: 'Te pasamos el precio', texto: 'Depende del trayecto, el horario, el vehículo y la cantidad de pasajeros.' },
  { titulo: 'Confirmamos tu traslado', texto: 'Dejamos todo coordinado y asignamos a tu chofer.' },
  { titulo: 'El día del viaje', texto: 'Tu chofer te busca en el horario acordado y te lleva directo a destino. Es un servicio privado: viajás solo con tu grupo.' },
]

const DATOS = [
  { icono: 'event', texto: 'Fecha y hora' },
  { icono: 'flight', texto: 'Número de vuelo' },
  { icono: 'location_on', texto: 'Origen y destino' },
  { icono: 'group', texto: 'Cantidad de personas' },
  { icono: 'luggage', texto: 'Equipaje (valijas, caja de surf, bicicleta, cochecito)' },
]

const MENSAJE_WA = `Hola! Quiero cotizar un traslado.
Fecha y hora:
Vuelo:
Desde:
Hasta:
Personas:
Equipaje:`

export default function TrasladosInfo() {
  useSeo({ titulo: 'Traslados privados', descripcion: 'Traslados privados desde el aeropuerto de Recife a Porto de Galinhas, Maragogi y más destinos del Nordeste, con atención en español.' })
  const { config } = useSiteConfig()
  const [desde, setDesde] = useState(null)

  useEffect(() => {
    excursionesApi.getAll()?.then(({ data }) => {
      const precios = (data || []).map(normalizarExcursion)
        .filter(e => e.categoria === 'traslados' && Number(e.precio) > 0)
        .sort((a, b) => a.precio - b.precio)
      if (precios[0]) setDesde(formatPrecio(precios[0].precio, precios[0].moneda))
    }).catch(() => {})
  }, [])

  const waHref = `https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(MENSAJE_WA)}`

  const Boton = () => (
    <a href={waHref} target="_blank" rel="noopener noreferrer"
      className={BTN_PRINCIPAL}>
      <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chat</span>
      Cotizar mi traslado
    </a>
  )

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            Traslados privados
          </h1>
          <p className="font-display-hero uppercase text-hero-cream mb-4"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            Coordinados con tu vuelo y tu hospedaje
          </p>
          <p className="font-body-md text-body-lg text-hero-cream/80 max-w-2xl mb-8">
            Te buscamos en el aeropuerto, te llevamos a tu hospedaje y te conectamos entre los destinos del Nordeste. Viajás solo con tu grupo y con el horario armado a tu medida.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Boton claro />
            {desde && (
              <p className="font-display-hero uppercase text-hero-cream text-xl tracking-wide">
                Desde <span className="text-hero-yellow">{desde}</span> por traslado
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-14 md:py-20">
        {/* Qué traslados hacemos */}
        <h2 className="font-display-hero uppercase text-hero-navy mb-6"
          style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
          Qué traslados hacemos
        </h2>
        <div className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-14">
          {TIPOS.map(({ icono, titulo, texto }) => (
            <div key={titulo} className="p-7 bg-white rounded-2xl border border-hero-navy/10">
              <div className="w-14 h-14 rounded-full bg-hero-cream flex items-center justify-center mb-4">
                <span aria-hidden="true" className="material-symbols-outlined text-hero-navy text-[28px]">{icono}</span>
              </div>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-1">{titulo}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </div>
          ))}
        </div>

        {/* Cómo funciona */}
        <h2 className="font-display-hero uppercase text-hero-navy mb-6"
          style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
          Cómo funciona
        </h2>
        <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-gutter mb-14">
          {PASOS.map(({ titulo, texto }, i) => (
            <li key={titulo} className="p-7 bg-hero-cream rounded-2xl">
              <span className="w-10 h-10 rounded-full bg-hero-navy text-hero-yellow font-display-hero text-2xl flex items-center justify-center mb-4">
                {i + 1}
              </span>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-1">{titulo}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </li>
          ))}
        </ol>

        {/* Qué datos necesitamos + CTA */}
        <div className="bg-hero-navy rounded-2xl p-8 md:p-12 grid md:grid-cols-[1.2fr_1fr] gap-8 md:gap-12 items-center">
          <div>
            <h2 className="font-display-hero uppercase text-hero-cream mb-2"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
              Para cotizar, tené a mano
            </h2>
            <p className="font-body-md text-body-md text-hero-cream/80 mb-6">
              Con estos datos te pasamos el precio y dejamos tu traslado coordinado.
            </p>
            {/* En el celular el botón va debajo de la lista */}
            <div className="hidden md:block"><Boton claro /></div>
          </div>
          <ul className="flex flex-col gap-3">
            {DATOS.map(({ icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-hero-cream">
                <span aria-hidden="true" className="material-symbols-outlined text-hero-sky text-[22px]">{icono}</span>
                <span className="font-body-md text-body-md">{texto}</span>
              </li>
            ))}
          </ul>
          <div className="md:hidden"><Boton claro /></div>
        </div>
      </div>
    </div>
  )
}
