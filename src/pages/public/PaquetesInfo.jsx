import { useState } from 'react'
import { Link } from 'react-router-dom'
import { destinosEn } from '../../data/destinosTraducciones.js'
import FormularioPaquete from '../../components/public/FormularioPaquete.jsx'
import { BTN_PRINCIPAL } from '../../components/public/botones.js'
import { useSeo } from '../../lib/seo.js'
import { useLang, useTextos } from '../../context/LanguageContext.jsx'

// Página que explica cómo funcionan los paquetes. Antes /paquetes era el
// catálogo filtrado con paquetes armados de antemano; los paquetes se arman a
// medida de cada viajero, así que la página cuenta qué incluyen, cómo se
// arman y el acompañamiento de las anfitrionas. Los destinos son los mismos
// de la página Destinos (mockData.js), así una sola lista manda en las dos.

const ICONOS_INCLUYE = ['flight', 'hotel', 'airport_shuttle']

const TEXTOS = {
  es: {
    seoTitulo: 'Paquetes a medida',
    seoDescripcion: 'Vuelos, hospedaje y traslado privado en un solo paquete armado a tu medida, con el acompañamiento de nuestras anfitrionas durante todo el viaje.',
    armar: 'Armar mi paquete', titulo: 'Paquetes a medida', bajada: 'Vuelos, hospedaje y traslado en un solo lugar',
    intro: 'Nos encargamos de buscar tu mejor opción de vuelos, encontrar el hospedaje ideal según tu presupuesto y coordinar tu traslado privado desde el aeropuerto hasta tu alojamiento. Vos solo pensá en disfrutar.',
    incluyeTitulo: 'Qué incluye tu paquete',
    incluye: [
      { titulo: 'Vuelos', texto: 'Buscamos la mejor opción de vuelos para tus fechas.' },
      { titulo: 'Hospedaje', texto: 'Encontramos tu hospedaje ideal según tu presupuesto.' },
      { titulo: 'Traslado privado', texto: 'Coordinamos tu traslado privado del aeropuerto a tu alojamiento.' },
    ],
    combinaTitulo: 'Combiná destinos',
    combinaTexto: 'Podés sumar más de un destino en el mismo viaje: por ejemplo, Porto de Galinhas + Maceió, o Maragogi + Fernando de Noronha. Armamos los vuelos, hospedajes y traslados para que todo encaje.',
    comoTitulo: 'Cómo funciona',
    pasos: [
      { titulo: 'Contanos tu viaje', texto: 'Qué destinos te interesan, las fechas, cuántos viajan (y la edad de los menores) y tu presupuesto.' },
      { titulo: 'Te armamos la propuesta', texto: 'Con opciones de vuelos, hospedaje y traslado pensadas para vos.' },
      { titulo: 'Confirmás y viajás acompañado', texto: 'Desde ese momento te asisten nuestras anfitrionas, antes de llegar y durante toda la estadía.' },
    ],
    acompTitulo: 'Te acompañamos todo el viaje',
    acomp1: 'Vas a contar con el acompañamiento de nuestras anfitrionas,', acomp1b: 'que te asisten antes de llegar y durante toda tu estadía.',
    anfitrionas: 'Agostina y Victoria',
    acomp2: 'Ellas te envían el check-in y las tarjetas de embarque, y te ayudan con cualquier gestión que necesites.',
    gestiones: [
      'Contratación del seguro de viaje', 'Equipaje adicional', 'Compra y selección de asientos',
      'Excursiones y paseos de Dream Tours', 'Pago de saldos pendientes', 'Asistencia y orientación durante todo el viaje',
    ],
    legal: 'Dream Tours actúa como intermediario entre el pasajero y los proveedores contratados (aerolíneas, hospedajes y traslados), brindando asistencia y acompañamiento durante toda la experiencia.',
  },
  pt: {
    seoTitulo: 'Pacotes sob medida',
    seoDescripcion: 'Voos, hospedagem e traslado privativo em um só pacote montado sob medida, com o acompanhamento das nossas anfitriãs durante toda a viagem.',
    armar: 'Montar meu pacote', titulo: 'Pacotes sob medida', bajada: 'Voos, hospedagem e traslado em um só lugar',
    intro: 'Cuidamos de buscar a melhor opção de voos, encontrar a hospedagem ideal para o seu orçamento e coordenar seu traslado privativo do aeroporto até a sua acomodação. Você só precisa pensar em aproveitar.',
    incluyeTitulo: 'O que inclui o seu pacote',
    incluye: [
      { titulo: 'Voos', texto: 'Buscamos a melhor opção de voos para as suas datas.' },
      { titulo: 'Hospedagem', texto: 'Encontramos a hospedagem ideal para o seu orçamento.' },
      { titulo: 'Traslado privativo', texto: 'Coordenamos seu traslado privativo do aeroporto até a sua acomodação.' },
    ],
    combinaTitulo: 'Combine destinos',
    combinaTexto: 'Você pode incluir mais de um destino na mesma viagem: por exemplo, Porto de Galinhas + Maceió, ou Maragogi + Fernando de Noronha. Organizamos voos, hospedagens e traslados para que tudo se encaixe.',
    comoTitulo: 'Como funciona',
    pasos: [
      { titulo: 'Conte-nos sobre sua viagem', texto: 'Quais destinos te interessam, as datas, quantas pessoas viajam (e a idade dos menores) e seu orçamento.' },
      { titulo: 'Montamos a proposta', texto: 'Com opções de voos, hospedagem e traslado pensadas para você.' },
      { titulo: 'Você confirma e viaja acompanhado', texto: 'A partir desse momento, nossas anfitriãs te atendem, antes de chegar e durante toda a estadia.' },
    ],
    acompTitulo: 'Acompanhamos você a viagem toda',
    acomp1: 'Você vai contar com o acompanhamento das nossas anfitriãs,', acomp1b: 'que te atendem antes de chegar e durante toda a sua estadia.',
    anfitrionas: 'Agostina e Victoria',
    acomp2: 'Elas enviam o check-in e os cartões de embarque e te ajudam com tudo o que você precisar.',
    gestiones: [
      'Contratação do seguro viagem', 'Bagagem adicional', 'Compra e escolha de assentos',
      'Excursões e passeios da Dream Tours', 'Pagamento de saldos pendentes', 'Assistência e orientação durante toda a viagem',
    ],
    legal: 'A Dream Tours atua como intermediária entre o passageiro e os fornecedores contratados (companhias aéreas, hospedagens e traslados), oferecendo assistência e acompanhamento durante toda a experiência.',
  },
  en: {
    seoTitulo: 'Tailor-made packages',
    seoDescripcion: 'Flights, accommodation and private transfer in one package built around you, with support from our hosts throughout your trip.',
    armar: 'Build my package', titulo: 'Tailor-made packages', bajada: 'Flights, accommodation and transfers in one place',
    intro: 'We find the best flight options, the right accommodation for your budget, and arrange your private transfer from the airport to where you’re staying. All you have to think about is enjoying it.',
    incluyeTitulo: 'What your package includes',
    incluye: [
      { titulo: 'Flights', texto: 'We find the best flight options for your dates.' },
      { titulo: 'Accommodation', texto: 'We find the right place to stay for your budget.' },
      { titulo: 'Private transfer', texto: 'We arrange your private transfer from the airport to your accommodation.' },
    ],
    combinaTitulo: 'Combine destinations',
    combinaTexto: 'You can add more than one destination to the same trip: for example, Porto de Galinhas + Maceió, or Maragogi + Fernando de Noronha. We arrange flights, accommodation and transfers so everything fits together.',
    comoTitulo: 'How it works',
    pasos: [
      { titulo: 'Tell us about your trip', texto: 'Which destinations interest you, your dates, how many are traveling (and the children’s ages) and your budget.' },
      { titulo: 'We put together a proposal', texto: 'With flight, accommodation and transfer options designed for you.' },
      { titulo: 'You confirm and travel with support', texto: 'From then on our hosts look after you, before you arrive and throughout your stay.' },
    ],
    acompTitulo: 'We’re with you the whole trip',
    acomp1: 'You’ll have the support of our hosts,', acomp1b: 'who help you before you arrive and throughout your stay.',
    anfitrionas: 'Agostina and Victoria',
    acomp2: 'They send you your check-in and boarding passes, and help with anything you need.',
    gestiones: [
      'Travel insurance', 'Extra baggage', 'Seat purchase and selection',
      'Dream Tours excursions and tours', 'Payment of outstanding balances', 'Assistance and guidance throughout the trip',
    ],
    legal: 'Dream Tours acts as an intermediary between the traveler and the contracted providers (airlines, accommodation and transfers), providing assistance and support throughout the experience.',
  },
}

