import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { destinos, formatPrecio } from '../../data/mockData.js'
import { excursionesApi, normalizarExcursion, agenciaVideosApi } from '../../lib/supabase.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import FormularioPaquete from '../../components/public/FormularioPaquete.jsx'
import { BTN_PRINCIPAL, BTN_SECUNDARIO, BTN_SECUNDARIO_OSCURO, BTN_PAR_OSCURO } from '../../components/public/botones.js'
import { diaDeMarea, hoyEnDestino, formatoAltura } from '../../data/mareas.js'
import { esLinkInstagram, urlEmbedInstagram } from '../../lib/instagram.js'
import { useSeo } from '../../lib/seo.js'
import { useLang, useTextos } from '../../context/LanguageContext.jsx'

// Reseñas reales de TripAdvisor (elegidas por Abril, 2026-10-14). Se muestra el título y un
// fragmento corto, con el link a la reseña completa: el texto entero queda en TripAdvisor.
// Las citas quedan en el idioma original en todas las versiones del sitio.
const TRIPADVISOR_URL = 'https://www.tripadvisor.es/Attraction_Review-g303461-d33088974-Reviews-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html'
const RESENAS = [
  {
    nombre: 'Virginia N.',
    titulo: 'Experiencia imperdible',
    texto: 'Tener una guía como Mey, predispuesta, atenta y amorosa…',
    fecha: [2026, 10],
    url: 'https://www.tripadvisor.es/ShowUserReviews-g303461-d33088974-r1081725008-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
  },
  {
    nombre: 'Estefanía O.',
    titulo: '¡No lo dudes!',
    texto: 'Viajamos con los niños y es super atenta con ellos. Super recomendable!',
    fecha: [2026, 9],
    url: 'https://www.tripadvisor.es/ShowUserReviews-g303461-d33088974-r1079751345-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
  },
  {
    nombre: null, // viajera sin nombre: se muestra tx.viajeraAnonima
    titulo: 'Primer viaje sola, ¡espectacular!',
    texto: 'Para los que viajen solos se los recomiendo, ya que están siempre a disposición…',
    fecha: [2026, 8],
    url: 'https://www.tripadvisor.es/ShowUserReviews-g303461-d33088974-r1075679018-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
  },
]

const DESTINOS_HOME = [
  { id: 'porto',   nombre: 'Porto de Galinhas',   imagen: '/porto-de-galinhas.jpeg' },
  { id: 'maragogi',nombre: 'Maragogi',             imagen: '/Maragogi.jpeg' },
  { id: 'noronha', nombre: 'Fernando de Noronha',  imagen: '/fernando-de-noronha.jpeg' },
  { id: 'maceio',  nombre: 'Maceió',               imagen: '/Maceio.jpeg' },
]

// Los 3 paseos más conocidos van primero en el carrusel, en este orden — pedido
// explícito; después siguen los demás paseos activos, en orden alfabético.
const PASEOS_DESTACADOS_HOME = ['Maragogi', 'Praia dos Carneiros', 'Isla de Santo Aleixo']

// A los costados, a la altura de las fotos; en la punta del carrusel la flecha de ese lado se esconde
// Posteo o reel de Instagram (link pegado en Admin > Videos). La página /embed/ avisa
// su alto con postMessage ("MEASURE"): así la tarjeta mide lo justo, sin espacio vacío
// ni corte, sea foto, carrusel o reel.
function PosteoInstagram({ url, titulo }) {
  const marco = useRef(null)
  const [alto, setAlto] = useState(560)

  useEffect(() => {
    function onMensaje(e) {
      if (e.source !== marco.current?.contentWindow || !/^https:\/\/(www\.)?instagram\.com$/.test(e.origin)) return
      try {
        const datos = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (datos?.type === 'MEASURE' && datos.details?.height > 0) setAlto(Math.ceil(datos.details.height))
      } catch (_) {}
    }
    window.addEventListener('message', onMensaje)
    return () => window.removeEventListener('message', onMensaje)
  }, [])

  return (
    <div className="flex-shrink-0 w-[300px] md:w-[326px] rounded-2xl overflow-hidden bg-white">
      <iframe ref={marco} src={urlEmbedInstagram(url)} title={titulo}
        loading="lazy" scrolling="no" allowTransparency allow="encrypted-media; clipboard-write"
        className="block w-full border-0" style={{ height: alto }} />
    </div>
  )
}

