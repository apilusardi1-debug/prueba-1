import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { destinos, formatPrecio } from '../../data/mockData.js'
import { excursionesApi, normalizarExcursion, agenciaVideosApi } from '../../lib/supabase.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import FormularioPaquete from '../../components/public/FormularioPaquete.jsx'
import { diaDeMarea, hoyEnDestino, formatoAltura } from '../../data/mareas.js'
import { esLinkInstagram, urlEmbedInstagram } from '../../lib/instagram.js'

// Reseñas reales de TripAdvisor (elegidas por Abril, 2026-10-14). Se muestra el título y un
// fragmento corto, con el link a la reseña completa: el texto entero queda en TripAdvisor.
const TRIPADVISOR_URL = 'https://www.tripadvisor.es/Attraction_Review-g303461-d33088974-Reviews-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html'
const RESENAS = [
  {
    nombre: 'Virginia N.',
    titulo: 'Experiencia imperdible',
    texto: 'Tener una guía como Mey, predispuesta, atenta y amorosa…',
    fecha: 'Octubre 2026',
    url: 'https://www.tripadvisor.es/ShowUserReviews-g303461-d33088974-r1081725008-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
  },
  {
    nombre: 'Estefanía O.',
    titulo: '¡No lo dudes!',
    texto: 'Viajamos con los niños y es super atenta con ellos. Super recomendable!',
    fecha: 'Septiembre 2026',
    url: 'https://www.tripadvisor.es/ShowUserReviews-g303461-d33088974-r1079751345-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
  },
  {
    nombre: 'Viajera de TripAdvisor',
    titulo: 'Primer viaje sola, ¡espectacular!',
    texto: 'Para los que viajen solos se los recomiendo, ya que están siempre a disposición…',
    fecha: 'Agosto 2026',
    url: 'https://www.tripadvisor.es/ShowUserReviews-g303461-d33088974-r1075679018-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
  },
]

const FAQS = [
  {
    q: '¿Cuál es la mejor época para viajar?',
    a: 'La mejor época es entre septiembre y marzo, cuando llueve menos y las aguas son más cristalinas. Evitá junio y julio, que es temporada de lluvias en Pernambuco y Alagoas.',
  },
  {
    q: '¿Cómo funcionan las piscinas naturales?',
    a: 'Las piscinas se forman solo con marea baja (0,60 metros o menos). Nuestros guías conocen los horarios exactos de cada día para que no te pierdas el momento ideal.',
  },
  {
    q: '¿Qué moneda usan? ¿Puedo pagar con tarjeta?',
    a: 'La moneda es el Real brasileño (R$). En la mayoría de los hoteles y restaurantes aceptan tarjeta internacional. Te recomendamos llevar algo de efectivo para playas y mercados.',
  },
  {
    q: '¿Necesito visa para entrar a Brasil?',
    a: 'Ciudadanos de Argentina y la mayoría de países latinoamericanos no necesitan visa para estadías turísticas menores a 90 días.',
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
function PosteoInstagram({ url }) {
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
      <iframe ref={marco} src={urlEmbedInstagram(url)} title="Posteo de Instagram de DreamTours"
        loading="lazy" scrolling="no" allowTransparency allow="encrypted-media; clipboard-write"
        className="block w-full border-0" style={{ height: alto }} />
    </div>
  )
}

function FlechaCarrusel({ lado, onClick, deshabilitada }) {
  return (
    <button type="button" onClick={onClick} disabled={deshabilitada}
      aria-label={lado === 'izq' ? 'Paseos anteriores' : 'Paseos siguientes'}
      className={`absolute z-10 top-32 md:top-40 -translate-y-1/2 ${lado === 'izq' ? 'left-0 md:-left-6' : 'right-0 md:-right-6'} w-11 h-11 md:w-12 md:h-12 rounded-full border-2 border-hero-navy bg-white text-hero-navy flex items-center justify-center shadow-[0_4px_12px_rgba(7,46,64,0.15)] hover:bg-hero-navy hover:text-hero-cream transition-[opacity,background-color,color] disabled:opacity-0 disabled:pointer-events-none`}>
      <span className="material-symbols-outlined text-[24px]">{lado === 'izq' ? 'chevron_left' : 'chevron_right'}</span>
    </button>
  )
}

// Carrusel horizontal sin avance automático: cada flecha corre una "página" (lo
// que entra a la vista). Las flechas se apagan al llegar a cada punta.
function CarruselPaseos({ children }) {
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
      <FlechaCarrusel lado="izq" onClick={() => mover(-1)} deshabilitada={puntas.inicio} />
      <FlechaCarrusel lado="der" onClick={() => mover(1)} deshabilitada={puntas.fin} />
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
  {
    clave: 'organizando',
    titulo: 'Estoy organizando mi viaje',
    texto: 'Vuelos, hospedaje y traslado en un solo paquete, armado a tu medida.',
    principal: { label: 'Armar mi paquete', formulario: true },
    secundarios: [{ label: 'Ver paquetes', to: '/paquetes' }, { label: 'Hospedajes', to: '/hoteles' }],
  },
  {
    clave: 'ya-tengo',
    titulo: 'Ya tengo mi viaje',
    texto: 'Sumá paseos en español y traslados privados para tu estadía.',
    principal: { label: 'Ver paseos', to: '/excursiones' },
    secundarios: [{ label: 'Traslados', to: '/traslados' }],
  },
]

const SERVICIOS = [
  { label: 'Paquetes Aéreos',    icono: '/icons/paquetes-aereos.svg',    to: '/paquetes' },
  { label: 'Hoteles y Posadas',  icono: '/icons/hoteles-posadas.svg',    to: '/hoteles' },
  { label: 'Transfers Privados', icono: '/icons/transfers-privados.svg', to: '/traslados' },
  { label: 'Paseos en Español',  icono: '/icons/paseos-espanol.svg',     to: '/excursiones' },
]

const STATS_NOSOTROS = [
  { valor: 7,    label: 'Años de experiencia' },
  { valor: 350,  label: 'De pasajeros' },
  { valor: 8000, label: 'Seguidores en nuestra comunidad', tall: true },
]

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
  return (
    <div ref={ref} className={`bg-hero-cream rounded-2xl flex flex-col items-center justify-center text-center px-4 ${tall ? 'py-10' : 'py-6'} ${className}`}>
      <span className="font-display-hero text-hero-navy leading-none"
        style={{ fontSize: tall ? 'clamp(2.5rem, 5vw, 3.5rem)' : 'clamp(1.75rem, 3vw, 2.25rem)' }}>
        +{count.toLocaleString('es-AR')}
      </span>
      <span className="font-label-lg text-label-sm text-hero-navy/80 uppercase tracking-wide mt-2">{label}</span>
    </div>
  )
}

