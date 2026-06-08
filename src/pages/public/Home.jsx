import { Link } from 'react-router-dom'
import { useState } from 'react'
import { destinos } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

const C = {
  amarillo: '#f6c31b',
  crema:    '#fff9e5',
  teal:     '#18c5e6',
  oscuro:   '#1c1208',
}

const RESENAS = [
  {
    nombre: 'Elisa L',
    texto: 'Los argentinos más geniales de Pernambuco. Fue increíble vivir momentos maravillosos en Praia dos Carneiros y Maragogi con esta fantástica agencia. Me trataron de maravilla y me brindaron experiencias increíbles en playas espectaculares. ¡Los recomiendo ampliamente, especialmente a quienes vienen de Latinoamérica!',
    url: 'https://www.tripadvisor.com.br/ShowUserReviews-g303461-d33088974-r1046970088-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
    img: 'https://www.tripadvisor.com.br/profile/photo?d=MAHL4GFaOuE',
  },
  {
    nombre: 'Fabian G',
    texto: '¡Amabilidad, excelencia! Recomiendo ampliamente la agencia Dream Tours; se encargaron de todo, desde el más mínimo detalle. Ha sido un placer trabajar con ellos durante años. Victoria, fue un placer contar contigo en esta ocasión ...',
    url: 'https://www.tripadvisor.com.br/ShowUserReviews-g303461-d33088974-r1046970088-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
    img: 'https://www.tripadvisor.com.br/profile/photo?d=MAHL4J9c6So',
  },
  {
    nombre: 'Julieta C',
    texto: 'Excelente, muchísimas gracias por todo.',
    url: 'https://www.tripadvisor.com.br/ShowUserReviews-g303461-d33088974-r1050566558-Dream_Tours-Porto_de_Galinhas_Ipojuca_State_of_Pernambuco.html',
    img: 'https://www.tripadvisor.com.br/profile/photo?d=MAHL4O4ffzg',
  },
]

const FAQS = [
  {
    q: '¿Cuál es la mejor época para visitar el Nordeste?',
    a: 'Setiembre a marzo son los meses ideales: poco viento, aguas cristalinas y mareas perfectas para las piscinas naturales. Evitá junio y julio, que es la temporada de lluvias en Pernambuco y Alagoas.',
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
    q: '¿Necesito vacunas para entrar a Brasil?',
    a: 'No es obligatorio. Se recomienda tener la vacuna de fiebre amarilla al día, especialmente si viajás a zonas rurales. Para los destinos de playa del Nordeste no es requerida.',
  },
]

const HERO_VIDEO = '/hero.mp4'
const MAREA_VIDEO = '/marea.mp4'
const EQUIPO_IMG = '/equipo.jpg'

const HV = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const JAH = "'Just Another Hand', cursive"

const secTitle = {
  fontFamily: HV,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: C.teal,
  fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
  lineHeight: 1.1,
}

