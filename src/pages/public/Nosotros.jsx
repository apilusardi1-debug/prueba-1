import { useLang } from '../../context/LanguageContext.jsx'

export default function Nosotros() {
  const { t } = useLang()

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ borderBottom: '1px solid #e8d09a', padding: '72px 16px 56px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', color: '#b07420', textTransform: 'uppercase', marginBottom: 16 }}>
          La agencia
        </p>
        <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2.5rem,6vw,4.5rem)', color: '#1C1208', lineHeight: 1.0, marginBottom: 20 }}>
          DREAMSTOUR
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#1C1208AA', maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 300 }}>
          {t('about_text')}
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Valores */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: '🏖️', title: 'Especialistas en Nordeste', text: 'Conocemos cada rincón del Nordeste Brasilero. Nuestro equipo viaja regularmente para brindarte la mejor experiencia.' },
            { icon: '✈️', title: 'Paquetes completos', text: 'Nos encargamos de todo: vuelos, traslados, hospedaje y excursiones. Vos solo pensá en disfrutar.' },
            { icon: '💬', title: 'Atención personalizada', text: 'Te acompañamos desde la consulta hasta que volvés a casa. Siempre disponibles por WhatsApp.' },
          ].map(({ icon, title, text }) => (
            <div key={title} style={{ background: 'white', borderRadius: 20, padding: '28px 24px', border: '1px solid #e8d09a', textAlign: 'center' }}>
              <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>{icon}</p>
              <h3 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.1rem', color: '#1C1208', marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: '0.85rem', color: '#1C1208AA', lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Destinos */}
        <div style={{ background: '#f2e4c0', borderRadius: 20, padding: '32px', marginBottom: 16 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>Operamos en</p>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.5rem', color: '#1C1208', marginBottom: 20 }}>Nuestros destinos</h2>
          <div className="flex flex-wrap gap-3">
            {['🐠 Porto de Galinhas', '🪸 Maragogi', '🌴 Maceió', '🏄 Pipa', '🏜️ Natal', '🐢 Fernando de Noronha'].map((d) => (
              <span key={d} style={{ background: 'white', border: '1px solid #d9a83a', color: '#8a581e', fontWeight: 600, padding: '8px 18px', borderRadius: 999, fontSize: '0.85rem' }}>
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: '#1C1208', borderRadius: 20, padding: '48px 32px', textAlign: 'center', marginTop: 16 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', color: '#d9a83a', textTransform: 'uppercase', marginBottom: 16 }}>Hablemos</p>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 'clamp(1.5rem,3vw,2.2rem)', color: '#f9f3e3', lineHeight: 1.15, marginBottom: 12 }}>
            ¿Listo para tu próximo viaje?
          </h2>
          <p style={{ color: '#e8d09a88', fontSize: '0.95rem', marginBottom: 32, fontWeight: 300 }}>
            Hablá con nosotros y armamos el paquete perfecto para vos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/5491100000000?text=Hola!%20Quiero%20armar%20un%20viaje%20al%20Nordeste%20Brasilero"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#b07420', color: '#f9f3e3', fontWeight: 700, padding: '14px 32px', borderRadius: 999, fontSize: '0.95rem', textDecoration: 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#8a581e'}
              onMouseLeave={e => e.currentTarget.style.background='#b07420'}
            >
              💬 WhatsApp
            </a>
            <a
              href="https://instagram.com/dreamstour"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid #f9f3e344', color: '#f9f3e3', fontWeight: 600, padding: '14px 32px', borderRadius: 999, fontSize: '0.95rem', textDecoration: 'none', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(249,243,227,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              📸 Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
