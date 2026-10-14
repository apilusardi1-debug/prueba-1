import { useState, useEffect } from 'react'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { BTN_PRINCIPAL } from '../../components/public/botones.js'
import { useSeo } from '../../lib/seo.js'
import { useTextos } from '../../context/LanguageContext.jsx'

// Página que explica cómo funcionan los traslados. Antes /traslados era el
// catálogo de paseos filtrado (buscador, "1 resultado encontrado", cupos),
// que no tiene sentido para un servicio a medida. El precio "desde" sale del
// producto de categoría "traslados" de la base, así se actualiza solo.

const ICONOS_TIPOS = ['flight_land', 'route', 'tune']
const ICONOS_DATOS = ['event', 'flight', 'location_on', 'group', 'luggage']

const TEXTOS = {
  es: {
    seoTitulo: 'Traslados privados',
    seoDescripcion: 'Traslados privados desde el aeropuerto de Recife a Porto de Galinhas, Maragogi y más destinos del Nordeste, con atención en español.',
    cotizar: 'Cotizar mi traslado', titulo: 'Traslados privados', bajada: 'Coordinados con tu vuelo y tu hospedaje',
    intro: 'Te buscamos en el aeropuerto, te llevamos a tu hospedaje y te conectamos entre los destinos del Nordeste. Viajás solo con tu grupo y con el horario armado a tu medida.',
    desde: 'Desde', porTraslado: 'por traslado',
    tiposTitulo: 'Qué traslados hacemos',
    tipos: [
      { titulo: 'Llegada y salida', texto: 'Del aeropuerto a tu hospedaje y de vuelta, con el horario coordinado según tu vuelo.' },
      { titulo: 'Entre ciudades', texto: 'Conexiones entre los destinos del Nordeste, para cuando tu viaje combina más de un lugar.' },
      { titulo: 'Recorridos a medida', texto: 'Armamos el trayecto que necesites, con la parada y el horario que te queden cómodos.' },
    ],
    comoTitulo: 'Cómo funciona',
    pasos: [
      { titulo: 'Escribinos tus datos', texto: 'Fecha y hora, número de vuelo, desde dónde y hasta dónde vas, cuántas personas viajan y qué equipaje llevan.' },
      { titulo: 'Te pasamos el precio', texto: 'Depende del trayecto, el horario, el vehículo y la cantidad de pasajeros.' },
      { titulo: 'Confirmamos tu traslado', texto: 'Dejamos todo coordinado y asignamos a tu chofer.' },
      { titulo: 'El día del viaje', texto: 'Tu chofer te busca en el horario acordado y te lleva directo a destino. Es un servicio privado: viajás solo con tu grupo.' },
    ],
    datosTitulo: 'Para cotizar, tené a mano', datosTexto: 'Con estos datos te pasamos el precio y dejamos tu traslado coordinado.',
    datos: ['Fecha y hora', 'Número de vuelo', 'Origen y destino', 'Cantidad de personas', 'Equipaje (valijas, caja de surf, bicicleta, cochecito)'],
    mensaje: 'Hola! Quiero cotizar un traslado.\nFecha y hora:\nVuelo:\nDesde:\nHasta:\nPersonas:\nEquipaje:',
  },
  pt: {
    seoTitulo: 'Traslados privativos',
    seoDescripcion: 'Traslados privativos do aeroporto do Recife para Porto de Galinhas, Maragogi e outros destinos do Nordeste, com atendimento em espanhol.',
    cotizar: 'Cotar meu traslado', titulo: 'Traslados privativos', bajada: 'Coordenados com seu voo e sua hospedagem',
    intro: 'Buscamos você no aeroporto, levamos até a sua hospedagem e fazemos a conexão entre os destinos do Nordeste. Você viaja só com o seu grupo, no horário que for melhor para você.',
    desde: 'A partir de', porTraslado: 'por traslado',
    tiposTitulo: 'Quais traslados fazemos',
    tipos: [
      { titulo: 'Chegada e saída', texto: 'Do aeroporto até a sua hospedagem e de volta, com o horário coordenado de acordo com o seu voo.' },
      { titulo: 'Entre cidades', texto: 'Conexões entre os destinos do Nordeste, para quando a sua viagem combina mais de um lugar.' },
      { titulo: 'Trajetos sob medida', texto: 'Montamos o trajeto que você precisar, com a parada e o horário mais convenientes.' },
    ],
    comoTitulo: 'Como funciona',
    pasos: [
      { titulo: 'Envie seus dados', texto: 'Data e hora, número do voo, de onde e para onde você vai, quantas pessoas viajam e qual bagagem levam.' },
      { titulo: 'Passamos o preço', texto: 'Depende do trajeto, do horário, do veículo e do número de passageiros.' },
      { titulo: 'Confirmamos seu traslado', texto: 'Deixamos tudo coordenado e designamos o seu motorista.' },
      { titulo: 'No dia da viagem', texto: 'Seu motorista te busca no horário combinado e te leva direto ao destino. É um serviço privativo: você viaja só com o seu grupo.' },
    ],
    datosTitulo: 'Para cotar, tenha em mãos', datosTexto: 'Com esses dados passamos o preço e deixamos seu traslado coordenado.',
    datos: ['Data e hora', 'Número do voo', 'Origem e destino', 'Número de pessoas', 'Bagagem (malas, capa de prancha, bicicleta, carrinho de bebê)'],
    mensaje: 'Olá! Quero cotar um traslado.\nData e hora:\nVoo:\nDe:\nPara:\nPessoas:\nBagagem:',
  },
  en: {
    seoTitulo: 'Private transfers',
    seoDescripcion: 'Private transfers from Recife airport to Porto de Galinhas, Maragogi and other destinations in Northeast Brazil, with Spanish-speaking support.',
    cotizar: 'Get a transfer quote', titulo: 'Private transfers', bajada: 'Coordinated with your flight and accommodation',
    intro: 'We pick you up at the airport, take you to your accommodation and connect you between destinations in Northeast Brazil. You travel only with your group, on a schedule that suits you.',
    desde: 'From', porTraslado: 'per transfer',
    tiposTitulo: 'Transfers we offer',
    tipos: [
      { titulo: 'Arrival and departure', texto: 'From the airport to your accommodation and back, timed around your flight.' },
      { titulo: 'Between cities', texto: 'Connections between destinations in Northeast Brazil, for trips that combine more than one place.' },
      { titulo: 'Custom routes', texto: 'We plan the route you need, with the stops and times that suit you.' },
    ],
    comoTitulo: 'How it works',
    pasos: [
      { titulo: 'Send us your details', texto: 'Date and time, flight number, where you’re going from and to, how many people are traveling and what luggage you have.' },
      { titulo: 'We send you the price', texto: 'It depends on the route, the time, the vehicle and the number of passengers.' },
      { titulo: 'We confirm your transfer', texto: 'We coordinate everything and assign your driver.' },
      { titulo: 'On the day', texto: 'Your driver picks you up at the agreed time and takes you straight to your destination. It’s a private service: you travel only with your group.' },
    ],
    datosTitulo: 'To get a quote, have ready', datosTexto: 'With these details we’ll send you the price and coordinate your transfer.',
    datos: ['Date and time', 'Flight number', 'Pick-up and drop-off', 'Number of people', 'Luggage (suitcases, surfboard bag, bike, stroller)'],
    mensaje: "Hi! I'd like a quote for a transfer.\nDate and time:\nFlight:\nFrom:\nTo:\nPeople:\nLuggage:",
  },
}

