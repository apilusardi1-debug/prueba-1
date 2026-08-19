import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { destinos } from '../../data/mockData.js'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import HeroSearchWidget from '../../components/public/HeroSearchWidget.jsx'

const RESENAS = [
  {
    nombre: 'María González',
    inicial: 'M',
    titulo: '"El mejor viaje de nuestra vida"',
    texto: 'La organización fue impecable. Los guías nos llevaron a las mejores playas y nos recomendaron lugares increíbles para comer. Totalmente recomendado.',
    fecha: 'Enero 2024',
  },
  {
    nombre: 'Carlos y Familia',
    inicial: 'C',
    titulo: '"Atención personalizada al 100%"',
    texto: 'Se encargaron de todo, desde los traslados hasta las excursiones. Solo nos dedicamos a disfrutar de Maragogi. Un servicio de 10 puntos.',
    fecha: 'Noviembre 2023',
  },
  {
    nombre: 'Laura Martínez',
    inicial: 'L',
    titulo: '"Lugares mágicos"',
    texto: 'Conocer las piscinas naturales fue increíble. El equipo de DreamTours hizo que toda la experiencia fuera segura y muy divertida. Volveremos.',
    fecha: 'Octubre 2023',
  },
]

const FAQS = [
  {
    q: '¿Cuál es la mejor época para viajar?',
    a: 'La mejor época es entre septiembre y marzo, cuando llueve menos y las aguas son más cristalinas. Evitá junio y julio, que es temporada de lluvias en Pernambuco y Alagoas.',
  },
  {
    q: '¿Cómo funcionan las piscinas naturales?',
    a: 'Las piscinas se forman solo con marea baja (menos de 0.7 metros). Nuestros guías conocen los horarios exactos de cada día para que no te pierdas el momento ideal.',
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
  const [excursionesDestacadas, setExcursionesDestacadas] = useState([])

  useEffect(() => {
    async function cargarExcursiones() {
      try {
        const { data, error } = await excursionesApi.getAll()
        if (!error && data) {
          setExcursionesDestacadas(
            data.map(normalizarExcursion).filter(e => e.categoria === 'excursiones').slice(0, 3)
          )
        }
      } catch (_) {}
    }
    cargarExcursiones()
  }, [])

  return (
    <div className="bg-surface">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[760px] md:min-h-[820px] flex flex-col justify-center pt-32 pb-20 md:pb-28 overflow-hidden">
        <div className="absolute inset-0">
          <video
            src={config?.hero_video || '/hero.mp4'}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        <div className="relative z-10 px-margin-mobile md:px-margin-desktop w-full max-w-container-max mx-auto">
          {/* Titular principal */}
          <h1 className="font-display-hero uppercase text-hero-cream"
            style={{ fontSize: 'clamp(2.75rem, 6.8vw, 5.25rem)', lineHeight: 0.95, letterSpacing: '0.01em' }}>
            Hace realidad el viaje
          </h1>
          <p className="font-script-hero text-hero-sky"
            style={{ fontSize: 'clamp(3.5rem, 9vw, 6.5rem)', lineHeight: 1, marginTop: '-0.1em' }}>
            de tus sueños
          </p>

          <div className="flex gap-4 flex-wrap mt-8 mb-16 md:mb-20">
            <Link to="/paquetes"
              className="border-2 border-hero-yellow text-hero-cream font-label-lg text-label-lg uppercase px-8 py-3 rounded-full transition-colors hover:bg-hero-yellow hover:text-hero-navy">
              Ver Paquetes
            </Link>
            <Link to="/paquetes"
              className="border-2 border-hero-yellow text-hero-cream font-label-lg text-label-lg uppercase px-8 py-3 rounded-full transition-colors hover:bg-hero-yellow hover:text-hero-navy">
              Planear mi viaje
            </Link>
          </div>

          <HeroSearchWidget />
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────── */}
      <section className="py-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto bg-white -mt-8 relative z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,33,71,0.05)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-gutter">
          {SERVICIOS.map(({ label, icono, to }) => (
            <Link key={to} to={to}
              className="flex flex-col items-center p-6 bg-surface rounded-xl hover:shadow-[0_10px_30px_rgba(0,33,71,0.08)] transition-all duration-300 group border border-hero-navy/10">
              <div className="w-16 h-16 rounded-full bg-hero-cream flex items-center justify-center mb-4 group-hover:bg-hero-cream/60 transition-colors">
                <img src={icono} alt="" className="w-11 h-11 object-contain" />
              </div>
              <span className="font-display-hero uppercase text-hero-navy text-[16px] tracking-wide">{label}</span>
            </Link>
          ))}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {excursionesDestacadas.map(e => (
              <Link key={e.id} to={`/excursiones/${e.id}`}
                className="group block rounded-3xl overflow-hidden border-2 border-hero-navy shadow-[0_8px_24px_rgba(0,33,71,0.12)] hover:shadow-[0_12px_32px_rgba(0,33,71,0.2)] transition-shadow">
                <div className="h-64 md:h-80 overflow-hidden">
                  <img src={e.imagen} alt={e.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="bg-hero-navy px-5 py-4 flex items-center justify-between gap-3">
                  <h3 className="font-display-hero uppercase text-hero-cream text-xl md:text-2xl leading-none line-clamp-2">
                    {e.nombre}
                  </h3>
                  <div className="text-right flex-shrink-0">
                    <div className="font-label-sm text-[11px] uppercase text-hero-cream/90 whitespace-nowrap">
                      Desde {e.moneda === 'USD' ? 'US$' : 'R$'} {e.precio}
                    </div>
                    <div className="font-label-sm text-[11px] uppercase text-hero-yellow font-bold whitespace-nowrap">
                      {e.cuposDisponibles} Cupos
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/excursiones" className="border-2 border-deep-ocean text-deep-ocean font-label-lg text-label-lg px-8 py-3 rounded hover:bg-deep-ocean hover:text-white transition-colors inline-block">
              Ver Todas las Excursiones
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
              <div key={i} className="bg-white border-2 border-hero-navy rounded-2xl p-8">
                <div className="flex gap-1 text-hero-yellow mb-4">
                  {[...Array(5)].map((_, s) => (
                    <span key={s} className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                  ))}
                </div>
                <h3 className="font-label-lg text-[16px] text-hero-navy mb-3">{r.titulo}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6 italic">"{r.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-label-lg text-hero-navy font-bold">
                    {r.inicial}
                  </div>
                  <div>
                    <div className="font-label-lg text-[14px] text-hero-navy">{r.nombre}</div>
                    <div className="font-label-sm text-[12px] text-on-surface-variant">Viajó en {r.fecha}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-12">
            <img alt="TripAdvisor" className="h-9 w-auto" src="https://static.tacdn.com/assets/s/2651d377.svg" />
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

          <div className="space-y-4 max-w-3xl mx-auto mb-14 md:mb-20">
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

          <div className="bg-hero-cream rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center max-w-4xl mx-auto">
            <div>
              <span className="font-label-lg text-label-sm uppercase tracking-wider text-hero-navy/60 block mb-1">Información Útil</span>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl md:text-3xl mb-3">Tabla de Marea</h3>
              <p className="font-body-md text-body-md text-hero-navy/70">
                Consultá el estado de las mareas para planificar tus paseos a las piscinas naturales.
              </p>
            </div>
            <div className="bg-hero-sky rounded-2xl p-5">
              <div className="flex justify-between items-center pb-3 border-b border-hero-navy/15">
                <div className="flex items-center gap-2 text-hero-navy">
                  <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                  <span className="font-label-lg text-label-sm uppercase">Marea Baja</span>
                </div>
                <div className="text-right text-hero-navy">
                  <div className="font-label-lg text-[14px]">09:30 AM</div>
                  <div className="font-label-sm text-[12px] text-hero-navy/60">0.2m</div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-3">
                <div className="flex items-center gap-2 text-hero-navy">
                  <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                  <span className="font-label-lg text-label-sm uppercase">Marea Alta</span>
                </div>
                <div className="text-right text-hero-navy">
                  <div className="font-label-lg text-[14px]">03:45 PM</div>
                  <div className="font-label-sm text-[12px] text-hero-navy/60">2.1m</div>
                </div>
              </div>
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

          <div className="bg-hero-cream rounded-3xl p-3 shadow-2xl rotate-2 max-w-md mx-auto md:mx-0 md:justify-self-end">
            <img src="/equipo.png" alt="Flor y Marcos, equipo DreamTours" className="w-full h-auto object-cover rounded-2xl"
              onError={e => { e.target.src = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80' }} />
          </div>
        </div>
      </section>

      {/* ── CTA WHATSAPP ─────────────────────────────────────── */}
      <section className="py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="bg-tropical-sun rounded-3xl p-10 text-center">
          <h2 className="font-headline-lg text-headline-lg text-deep-ocean mb-3">¿Querés armar tu viaje a medida?</h2>
          <p className="font-body-lg text-body-lg text-deep-ocean/70 mb-8 max-w-xl mx-auto">
            Contactanos y diseñamos el viaje perfecto para vos
          </p>
          <a href={`https://wa.me/${config?.whatsapp || ''}?text=Hola!%20Quiero%20armar%20mi%20viaje%20al%20Nordeste%20Brasilero`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-deep-ocean text-white font-label-lg text-label-lg px-10 py-4 rounded-full hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Comunicarme por WhatsApp
          </a>
        </div>
      </section>

    </div>
  )
}