function FlechaCarrusel({ lado, onClick, deshabilitada, etiqueta }) {
  return (
    <button type="button" onClick={onClick} disabled={deshabilitada}
      aria-label={etiqueta}
      className={`absolute z-10 top-32 md:top-40 -translate-y-1/2 ${lado === 'izq' ? 'left-0 md:-left-6' : 'right-0 md:-right-6'} w-11 h-11 md:w-12 md:h-12 rounded-full border-2 border-hero-navy bg-white text-hero-navy flex items-center justify-center shadow-[0_4px_12px_rgba(7,46,64,0.15)] hover:bg-hero-navy hover:text-hero-cream transition-[opacity,background-color,color] disabled:opacity-0 disabled:pointer-events-none`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[24px]">{lado === 'izq' ? 'chevron_left' : 'chevron_right'}</span>
    </button>
  )
}

// Carrusel horizontal sin avance automático: cada flecha corre una "página" (lo
// que entra a la vista). Las flechas se apagan al llegar a cada punta.
function CarruselPaseos({ children, etiquetas }) {
  const pista = useRef(null)
  const [puntas, setPuntas] = useState({ inicio: true, fin: false })

  function medir() {
    const el = pista.current
    if (!el) return
    setPuntas({ inicio: el.scrollLeft <= 4, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }

  useEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [children])

  const mover = (dir) => pista.current?.scrollBy({ left: dir * pista.current.clientWidth, behavior: 'smooth' })

  return (
    <div className="relative">
      <FlechaCarrusel lado="izq" onClick={() => mover(-1)} deshabilitada={puntas.inicio} etiqueta={etiquetas[0]} />
      <FlechaCarrusel lado="der" onClick={() => mover(1)} deshabilitada={puntas.fin} etiqueta={etiquetas[1]} />
      <div ref={pista} onScroll={medir}
        className="no-scrollbar flex gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory scroll-px-margin-mobile md:scroll-px-0 -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0 pb-2">
        {children}
      </div>
    </div>
  )
}

// Las dos formas de llegar a DreamTours: el que todavía arma el viaje y el que ya lo tiene.
// Cada una lleva a un recorrido distinto (paquetes/hospedajes o paseos/traslados).
const CAMINOS = [
  { clave: 'organizando', texto: 'armarPaquete', formulario: true, principal: true },
  { clave: 'ya-tengo', texto: 'verPaseos', to: '/excursiones' },
]

const SERVICIOS = [
  { clave: 'servPaquetes',  icono: '/icons/paquetes-aereos.svg',    to: '/paquetes' },
  { clave: 'servHoteles',   icono: '/icons/hoteles-posadas.svg',    to: '/hoteles' },
  { clave: 'servTraslados', icono: '/icons/transfers-privados.svg', to: '/traslados' },
  { clave: 'servPaseos',    icono: '/icons/paseos-espanol.svg',     to: '/excursiones' },
]

const STATS_NOSOTROS = [
  { valor: 7,    clave: 'statAnios' },
  { valor: 350,  clave: 'statPasajeros' },
  { valor: 8000, clave: 'statSeguidores', tall: true },
]

const TEXTOS = {
  es: {
    titulo1: 'Hacé realidad el viaje', titulo2: 'de tus sueños',
    bajada: 'Paquetes, hospedajes, paseos y traslados en Porto de Galinhas, Maragogi, Maceió, Pipa y Fernando de Noronha, con atención en español antes y durante todo tu viaje.',
    armarPaquete: 'Armar mi paquete', verPaseos: 'Ver paseos',
    servPaquetes: 'Paquetes aéreos', servHoteles: 'Hoteles y posadas', servTraslados: 'Traslados privados', servPaseos: 'Paseos en español',
    destinosTitulo: 'Destinos favoritos', destinosBajada: 'Los lugares más elegidos por nuestros viajeros',
    explorarDestino: 'Explorar destino', verDestinos: 'Ver todos los destinos',
    reservaPaseo: 'Reservá tu paseo', desde: 'Desde', verTodosPaseos: 'Ver todos los paseos',
    paseosAnteriores: 'Paseos anteriores', paseosSiguientes: 'Paseos siguientes',
    resenasTitulo: 'Lo que dicen nuestros viajeros', viajo: 'Viajó en', viajeraAnonima: 'Viajera de TripAdvisor',
    leerTripadvisor: 'Leer en TripAdvisor', verOpiniones: 'Ver todas las opiniones',
    faqTitulo: 'Preguntas frecuentes',
    faqs: [
      { q: '¿Cuál es la mejor época para viajar?', a: 'La mejor época es entre septiembre y marzo, cuando llueve menos y las aguas son más cristalinas.' },
      { q: '¿Cómo funcionan las piscinas naturales?', a: 'Las piscinas se forman solo con marea baja (0,60 metros o menos). Nuestros guías conocen los horarios exactos de cada día para que no te pierdas el momento ideal.' },
      { q: '¿Qué moneda usan? ¿Cómo se paga?', a: 'La moneda es el Real brasileño (R$). Hoy en Brasil casi todo se paga con PIX, el sistema de pago con código QR: restaurantes, playas, mercados y hasta vendedores ambulantes. Antes de viajar, consultanos y te contamos cómo pagar con PIX desde tu país. La tarjeta internacional también se acepta en la mayoría de los hoteles y restaurantes.' },
      { q: '¿Necesito visa para entrar a Brasil?', a: 'Ciudadanos de Argentina y la mayoría de países latinoamericanos no necesitan visa para estadías turísticas menores a 90 días.' },
    ],
    infoUtil: 'Información útil', mareaTitulo: 'Tabla de marea',
    mareaTexto: 'Consultá el estado de las mareas para planificar tus paseos a las piscinas naturales.',
    hoy: 'Hoy', piscinas: (estado, hora) => `Piscinas: ${estado} a las ${hora}`, hoyOtros: 'Hoy: ideal para otros paseos',
    estados: { ideal: 'Ideal', posible: 'Posible', no: 'Otros paseos' },
    mareaTipo: { baja: 'Marea baja', alta: 'Marea alta' },
    mareaSinDatos: 'Consultá los mejores días para las piscinas naturales.', verTabla: 'Ver tabla completa',
    quienesSomos: '¿Quiénes somos?', creadores: 'Creadores de sueños',
    statAnios: 'Años de experiencia', statPasajeros: 'De pasajeros', statSeguidores: 'Seguidores en nuestra comunidad',
    conocenos: 'Conocé nuestra historia y nuestro equipo', fotoEquipo: 'Flor y Marcos, equipo DreamTours',
    aMedidaTitulo: '¿Querés armar tu viaje a medida?',
    aMedidaTexto: 'Completá el formulario y nuestro equipo se va a contactar para diseñar un viaje 100% personalizado según tus intereses, tiempos y presupuesto.',
    aMedidaBoton: 'Armá tu viaje', aMedidaFoto: 'Viajá con DreamTours',
    videosTitulo: 'Viví nuestros viajes', videosBajada: 'Momentos reales de nuestros pasajeros en el Nordeste Brasilero',
    verVideo: 'Ver video', seguinos: 'Seguinos en Instagram', cerrarVideo: 'Cerrar video', posteoInstagram: 'Posteo de Instagram de DreamTours',
  },
  pt: {
    titulo1: 'Realize a viagem', titulo2: 'dos seus sonhos',
    bajada: 'Pacotes, hospedagens, passeios e traslados em Porto de Galinhas, Maragogi, Maceió, Pipa e Fernando de Noronha, com atendimento em espanhol antes e durante toda a sua viagem.',
    armarPaquete: 'Montar meu pacote', verPaseos: 'Ver passeios',
    servPaquetes: 'Pacotes aéreos', servHoteles: 'Hotéis e pousadas', servTraslados: 'Traslados privativos', servPaseos: 'Passeios em espanhol',
    destinosTitulo: 'Destinos favoritos', destinosBajada: 'Os lugares mais escolhidos pelos nossos viajantes',
    explorarDestino: 'Explorar destino', verDestinos: 'Ver todos os destinos',
    reservaPaseo: 'Reserve seu passeio', desde: 'A partir de', verTodosPaseos: 'Ver todos os passeios',
    paseosAnteriores: 'Passeios anteriores', paseosSiguientes: 'Próximos passeios',
    resenasTitulo: 'O que dizem nossos viajantes', viajo: 'Viajou em', viajeraAnonima: 'Viajante do TripAdvisor',
    leerTripadvisor: 'Ler no TripAdvisor', verOpiniones: 'Ver todas as avaliações',
    faqTitulo: 'Perguntas frequentes',
    faqs: [
      { q: 'Qual é a melhor época para viajar?', a: 'A melhor época é entre setembro e março, quando chove menos e as águas ficam mais cristalinas.' },
      { q: 'Como funcionam as piscinas naturais?', a: 'As piscinas se formam só na maré baixa (0,60 metro ou menos). Nossos guias conhecem os horários exatos de cada dia para você não perder o momento ideal.' },
      { q: 'Qual é a moeda? Como se paga?', a: 'A moeda é o Real (R$). Hoje no Brasil quase tudo se paga com PIX, o sistema de pagamento por QR code: restaurantes, praias, mercados e até vendedores ambulantes. Antes de viajar, fale conosco e explicamos como pagar com PIX do seu país. O cartão internacional também é aceito na maioria dos hotéis e restaurantes.' },
      { q: 'Preciso de visto para entrar no Brasil?', a: 'Cidadãos da Argentina e da maioria dos países latino-americanos não precisam de visto para estadias turísticas de até 90 dias.' },
    ],
    infoUtil: 'Informação útil', mareaTitulo: 'Tábua de marés',
    mareaTexto: 'Consulte as marés para planejar seus passeios às piscinas naturais.',
    hoy: 'Hoje', piscinas: (estado, hora) => `Piscinas: ${estado} às ${hora}`, hoyOtros: 'Hoje: ideal para outros passeios',
    estados: { ideal: 'Ideal', posible: 'Possível', no: 'Outros passeios' },
    mareaTipo: { baja: 'Maré baixa', alta: 'Maré alta' },
    mareaSinDatos: 'Consulte os melhores dias para as piscinas naturais.', verTabla: 'Ver tábua completa',
    quienesSomos: 'Quem somos?', creadores: 'Criadores de sonhos',
    statAnios: 'Anos de experiência', statPasajeros: 'Passageiros', statSeguidores: 'Seguidores na nossa comunidade',
    conocenos: 'Conheça nossa história e nossa equipe', fotoEquipo: 'Flor e Marcos, equipe DreamTours',
    aMedidaTitulo: 'Quer montar sua viagem sob medida?',
    aMedidaTexto: 'Preencha o formulário e nossa equipe vai entrar em contato para criar uma viagem 100% personalizada de acordo com seus interesses, tempo e orçamento.',
    aMedidaBoton: 'Monte sua viagem', aMedidaFoto: 'Viaje com a DreamTours',
    videosTitulo: 'Viva nossas viagens', videosBajada: 'Momentos reais dos nossos passageiros no Nordeste brasileiro',
    verVideo: 'Ver vídeo', seguinos: 'Siga-nos no Instagram', cerrarVideo: 'Fechar vídeo', posteoInstagram: 'Post da DreamTours no Instagram',
  },
  en: {
    titulo1: 'Make the trip', titulo2: 'of your dreams',
    bajada: 'Packages, accommodation, tours and transfers in Porto de Galinhas, Maragogi, Maceió, Pipa and Fernando de Noronha, with Spanish-speaking support before and throughout your trip.',
    armarPaquete: 'Build my package', verPaseos: 'See tours',
    servPaquetes: 'Flight packages', servHoteles: 'Hotels and inns', servTraslados: 'Private transfers', servPaseos: 'Tours in Spanish',
    destinosTitulo: 'Favorite destinations', destinosBajada: 'The places our travelers choose most',
    explorarDestino: 'Explore destination', verDestinos: 'See all destinations',
    reservaPaseo: 'Book your tour', desde: 'From', verTodosPaseos: 'See all tours',
    paseosAnteriores: 'Previous tours', paseosSiguientes: 'Next tours',
    resenasTitulo: 'What our travelers say', viajo: 'Traveled in', viajeraAnonima: 'TripAdvisor traveler',
    leerTripadvisor: 'Read on TripAdvisor', verOpiniones: 'See all reviews',
    faqTitulo: 'Frequently asked questions',
    faqs: [
      { q: 'When is the best time to travel?', a: 'The best time is between September and March, when there is less rain and the water is clearest.' },
      { q: 'How do the natural pools work?', a: 'The pools only form at low tide (0.60 meters or less). Our guides know the exact times for each day so you don’t miss the right moment.' },
      { q: 'What currency is used? How do I pay?', a: 'The currency is the Brazilian Real (R$). In Brazil today almost everything is paid with PIX, the QR code payment system: restaurants, beaches, markets and even street vendors. Before you travel, contact us and we’ll explain how to pay with PIX from your country. International cards are also accepted at most hotels and restaurants.' },
      { q: 'Do I need a visa to enter Brazil?', a: 'Citizens of Argentina and most Latin American countries don’t need a visa for tourist stays of up to 90 days. Citizens of the United States, Canada and Australia need an electronic visa (e-Visa).' },
    ],
    infoUtil: 'Useful information', mareaTitulo: 'Tide table',
    mareaTexto: 'Check the tides to plan your trips to the natural pools.',
    hoy: 'Today', piscinas: (estado, hora) => `Pools: ${estado} at ${hora}`, hoyOtros: 'Today: best for other tours',
    estados: { ideal: 'Ideal', posible: 'Possible', no: 'Other tours' },
    mareaTipo: { baja: 'Low tide', alta: 'High tide' },
    mareaSinDatos: 'Check the best days for the natural pools.', verTabla: 'See full table',
    quienesSomos: 'Who are we?', creadores: 'Dream makers',
    statAnios: 'Years of experience', statPasajeros: 'Travelers', statSeguidores: 'Followers in our community',
    conocenos: 'Meet our story and our team', fotoEquipo: 'Flor and Marcos, DreamTours team',
    aMedidaTitulo: 'Want a tailor-made trip?',
    aMedidaTexto: 'Fill in the form and our team will contact you to design a 100% personalized trip based on your interests, timing and budget.',
    aMedidaBoton: 'Plan your trip', aMedidaFoto: 'Travel with DreamTours',
    videosTitulo: 'Live our trips', videosBajada: 'Real moments from our travelers in Northeast Brazil',
    verVideo: 'Watch video', seguinos: 'Follow us on Instagram', cerrarVideo: 'Close video', posteoInstagram: 'DreamTours Instagram post',
  },
}

// Cuenta de 0 al valor final cuando el elemento entra en pantalla.
function useCountUp(valor, duracion = 1500) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const arrancado = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || arrancado.current) return
      arrancado.current = true
      const inicio = performance.now()
      function tick(ahora) {
        const progreso = Math.min((ahora - inicio) / duracion, 1)
        const suavizado = 1 - Math.pow(1 - progreso, 3)
        setCount(Math.round(valor * suavizado))
        if (progreso < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      observer.disconnect()
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [valor, duracion])

  return [count, ref]
}

function StatPill({ valor, label, tall, className = '' }) {
  const [count, ref] = useCountUp(valor)
  const { locale } = useLang()
  return (
    <div ref={ref} className={`bg-hero-cream rounded-2xl flex flex-col items-center justify-center text-center px-4 ${tall ? 'py-10' : 'py-6'} ${className}`}>
      <span className="font-display-hero text-hero-navy leading-none"
        style={{ fontSize: tall ? 'clamp(2.5rem, 5vw, 3.5rem)' : 'clamp(1.75rem, 3vw, 2.25rem)' }}>
        +{count.toLocaleString(locale)}
      </span>
      <span className="font-label-lg text-label-sm text-hero-navy/80 uppercase tracking-wide mt-2">{label}</span>
    </div>
  )
}

export default function Home() {
  useSeo()
  const tx = useTextos(TEXTOS)
  const { locale } = useLang()
  const mesAnio = ([anio, mes]) => new Date(anio, mes - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const { config } = useSiteConfig()
  const [faqOpen, setFaqOpen] = useState(null)
  const mareaHoy = diaDeMarea(hoyEnDestino())
  const [excursionesDestacadas, setExcursionesDestacadas] = useState([])
  const [videosAgencia, setVideosAgencia] = useState([])
  const [videoActivo, setVideoActivo] = useState(null)
  const [formPaquete, setFormPaquete] = useState(false)

  useEffect(() => {
    async function cargarExcursiones() {
      try {
        const { data, error } = await excursionesApi.getAll()
        if (!error && data) {
          const paseos = data.map(normalizarExcursion).filter(e => e.categoria === 'excursiones')
          const primeros = PASEOS_DESTACADOS_HOME.map(nombre => paseos.find(e => e.nombre === nombre)).filter(Boolean)
          setExcursionesDestacadas([...primeros, ...paseos.filter(e => !primeros.includes(e))])
        }
      } catch (_) {}
    }
    async function cargarVideos() {
      try {
        const { data, error } = await agenciaVideosApi.getAll()
        if (!error && data) setVideosAgencia(data)
      } catch (_) {}
    }
    cargarExcursiones()
    cargarVideos()
  }, [])

  return (
    <div className="bg-surface">
      {formPaquete && <FormularioPaquete onClose={() => setFormPaquete(false)} />}

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[760px] md:min-h-[820px] flex flex-col justify-center pt-32 pb-20 md:pb-28 overflow-hidden">
        <div className="absolute inset-0">
          <video
            src={config?.hero_video || '/hero.mp4'}
            poster={config?.hero_video ? undefined : '/hero-poster.jpg'}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        <div className="relative z-10 px-margin-mobile md:px-margin-desktop w-full">
          {/* Titular principal */}
          <h1 className="font-display-hero uppercase text-hero-cream"
            style={{ fontSize: 'clamp(2.75rem, 6.8vw, 5.25rem)', lineHeight: 0.95, letterSpacing: '0.01em' }}>
            {tx.titulo1}
          </h1>
          <p className="font-script-hero text-hero-sky"
            style={{ fontSize: 'clamp(3.5rem, 9vw, 6.5rem)', lineHeight: 1, marginTop: '-0.1em' }}>
            {tx.titulo2}
          </p>

          {/* Qué vende DreamTours, en una línea */}
          <p className="font-body-md text-body-lg text-hero-cream max-w-2xl mt-6"
            style={{ textShadow: '0 1px 12px rgba(7,46,64,0.6)' }}>
            {tx.bajada}
          </p>

          {/* Dos caminos según en qué punto del viaje está el visitante: armar el paquete
              (formulario) o ver paseos. Mismos botones que el resto del sitio. */}
          <div className="flex flex-wrap items-center gap-3 mt-8">
            {CAMINOS.map(c => {
              const clases = c.principal ? BTN_PRINCIPAL : BTN_PAR_OSCURO
              return c.formulario ? (
                <button key={c.clave} type="button" onClick={() => setFormPaquete(true)} className={clases}>{tx[c.texto]}</button>
              ) : (
                <Link key={c.clave} to={c.to} className={clases}>{tx[c.texto]}</Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────── */}
      <section className="bg-white -mt-8 relative z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(7,46,64,0.05)]">
        <div className="py-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-gutter">
            {SERVICIOS.map(({ clave, icono, to }) => (
              <Link key={to} to={to}
                className="flex flex-col items-center p-6 bg-surface rounded-xl hover:shadow-[0_10px_30px_rgba(7,46,64,0.08)] transition-all duration-300 group border border-hero-navy/10">
                <div className="w-16 h-16 rounded-full bg-hero-cream flex items-center justify-center mb-4 group-hover:bg-hero-cream/60 transition-colors">
                  <img src={icono} alt="" className="w-11 h-11 object-contain" />
                </div>
                <span className="font-display-hero uppercase text-hero-navy text-[16px] tracking-wide">{tx[clave]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESTINOS FAVORITOS ────────────────────────────────────────── */}
      <section className="py-16 md:py-24 overflow-hidden">
        <div className="mb-8 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy mb-2" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>{tx.destinosTitulo}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{tx.destinosBajada}</p>
        </div>
        {/* Carousel infinito con fade en bordes */}
        <div style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' }}>
          <div className="destinos-track" style={{ display: 'flex', gap: '16px', width: 'max-content', padding: '8px 0 16px' }}>
            {[...DESTINOS_HOME, ...DESTINOS_HOME].map((d, i) => (
              <Link key={i} to={`/destinos/${d.id}`}
                className="group relative rounded-xl overflow-hidden cursor-pointer flex-shrink-0 block"
                style={{ width: 'clamp(240px, 22vw, 340px)', aspectRatio: '3/4' }}>
                <img src={d.imagen} alt={d.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean/90 via-deep-ocean/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <h3 className="font-display-hero uppercase text-hero-yellow text-2xl md:text-3xl leading-[0.95] mb-1">{d.nombre}</h3>
                  <p className="font-label-sm text-label-sm text-sand-beige flex items-center gap-1 group-hover:underline">
                    {tx.explorarDestino} <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 text-center px-margin-mobile">
          <Link to="/destinos" className={`${BTN_SECUNDARIO} group`}>
            {tx.verDestinos}
            <span aria-hidden="true" className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* ── EXCURSIONES DESTACADAS ───────────────────────────── */}
      <section className="py-16 md:py-24 bg-hero-cream">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy text-center mb-10 md:mb-14"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '0.02em' }}>
            {tx.reservaPaseo}
          </h2>
          {/* Carrusel que se mueve solo con las flechas (o deslizando): en el celular una
              tarjeta y un poco de la siguiente, desde md tres por vista */}
          <CarruselPaseos etiquetas={[tx.paseosAnteriores, tx.paseosSiguientes]}>
            {excursionesDestacadas.map(e => (
              <Link key={e.id} to={`/excursiones/${e.id}`}
                className="snap-start flex-shrink-0 w-[82%] md:w-[calc((100%-4rem)/3)] group flex flex-col rounded-3xl overflow-hidden border-2 border-hero-navy shadow-[0_8px_24px_rgba(7,46,64,0.12)] hover:shadow-[0_12px_32px_rgba(7,46,64,0.2)] transition-shadow">
                <div className="h-64 md:h-80 overflow-hidden">
                  <img src={e.imagen} alt={e.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="flex-1 bg-hero-navy px-5 py-4 flex items-center justify-between gap-3">
                  <h3 className="font-display-hero uppercase text-hero-cream text-xl md:text-2xl leading-none line-clamp-2">
                    {e.nombre}
                  </h3>
                  <div className="text-right flex-shrink-0">
                    <div className="font-label-sm text-[12px] uppercase text-hero-cream/90 whitespace-nowrap">{tx.desde}</div>
                    <div className="font-label-sm text-[13px] uppercase text-hero-yellow font-bold whitespace-nowrap">
                      {formatPrecio(e.precio, e.moneda)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CarruselPaseos>
          <div className="mt-10 text-center">
            <Link to="/excursiones" className={BTN_SECUNDARIO}>
              {tx.verTodosPaseos}
            </Link>
          </div>
        </div>
      </section>

      {/* ── RESEÑAS ──────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-white rounded-t-3xl">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy mb-10 md:mb-14"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '0.01em' }}>
            {tx.resenasTitulo}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RESENAS.map((r, i) => { const nombre = r.nombre || tx.viajeraAnonima; return (
              <div key={i} className="bg-white border-2 border-hero-navy rounded-2xl p-8 flex flex-col">
                <div className="flex gap-1 text-hero-yellow mb-4">
                  {[...Array(5)].map((_, s) => (
                    <span key={s} className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                  ))}
                </div>
                <h3 className="font-label-lg text-[16px] text-hero-navy mb-3">"{r.titulo}"</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6 italic flex-1">"{r.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-label-lg text-hero-navy font-bold">
                    {nombre[0]}
                  </div>
                  <div>
                    <div className="font-label-lg text-[14px] text-hero-navy">{nombre}</div>
                    <div className="font-label-sm text-[13px] text-on-surface-variant">{tx.viajo} {mesAnio(r.fecha)}</div>
                  </div>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className={`${BTN_SECUNDARIO} mt-6`}>
                  {tx.leerTripadvisor}
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              </div>
            )})}
          </div>
          <div className="flex flex-col items-center gap-4 mt-12">
            <img alt="TripAdvisor" className="h-9 w-auto" src="https://static.tacdn.com/assets/s/2651d377.svg" />
            <a href={TRIPADVISOR_URL} target="_blank" rel="noopener noreferrer"
              className={BTN_SECUNDARIO}>
              {tx.verOpiniones}
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ + TABLA DE MAREAS ─────────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-24"
        style={{ background: 'linear-gradient(180deg, #d7eef7 0%, #8fcbe8 22%, #3f96cc 55%, #1a5f96 80%, #0d3f68 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute rounded-full bg-white/25 blur-3xl" style={{ width: 500, height: 60, top: '28%', left: '-10%' }} />
          <div className="absolute rounded-full bg-white/15 blur-3xl" style={{ width: 420, height: 50, top: '48%', right: '-8%' }} />
          <div className="absolute rounded-full bg-white/10 blur-3xl" style={{ width: 600, height: 70, top: '70%', left: '10%' }} />
        </div>

        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy text-center mb-10 md:mb-14"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '0.01em' }}>
            {tx.faqTitulo}
          </h2>

          <div className="space-y-4 max-w-4xl mx-auto mb-14 md:mb-20">
            {tx.faqs.map((faq, i) => (
              <div key={i}
                className={`bg-hero-cream border-2 border-hero-navy p-6 cursor-pointer transition-[border-radius] ${faqOpen === i ? 'rounded-2xl' : 'rounded-full'}`}
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <div className="flex justify-between items-center gap-4">
                  <h3 className="font-label-lg text-label-lg uppercase text-hero-navy">{faq.q}</h3>
                  <span className="flex-shrink-0 text-hero-navy transition-transform duration-200"
                    style={{ transform: faqOpen === i ? 'rotate(180deg)' : 'none' }}>
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M0 0h16L8 12z" /></svg>
                  </span>
                </div>
                {faqOpen === i && (
                  <p className="mt-4 font-body-md text-body-md text-hero-navy/80">{faq.a}</p>
                )}
              </div>
            ))}
          </div>

          <div className="bg-hero-cream rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center max-w-5xl mx-auto">
            <div>
              <span className="font-label-lg text-label-sm uppercase tracking-wider text-hero-navy/75 block mb-1">{tx.infoUtil}</span>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl md:text-3xl mb-3">{tx.mareaTitulo}</h3>
              <p className="font-body-md text-body-md text-hero-navy/80">
                {tx.mareaTexto}
              </p>
            </div>
            <div className="bg-hero-sky rounded-2xl p-5">
              {mareaHoy ? (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-hero-navy/15">
                    <span className="font-label-lg text-label-sm uppercase text-hero-navy">{tx.hoy}</span>
                    <span className="font-label-lg text-label-sm uppercase text-hero-navy">
                      {mareaHoy.mejor ? tx.piscinas(tx.estados[mareaHoy.estado.id], mareaHoy.mejor.hora) : tx.hoyOtros}
                    </span>
                  </div>
                  {mareaHoy.mareas.map(m => (
                    <div key={m.hora} className="flex justify-between items-center pt-3">
                      <div className="flex items-center gap-2 text-hero-navy">
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{m.tipo === 'baja' ? 'arrow_downward' : 'arrow_upward'}</span>
                        <span className="font-label-lg text-label-sm uppercase">{tx.mareaTipo[m.tipo]}</span>
                      </div>
                      <div className="text-right text-hero-navy">
                        <span className="font-label-lg text-[14px]">{m.hora}</span>
                        <span className="font-label-sm text-[13px] text-hero-navy/75 ml-2">{formatoAltura(m.altura)}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="font-body-md text-body-md text-hero-navy">{tx.mareaSinDatos}</p>
              )}
              <div className="mt-4 text-center">
                <Link to="/marea" className="inline-flex items-center gap-1 font-label-lg text-label-sm uppercase text-hero-navy hover:opacity-70 transition-opacity">
                  {tx.verTabla}
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUIÉNES SOMOS ────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-24"
        style={{ background: 'linear-gradient(180deg, #1c6bb8 0%, #4f9fdd 45%, #bfe2f7 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute rounded-full bg-white/70 blur-2xl" style={{ width: 260, height: 90, top: '10%', left: '-4%' }} />
          <div className="absolute rounded-full bg-white/50 blur-2xl" style={{ width: 180, height: 70, top: '6%', left: '55%' }} />
          <div className="absolute rounded-full bg-white/60 blur-2xl" style={{ width: 220, height: 80, top: '28%', right: '4%' }} />
          <div className="absolute rounded-full bg-white/40 blur-3xl" style={{ width: 360, height: 130, bottom: '2%', left: '15%' }} />
          <div className="absolute rounded-full bg-white/50 blur-2xl" style={{ width: 200, height: 75, bottom: '10%', right: '20%' }} />
        </div>

        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <h2 className="font-display-hero uppercase text-hero-yellow leading-none"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
              {tx.quienesSomos}
            </h2>
            <p className="font-display-hero uppercase text-hero-cream mb-8"
              style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
              {tx.creadores}
            </p>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="flex flex-col gap-4 md:flex-1">
                {STATS_NOSOTROS.filter(s => !s.tall).map(s => (
                  <StatPill key={s.clave} valor={s.valor} label={tx[s.clave]} />
                ))}
              </div>
              <div className="md:flex-1">
                {STATS_NOSOTROS.filter(s => s.tall).map(s => (
                  <StatPill key={s.clave} valor={s.valor} label={tx[s.clave]} tall className="h-full" />
                ))}
              </div>
            </div>

            <Link to="/nosotros"
              className={BTN_SECUNDARIO}>
              {tx.conocenos}
            </Link>
          </div>

          <div className="bg-hero-cream rounded-3xl p-3 shadow-2xl max-w-md mx-auto md:mx-0 md:justify-self-end">
            <img src="/equipo.png" alt={tx.fotoEquipo} className="w-full h-auto object-cover rounded-2xl"
              onError={e => { e.target.src = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80' }} />
          </div>
        </div>
      </section>

      {/* ── CTA WHATSAPP ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-[3fr_2fr] md:min-h-[420px]">
        <div className="bg-hero-sky px-margin-mobile md:px-20 py-14 md:py-20 flex flex-col justify-center">
          <h2 className="font-display-hero uppercase text-white mb-8"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', letterSpacing: '0.01em' }}>
            {tx.aMedidaTitulo}
          </h2>
          <div className="bg-white border-2 border-hero-navy rounded-2xl p-8 max-w-lg">
            <p className="font-body-md text-body-lg text-hero-navy mb-8">
              {tx.aMedidaTexto}
            </p>
            <button type="button" onClick={() => setFormPaquete(true)}
              className={BTN_PRINCIPAL}>
              {tx.aMedidaBoton}
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">flight</span>
            </button>
          </div>
        </div>
        <div className="relative h-64 md:h-full overflow-hidden">
          <img src="/viaje-a-medida.jpg" alt={tx.aMedidaFoto} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 46%' }} />
        </div>
      </section>

      {/* ── VIDEOS DE LA AGENCIA ──────────────────────────────── */}
      {videosAgencia.length > 0 && (
        <section className="py-16 md:py-24 bg-hero-navy overflow-hidden">
          <div className="mb-8 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
            <h2 className="font-display-hero uppercase text-hero-cream mb-2" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
              {tx.videosTitulo}
            </h2>
            <p className="font-body-md text-body-md text-hero-cream/80">{tx.videosBajada}</p>
          </div>
          <div className="no-scrollbar overflow-x-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex items-start gap-4" style={{ width: 'max-content' }}>
              {videosAgencia.map(v => esLinkInstagram(v.video_url) ? (
                <PosteoInstagram key={v.id} url={v.video_url} titulo={tx.posteoInstagram} />
              ) : (
                <button key={v.id} onClick={() => setVideoActivo(v)} aria-label={`${tx.verVideo}${v.titulo ? `: ${v.titulo}` : ''}`}
                  className="group relative rounded-2xl overflow-hidden flex-shrink-0 text-left"
                  style={{ width: 'clamp(180px, 20vw, 240px)', aspectRatio: '9/16' }}>
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.titulo || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <video src={v.video_url + '#t=0.5'} preload="metadata" muted playsInline className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-14 h-14 rounded-full bg-hero-yellow/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg width="20" height="24" viewBox="0 0 20 24" fill="#072e40"><path d="M0 0l20 12L0 24z" /></svg>
                    </span>
                  </div>
                  {v.titulo && (
                    <p className="absolute bottom-0 left-0 right-0 p-3 font-label-lg text-label-sm text-hero-cream leading-tight">{v.titulo}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
          {config?.instagram_url && (
            <div className="mt-8 text-center px-margin-mobile">
              <a href={config.instagram_url} target="_blank" rel="noopener noreferrer"
                className={BTN_SECUNDARIO_OSCURO}>
                {tx.seguinos}
              </a>
            </div>
          )}
        </section>
      )}

      {/* ── LIGHTBOX DE VIDEO ─────────────────────────────────── */}
      {videoActivo && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-4" onClick={() => setVideoActivo(null)}>
          <button onClick={() => setVideoActivo(null)} aria-label={tx.cerrarVideo}
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-xl">
            ×
          </button>
          <video src={videoActivo.video_url} controls autoPlay playsInline
            className="max-h-[90vh] rounded-2xl bg-black" style={{ aspectRatio: '9/16' }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}

    </div>
  )
}