export default function Home() {
  const { t } = useLang()
  const { config } = useSiteConfig()
  const [faqAbierto, setFaqAbierto] = useState(null)

  return (
    <div style={{ background: C.crema }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{ minHeight: '90vh', display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden' }}>
        <video
          src={config.hero_video || HERO_VIDEO}
          autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,18,8,0.82) 0%, rgba(28,18,8,0.15) 50%, transparent 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '0 32px 64px', maxWidth: 700 }}>
          <h1 style={{
            fontFamily: JAH,
            fontSize: 'clamp(3.8rem, 10vw, 7rem)',
            color: C.amarillo,
            lineHeight: 1.05,
            marginBottom: 14,
          }}>
            {t('hero_title')}
          </h1>
          <p style={{
            fontFamily: HV,
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 30,
            lineHeight: 1.6,
            fontWeight: 600,
          }}>
            {t('hero_subtitle')}
          </p>
          <Link to="/paquetes" style={{
            background: C.teal,
            color: 'white',
            fontFamily: HV,
            fontWeight: 700,
            padding: '13px 36px',
            borderRadius: 8,
            fontSize: '0.85rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            VER TODO
          </Link>
        </div>
      </section>

      {/* ── Destinos ─────────────────────────────────────────────── */}
      <section style={{ background: C.crema, padding: '44px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={secTitle}>DESTINOS</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <style>{`@media(max-width:700px){.dest-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
            {destinos.slice(0, 5).map((d) => (
              <Link key={d.id} to={`/destinos/${d.id}`}
                className="dest-grid"
                style={{ borderRadius: 18, aspectRatio: '3/4', display: 'block', textDecoration: 'none', position: 'relative', overflow: 'hidden' }}
              >
                <img src={d.imagen} alt={d.nombre}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s' }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.07)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,18,8,0.7) 0%, transparent 55%)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
                  <p style={{ fontFamily: HV, fontWeight: 700, fontSize: '0.8rem', color: 'white', lineHeight: 1.3 }}>
                    {d.nombre} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link to="/destinos" style={{
              border: `2px solid ${C.amarillo}`,
              color: C.oscuro,
              fontFamily: HV,
              fontWeight: 700,
              padding: '9px 32px',
              borderRadius: 999,
              fontSize: '0.82rem',
              letterSpacing: '0.08em',
              textDecoration: 'none',
              display: 'inline-block',
            }}>
              Ver todos →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Quiénes somos ────────────────────────────────────────── */}
      <section style={{ background: '#0d2e2e', display: 'grid', gridTemplateColumns: '55% 45%' }}>
        <style>{`@media(max-width:640px){.qs-grid{grid-template-columns:1fr!important}}`}</style>
        <div className="qs-grid" style={{ minHeight: 400, position: 'relative', overflow: 'hidden' }}>
          <img
            src={EQUIPO_IMG}
            alt="Equipo Dream Tours"
            style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 400, display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, #0d2e2e 100%)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 36px 40px 28px' }}>
          <p style={{ fontFamily: HV, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.2em', color: C.amarillo, textTransform: 'uppercase', marginBottom: 14 }}>
            QUIÉNES SOMOS?
          </p>
          <p style={{ fontFamily: HV, fontSize: '0.88rem', color: 'rgba(255,249,229,0.78)', lineHeight: 1.85, marginBottom: 22 }}>
            Somos Flor y Marcos, hermanos argentinos que con nuestra experiencia en el nordeste de Brasil, creamos Dream Tours, una agencia familiar dedicada a ofrecerte la mejor experiencia. No solo planeamos tu viaje, sino que también te recibimos en el destino para que disfrutes cada momento.
          </p>
          <Link to="/nosotros" style={{ color: C.amarillo, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', fontFamily: HV }}>
            Conocé nuestra historia →
          </Link>
        </div>
      </section>

      {/* ── Dudas frecuentes ─────────────────────────────────────── */}
      <section style={{ background: C.crema, padding: '48px 28px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ ...secTitle, marginBottom: 28 }}>DUDAS FRECUENTES</h2>
          <div style={{ borderTop: `2px solid ${C.amarillo}` }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: `1px solid rgba(246,195,27,0.35)` }}>
                <button
                  onClick={() => setFaqAbierto(faqAbierto === i ? null : i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
                >
                  <span style={{ fontFamily: HV, fontWeight: 600, fontSize: '0.95rem', color: C.oscuro }}>{faq.q}</span>
                  <span style={{
                    fontSize: '1.4rem', color: C.teal, fontWeight: 300, flexShrink: 0, lineHeight: 1,
                    transform: faqAbierto === i ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}>+</span>
                </button>
                {faqAbierto === i && (
                  <p style={{ fontFamily: HV, fontSize: '0.9rem', color: '#5a4530', lineHeight: 1.75, paddingBottom: 16 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reseñas ──────────────────────────────────────────────── */}
      <section style={{ background: C.amarillo, padding: '44px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ ...secTitle, color: C.oscuro, marginBottom: 24, lineHeight: 1.2 }}>
            LO QUE DICEN<br />NUESTROS CLIENTES
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {RESENAS.map((r) => (
              <a key={r.nombre} href={r.url} target="_blank" rel="noopener noreferrer"
                style={{ background: 'white', borderRadius: 14, padding: '18px 16px', textDecoration: 'none', display: 'block' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, fontFamily: HV }}>
                    {r.nombre[0]}
                  </div>
                  <div>
                    <p style={{ fontFamily: HV, fontWeight: 700, fontSize: '0.78rem', color: C.oscuro, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>{r.nombre}</p>
                    <p style={{ color: C.amarillo, fontSize: '0.72rem', marginTop: 3, letterSpacing: 2 }}>★★★★★</p>
                  </div>
                </div>
                <p style={{ fontFamily: HV, fontSize: '0.82rem', color: '#5a4530', lineHeight: 1.65, fontStyle: 'italic' }}>"{r.texto}"</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tabla de Marea + CTA ─────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 260 }}>
        <style>{`@media(max-width:640px){.marea-split{grid-template-columns:1fr!important}}`}</style>

        {/* Lado Marea */}
        <div className="marea-split" style={{ position: 'relative', minHeight: 260, overflow: 'hidden', background: '#0d3042', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video src={MAREA_VIDEO} autoPlay loop muted playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,48,66,0.4)' }} />
          <Link to="/marea" style={{
            position: 'relative', zIndex: 1,
            border: '2px solid white', color: 'white',
            fontFamily: HV, fontWeight: 700,
            padding: '12px 28px', borderRadius: 6,
            fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            TABLA DE MAREA →
          </Link>
        </div>

        {/* Lado CTA */}
        <div style={{ background: C.crema, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 28px', textAlign: 'center', gap: 12 }}>
          <p style={{ fontFamily: HV, fontWeight: 800, fontSize: 'clamp(1rem,2vw,1.35rem)', color: C.oscuro, lineHeight: 1.25 }}>
            ¿Querés armar tu viaje a medida?
          </p>
          <p style={{ fontFamily: HV, fontSize: '0.88rem', color: '#5a4530', fontWeight: 400 }}>
            Hablá directamente con nuestro equipo
          </p>
          <a
            href={`https://wa.me/${config.whatsapp}?text=Hola!%20Me%20interesa%20viajar%20al%20Nordeste%20Brasilero`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: C.amarillo,
              color: C.oscuro,
              fontFamily: HV,
              fontWeight: 800,
              padding: '13px 32px',
              borderRadius: 999,
              fontSize: '0.82rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            COMUNICARME →
          </a>
        </div>
      </section>

    </div>
  )
}