export default function TrasladosInfo() {
  const tx = useTextos(TEXTOS)
  useSeo({ titulo: tx.seoTitulo, descripcion: tx.seoDescripcion })
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

  const waHref = `https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(tx.mensaje)}`

  const Boton = () => (
    <a href={waHref} target="_blank" rel="noopener noreferrer"
      className={BTN_PRINCIPAL}>
      <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chat</span>
      {tx.cotizar}
    </a>
  )

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            {tx.titulo}
          </h1>
          <p className="font-display-hero uppercase text-hero-cream mb-4"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            {tx.bajada}
          </p>
          <p className="font-body-md text-body-lg text-hero-cream/80 max-w-2xl mb-8">
            {tx.intro}
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Boton claro />
            {desde && (
              <p className="font-display-hero uppercase text-hero-cream text-xl tracking-wide">
                {tx.desde} <span className="text-hero-yellow">{desde}</span> {tx.porTraslado}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-14 md:py-20">
        {/* Qué traslados hacemos */}
        <h2 className="font-display-hero uppercase text-hero-navy mb-6"
          style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
          {tx.tiposTitulo}
        </h2>
        <div className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-14">
          {tx.tipos.map(({ titulo, texto }, i) => (
            <div key={i} className="p-7 bg-white rounded-2xl border border-hero-navy/10">
              <div className="w-14 h-14 rounded-full bg-hero-cream flex items-center justify-center mb-4">
                <span aria-hidden="true" className="material-symbols-outlined text-hero-navy text-[28px]">{ICONOS_TIPOS[i]}</span>
              </div>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-1">{titulo}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </div>
          ))}
        </div>

        {/* Cómo funciona */}
        <h2 className="font-display-hero uppercase text-hero-navy mb-6"
          style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
          {tx.comoTitulo}
        </h2>
        <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-gutter mb-14">
          {tx.pasos.map(({ titulo, texto }, i) => (
            <li key={i} className="p-7 bg-hero-cream rounded-2xl">
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
              {tx.datosTitulo}
            </h2>
            <p className="font-body-md text-body-md text-hero-cream/80 mb-6">
              {tx.datosTexto}
            </p>
            {/* En el celular el botón va debajo de la lista */}
            <div className="hidden md:block"><Boton claro /></div>
          </div>
          <ul className="flex flex-col gap-3">
            {tx.datos.map((texto, i) => (
              <li key={i} className="flex items-center gap-3 text-hero-cream">
                <span aria-hidden="true" className="material-symbols-outlined text-hero-sky text-[22px]">{ICONOS_DATOS[i]}</span>
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