export default function Home() {
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
            Hace realidad el viaje
          </h1>
          <p className="font-script-hero text-hero-sky"
            style={{ fontSize: 'clamp(3.5rem, 9vw, 6.5rem)', lineHeight: 1, marginTop: '-0.1em' }}>
            de tus sueños
          </p>

          {/* Qué vende DreamTours, en una línea */}
          <p className="font-body-md text-body-lg text-hero-cream max-w-2xl mt-6"
            style={{ textShadow: '0 1px 12px rgba(7,46,64,0.6)' }}>
            Paquetes, hospedajes, paseos y traslados en Porto de Galinhas, Maragogi, Maceió, Pipa y Fernando de Noronha, con atención en español antes y durante todo tu viaje.
          </p>

          {/* Dos caminos según en qué punto del viaje está el visitante */}
          <div className="grid md:grid-cols-2 gap-4 mt-8 max-w-4xl">
            {CAMINOS.map(c => (
              <div key={c.clave} className="bg-hero-navy/80 backdrop-blur-sm border border-hero-cream/15 rounded-2xl p-6 flex flex-col">
                <h2 className="font-display-hero uppercase text-hero-yellow text-2xl md:text-[28px] leading-none mb-2">{c.titulo}</h2>
                <p className="font-body-md text-[15px] text-hero-cream/85 mb-5 flex-1">{c.texto}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {c.principal.formulario ? (
                    <button type="button" onClick={() => setFormPaquete(true)}
                      className="bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
                      {c.principal.label}
                    </button>
                  ) : (
                    <Link to={c.principal.to}
                      className="bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
                      {c.principal.label}
                    </Link>
                  )}
                  {c.secundarios.map(s => (
                    <Link key={s.to} to={s.to}
                      className="border-2 border-hero-cream/40 text-hero-cream font-label-lg text-label-sm uppercase px-5 py-2.5 rounded-full hover:border-hero-yellow hover:text-hero-yellow transition-colors">
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────── */}
      <section className="bg-white -mt-8 relative z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(7,46,64,0.05)]">
        <div className="py-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-gutter">
            {SERVICIOS.map(({ label, icono, to }) => (
              <Link key={to} to={to}
                className="flex flex-col items-center p-6 bg-surface rounded-xl hover:shadow-[0_10px_30px_rgba(7,46,64,0.08)] transition-all duration-300 group border border-hero-navy/10">
                <div className="w-16 h-16 rounded-full bg-hero-cream flex items-center justify-center mb-4 group-hover:bg-hero-cream/60 transition-colors">
                  <img src={icono} alt="" className="w-11 h-11 object-contain" />
                </div>
                <span className="font-display-hero uppercase text-hero-navy text-[16px] tracking-wide">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESTINOS FAVORITOS ────────────────────────────────────────── */}
      <section className="py-16 overflow-hidden">
        <div className="mb-8 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy mb-2" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>Destinos Favoritos</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Los lugares más elegidos por nuestros viajeros</p>
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
                    Explorar destino <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 text-center px-margin-mobile">
          <Link to="/destinos" className="inline-flex items-center gap-2 font-label-lg text-label-lg text-deep-ocean bg-surface-container py-3 px-6 rounded-full group">
            Ver todos los destinos
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* ── EXCURSIONES DESTACADAS ───────────────────────────── */}
      <section className="py-16 md:py-20 bg-hero-cream">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy text-center mb-10 md:mb-14"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '0.02em' }}>
            Reserva tu Paseo
          </h2>
          {/* Carrusel que se mueve solo con las flechas (o deslizando): en el celular una
              tarjeta y un poco de la siguiente, desde md tres por vista */}
          <CarruselPaseos>
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
                    <div className="font-label-sm text-[11px] uppercase text-hero-cream/90 whitespace-nowrap">Desde</div>
                    <div className="font-label-sm text-[13px] uppercase text-hero-yellow font-bold whitespace-nowrap">
                      {formatPrecio(e.precio, e.moneda)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CarruselPaseos>
          <div className="mt-10 text-center">
            <Link to="/excursiones" className="border-2 border-deep-ocean text-deep-ocean font-label-lg text-label-lg px-8 py-3 rounded hover:bg-deep-ocean hover:text-white transition-colors inline-block">
              Ver Todos los Paseos
            </Link>
          </div>
        </div>
      </section>

      {/* ── RESEÑAS ──────────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-white rounded-t-3xl">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-display-hero uppercase text-hero-navy mb-10 md:mb-14"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '0.01em' }}>
            Lo que dicen nuestros viajeros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RESENAS.map((r, i) => (
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
                    {r.nombre[0]}
                  </div>
                  <div>
                    <div className="font-label-lg text-[14px] text-hero-navy">{r.nombre}</div>
                    <div className="font-label-sm text-[12px] text-on-surface-variant">Viajó en {r.fecha}</div>
                  </div>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center gap-1.5 border-2 border-hero-navy text-hero-navy font-label-lg text-label-sm uppercase px-5 py-2.5 rounded-full hover:bg-hero-navy hover:text-hero-cream transition-colors">
                  Leer en TripAdvisor
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-4 mt-12">
            <img alt="TripAdvisor" className="h-9 w-auto" src="https://static.tacdn.com/assets/s/2651d377.svg" />
            <a href={TRIPADVISOR_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-hero-navy text-hero-cream font-label-lg text-label-lg uppercase px-8 py-3 rounded-full hover:opacity-90 transition-opacity">
              Ver todas las opiniones
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
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
            Preguntas Frecuentes
          </h2>

          <div className="space-y-4 max-w-4xl mx-auto mb-14 md:mb-20">
            {FAQS.map((faq, i) => (
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
              <span className="font-label-lg text-label-sm uppercase tracking-wider text-hero-navy/60 block mb-1">Información Útil</span>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl md:text-3xl mb-3">Tabla de Marea</h3>
              <p className="font-body-md text-body-md text-hero-navy/70">
                Consultá el estado de las mareas para planificar tus paseos a las piscinas naturales.
              </p>
            </div>
            <div className="bg-hero-sky rounded-2xl p-5">
              {mareaHoy ? (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-hero-navy/15">
                    <span className="font-label-lg text-label-sm uppercase text-hero-navy">Hoy</span>
                    <span className="font-label-lg text-label-sm uppercase text-hero-navy">
                      Piscinas: {mareaHoy.mejor ? `${mareaHoy.estado.label} a las ${mareaHoy.mejor.hora}` : mareaHoy.estado.label}
                    </span>
                  </div>
                  {mareaHoy.mareas.map(m => (
                    <div key={m.hora} className="flex justify-between items-center pt-3">
                      <div className="flex items-center gap-2 text-hero-navy">
                        <span className="material-symbols-outlined text-[18px]">{m.tipo === 'baja' ? 'arrow_downward' : 'arrow_upward'}</span>
                        <span className="font-label-lg text-label-sm uppercase">Marea {m.tipo}</span>
                      </div>
                      <div className="text-right text-hero-navy">
                        <span className="font-label-lg text-[14px]">{m.hora}</span>
                        <span className="font-label-sm text-[12px] text-hero-navy/60 ml-2">{formatoAltura(m.altura)}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="font-body-md text-body-md text-hero-navy">Consultá los mejores días para las piscinas naturales.</p>
              )}
              <div className="mt-4 text-center">
                <Link to="/marea" className="inline-flex items-center gap-1 font-label-lg text-label-sm uppercase text-hero-navy hover:opacity-70 transition-opacity">
                  Ver tabla completa
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
              ¿Quiénes somos?
            </h2>
            <p className="font-display-hero uppercase text-hero-cream mb-8"
              style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
              Creadores de sueños
            </p>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="flex flex-col gap-4 md:flex-1">
                {STATS_NOSOTROS.filter(s => !s.tall).map(s => (
                  <StatPill key={s.label} valor={s.valor} label={s.label} />
                ))}
              </div>
              <div className="md:flex-1">
                {STATS_NOSOTROS.filter(s => s.tall).map(s => (
                  <StatPill key={s.label} valor={s.valor} label={s.label} tall className="h-full" />
                ))}
              </div>
            </div>

            <Link to="/nosotros"
              className="inline-block bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity">
              Conocé nuestra historia y nuestro equipo
            </Link>
          </div>

          <div className="bg-hero-cream rounded-3xl p-3 shadow-2xl max-w-md mx-auto md:mx-0 md:justify-self-end">
            <img src="/equipo.png" alt="Flor y Marcos, equipo DreamTours" className="w-full h-auto object-cover rounded-2xl"
              onError={e => { e.target.src = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80' }} />
          </div>
        </div>
      </section>

      {/* ── CTA WHATSAPP ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-[3fr_2fr] md:min-h-[420px]">
        <div className="bg-hero-sky px-margin-mobile md:px-20 py-14 md:py-16 flex flex-col justify-center">
          <h2 className="font-display-hero uppercase text-white mb-8"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', letterSpacing: '0.01em' }}>
            ¿Querés armar tu viaje a medida?
          </h2>
          <div className="bg-white border-2 border-hero-navy rounded-2xl p-8 max-w-lg">
            <p className="font-body-md text-body-lg text-hero-navy mb-8">
              Completá el formulario y nuestro equipo se va a contactar para diseñar un viaje 100% personalizado según tus intereses, tiempos y presupuesto.
            </p>
            <button type="button" onClick={() => setFormPaquete(true)}
              className="inline-flex items-center gap-2 bg-hero-navy text-white font-display-hero uppercase text-xl px-8 py-4 rounded-full hover:opacity-90 transition-opacity">
              Armá tu viaje
              <span className="material-symbols-outlined text-hero-yellow text-2xl">flight</span>
            </button>
          </div>
        </div>
        <div className="relative h-64 md:h-full overflow-hidden">
          <img src="/viaje-a-medida.jpg" alt="Viajá con DreamTours" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 46%' }} />
        </div>
      </section>

      {/* ── VIDEOS DE LA AGENCIA ──────────────────────────────── */}
      {videosAgencia.length > 0 && (
        <section className="py-16 md:py-20 bg-hero-navy overflow-hidden">
          <div className="mb-8 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
            <h2 className="font-display-hero uppercase text-hero-cream mb-2" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
              Viví Nuestros Viajes
            </h2>
            <p className="font-body-md text-body-md text-hero-cream/70">Momentos reales de nuestros pasajeros en el Nordeste Brasilero</p>
          </div>
          <div className="no-scrollbar overflow-x-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex items-start gap-4" style={{ width: 'max-content' }}>
              {videosAgencia.map(v => esLinkInstagram(v.video_url) ? (
                <PosteoInstagram key={v.id} url={v.video_url} />
              ) : (
                <button key={v.id} onClick={() => setVideoActivo(v)}
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
                className="inline-flex items-center gap-2 border-2 border-hero-cream text-hero-cream font-label-lg text-label-lg px-8 py-3 rounded-full hover:bg-hero-cream hover:text-hero-navy transition-colors">
                Seguinos en Instagram
              </a>
            </div>
          )}
        </section>
      )}

      {/* ── LIGHTBOX DE VIDEO ─────────────────────────────────── */}
      {videoActivo && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-4" onClick={() => setVideoActivo(null)}>
          <button onClick={() => setVideoActivo(null)}
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