const TITULO = 'font-display-hero uppercase text-hero-navy mb-6'
const TITULO_ESTILO = { fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }

export default function PaquetesInfo() {
  const tx = useTextos(TEXTOS)
  const destinos = destinosEn(useLang().lang)
  useSeo({ titulo: tx.seoTitulo, descripcion: tx.seoDescripcion })
  const [formAbierto, setFormAbierto] = useState(false)

  const Boton = () => (
    <button type="button" onClick={() => setFormAbierto(true)}
      className={BTN_PRINCIPAL}>
      <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit_note</span>
      {tx.armar}
    </button>
  )

  return (
    <div className="bg-surface min-h-screen">
      {formAbierto && <FormularioPaquete onClose={() => setFormAbierto(false)} />}
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
          <Boton />
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-14 md:py-20">
        {/* Qué incluye */}
        <h2 className={TITULO} style={TITULO_ESTILO}>{tx.incluyeTitulo}</h2>
        <div className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-14">
          {tx.incluye.map(({ titulo, texto }, i) => (
            <div key={i} className="p-7 bg-white rounded-2xl border border-hero-navy/10">
              <div className="w-14 h-14 rounded-full bg-hero-cream flex items-center justify-center mb-4">
                <span aria-hidden="true" className="material-symbols-outlined text-hero-navy text-[28px]">{ICONOS_INCLUYE[i]}</span>
              </div>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-1">{titulo}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </div>
          ))}
        </div>

        {/* Destinos combinables */}
        <h2 className="font-display-hero uppercase text-hero-navy mb-2" style={TITULO_ESTILO}>{tx.combinaTitulo}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mb-6">
          {tx.combinaTexto}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-14">
          {destinos.map(d => (
            <Link key={d.id} to={`/destinos/${d.id}`}
              className="group relative rounded-2xl overflow-hidden aspect-[4/5] md:aspect-[3/4]">
              <img src={d.imagen} alt={d.nombre} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-hero-navy/90 via-hero-navy/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-display-hero uppercase text-hero-yellow text-xl md:text-2xl leading-none">{d.nombre}</p>
                <p className="font-label-sm text-[13px] text-hero-cream/80 mt-1">{d.estado}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Cómo funciona */}
        <h2 className={TITULO} style={TITULO_ESTILO}>{tx.comoTitulo}</h2>
        <ol className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-14">
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

        {/* Anfitrionas */}
        <div className="bg-hero-navy rounded-2xl p-8 md:p-12 grid md:grid-cols-[1.1fr_1fr] gap-8 md:gap-12 items-start mb-6">
          <div>
            <h2 className="font-display-hero uppercase text-hero-cream mb-3" style={TITULO_ESTILO}>
              {tx.acompTitulo}
            </h2>
            <p className="font-body-md text-body-md text-hero-cream/80 mb-4">
              {tx.acomp1} <span className="text-hero-yellow">{tx.anfitrionas}</span>, {tx.acomp1b}
            </p>
            <p className="font-body-md text-body-md text-hero-cream/80">
              {tx.acomp2}
            </p>
            {/* En el celular el botón va debajo de la lista */}
            <div className="hidden md:block mt-8"><Boton /></div>
          </div>
          <ul className="flex flex-col gap-3">
            {tx.gestiones.map(g => (
              <li key={g} className="flex items-start gap-3 text-hero-cream">
                <span aria-hidden="true" className="material-symbols-outlined text-hero-sky text-[22px] flex-shrink-0">check_circle</span>
                <span className="font-body-md text-body-md">{g}</span>
              </li>
            ))}
          </ul>
          <div className="md:hidden"><Boton /></div>
        </div>

        <p className="font-body-md text-[13px] leading-relaxed text-on-surface-variant max-w-3xl">
          {tx.legal}
        </p>
      </div>
    </div>
  )
}
