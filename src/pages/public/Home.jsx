import { useState } from 'react'
import { Link } from 'react-router-dom'
import { excursiones, destinos } from '../../data/mockData.js'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

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
  { label: 'Vuelos',    icon: 'flight',         to: '/paquetes' },
  { label: 'Hoteles',   icon: 'hotel',          to: '/hoteles' },
  { label: 'Traslados', icon: 'directions_car', to: '/traslados' },
  { label: 'Tours',     icon: 'explore',        to: '/excursiones' },
]

export default function Home() {
  const { config } = useSiteConfig()
  const [faqOpen, setFaqOpen] = useState(null)
  const excursionesDestacadas = excursiones.filter(e => e.categoria === 'excursiones').slice(0, 3)

  return (
    <div className="bg-surface">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex items-end pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <video
            src={config?.hero_video || '/hero.mp4'}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 glass-overlay" />
        </div>
        <div className="relative z-10 px-margin-mobile md:px-margin-desktop w-full max-w-container-max mx-auto text-white">
          {/* Label superior */}
          <p style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.72)',
            marginBottom: '16px'
          }}>
            Creadores de Sueños
          </p>
          {/* Titular principal */}
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 500,
            fontSize: 'clamp(3.2rem, 7.5vw, 6.2rem)',
            lineHeight: 0.98,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            marginBottom: '20px'
          }}>
            Tu viaje al{' '}
            <span style={{ fontStyle: 'italic' }}>Nordeste</span>{' '}
            Brasilero
          </h1>
          {/* Subcopy */}
          <p style={{
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '16px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.78)',
            marginBottom: '32px',
            maxWidth: '480px'
          }}>
            Descubrí las piscinas naturales mas lindas de Brasil.
          </p>
          <Link to="/paquetes"
            className="bg-tropical-sun text-deep-ocean font-label-lg text-label-lg px-8 py-4 rounded hover:opacity-90 transition-all duration-300 shadow-lg inline-block">
            Explorar Destinos
          </Link>
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────── */}
      <section className="py-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto bg-white -mt-8 relative z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,33,71,0.05)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-gutter">
          {SERVICIOS.map(({ label, icon, to }) => (
            <Link key={to} to={to}
              className="flex flex-col items-center p-6 bg-surface rounded-xl hover:shadow-[0_10px_30px_rgba(0,33,71,0.08)] transition-all duration-300 group border border-surface-variant/50">
              <div className="w-12 h-12 rounded-full bg-deep-ocean/5 flex items-center justify-center mb-4 group-hover:bg-deep-ocean/10 transition-colors">
                <span className="material-symbols-outlined text-deep-ocean" style={{ fontVariationSettings: '"FILL" 1' }}>{icon}</span>
              </div>
              <span className="font-label-lg text-label-lg text-deep-ocean">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── DESTINOS FAVORITOS ────────────────────────────────────────── */}
      <section className="py-16 overflow-hidden">
        <div className="mb-8 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h2 className="font-headline-lg text-headline-lg text-deep-ocean mb-2">Destinos Favoritos</h2>
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
                  <h3 className="font-headline-md text-headline-md text-white mb-1">{d.nombre}</h3>
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
      <section className="py-16 bg-surface-container-low">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="mb-10 text-center md:text-left">
            <span className="font-label-lg text-label-lg text-primary uppercase tracking-wider block mb-2">Aventuras</span>
            <h2 className="font-headline-lg text-headline-lg text-deep-ocean">Excursiones Destacadas</h2>
          </div>
          <div className="flex flex-col gap-6">
            {excursionesDestacadas.map((e, i) => (
              <div key={e.id} className="bg-white rounded-xl overflow-hidden flex flex-col md:flex-row shadow-[0_4px_20px_rgba(0,33,71,0.05)]">
                <div className="md:w-1/3 h-48 md:h-auto">
                  <img src={e.imagen} alt={e.nombre} className="w-full h-full object-cover" />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-md text-headline-md text-deep-ocean">{e.nombre}</h3>
                    {i === 0 && (
                      <span className="border border-primary/50 text-primary text-[10px] tracking-[0.1em] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                        Más Popular
                      </span>
                    )}
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6">{e.descripcion}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center text-on-surface-variant gap-1 text-sm">
                      <span className="material-symbols-outlined text-[18px]">schedule</span>
                      {e.duracion}
                    </div>
                    <Link to={`/excursiones/${e.id}`} className="text-deep-ocean font-label-lg text-label-lg border-b-2 border-transparent hover:border-deep-ocean transition-all">
                      Ver Detalles
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/excursiones" className="border-2 border-deep-ocean text-deep-ocean font-label-lg text-label-lg px-8 py-3 rounded hover:bg-deep-ocean hover:text-white transition-colors inline-block">
              Ver Todas las Excursiones
            </Link>
          </div>
        </div>
      </section>

      {/* ── TABLA DE MAREAS ──────────────────────────────────── */}
      <section className="py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="bg-deep-ocean text-white rounded-3xl p-8 md:p-10 relative overflow-hidden shadow-[0_20px_40px_rgba(0,33,71,0.1)]">
          <div className="absolute -right-16 -top-16 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: '200px' }}>water</span>
          </div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-2 text-primary-fixed">
                <span className="material-symbols-outlined">waves</span>
                <span className="font-label-lg text-label-lg uppercase tracking-wider">Información Útil</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg mb-4 text-white">Tabla de Mareas</h2>
              <p className="font-body-md text-body-md text-surface-container-highest opacity-90 max-w-md">
                Consultá el estado de las mareas para planificar tus visitas a las piscinas naturales. Las mejores condiciones se dan con marea baja.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <span className="font-label-lg text-[16px]">Hoy, Maragogi</span>
                <span className="bg-primary-fixed/20 text-primary-fixed font-label-sm text-[12px] px-3 py-1 rounded-full">Luna Llena</span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-inverse-primary">arrow_downward</span>
                    <span className="font-body-md">Marea Baja</span>
                  </div>
                  <div className="text-right">
                    <div className="font-label-lg">09:30 AM</div>
                    <div className="font-label-sm text-surface-variant">0.2m</div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-error-container">arrow_upward</span>
                    <span className="font-body-md">Marea Alta</span>
                  </div>
                  <div className="text-right">
                    <div className="font-label-lg">03:45 PM</div>
                    <div className="font-label-sm text-surface-variant">2.1m</div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 text-center">
                <Link to="/marea" className="inline-flex items-center gap-1 font-label-lg text-label-lg text-white hover:text-primary-fixed transition-colors group">
                  Ver tabla completa
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESEÑAS ──────────────────────────────────────────── */}
      <section className="py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto bg-surface-container-highest rounded-t-3xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <img alt="TripAdvisor" className="h-10 w-auto" src="https://static.tacdn.com/assets/s/2651d377.svg" />
          </div>
          <h2 className="font-headline-lg text-headline-lg text-deep-ocean">Lo que dicen nuestros viajeros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {RESENAS.map((r, i) => (
            <div key={i} className="bg-white rounded-3xl p-8 shadow-[0_10px_30px_rgba(0,33,71,0.05)]">
              <div className="flex gap-1 text-[#00aa6c] mb-4">
                {[...Array(5)].map((_, s) => (
                  <span key={s} className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                ))}
              </div>
              <h3 className="font-label-lg text-[16px] text-deep-ocean mb-3">{r.titulo}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6 italic">"{r.texto}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-label-lg text-deep-ocean font-bold">
                  {r.inicial}
                </div>
                <div>
                  <div className="font-label-lg text-[14px] text-deep-ocean">{r.nombre}</div>
                  <div className="font-label-sm text-[12px] text-on-surface-variant">Viajó en {r.fecha}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="mb-10 text-center">
          <span className="font-label-lg text-label-lg text-primary uppercase tracking-wider block mb-2">Ayuda</span>
          <h2 className="font-headline-lg text-headline-lg text-deep-ocean">Preguntas Frecuentes</h2>
        </div>
        <div className="space-y-4 max-w-3xl mx-auto">
          {FAQS.map((faq, i) => (
            <div key={i}
              className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,33,71,0.05)] cursor-pointer"
              onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
              <div className="flex justify-between items-center">
                <h3 className="font-headline-md text-[18px] text-deep-ocean pr-4">{faq.q}</h3>
                <span className="material-symbols-outlined flex-shrink-0 text-on-surface-variant transition-transform duration-200"
                  style={{ transform: faqOpen === i ? 'rotate(180deg)' : 'none' }}>
                  expand_more
                </span>
              </div>
              {faqOpen === i && (
                <p className="mt-4 font-body-md text-body-md text-on-surface-variant">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── QUIÉNES SOMOS ────────────────────────────────────── */}
      <section className="py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="max-w-3xl">
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-deep-ocean mb-8">¿Quiénes somos?</h2>
          <div className="space-y-6 mb-10">
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Somos Flor y Marcos, hermanos argentinos que con nuestra experiencia en el nordeste brasilero, creamos DreamTours, una agencia familiar dedicada a ofrecerte la mejor experiencia.
            </p>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              No solo planeamos tu viaje, sino que también te recibimos en destino para que disfrutes cada momento.
            </p>
          </div>
          <Link to="/nosotros"
            className="inline-block bg-deep-ocean text-white font-label-lg text-label-lg px-10 py-4 rounded mb-12 hover:bg-deep-ocean/90 transition-colors">
            Conocé al Equipo
          </Link>
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <img src="/equipo.jpg" alt="Nuestro equipo" className="w-full h-auto object-cover"
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
