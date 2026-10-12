import { useLang } from '../../context/LanguageContext.jsx'

const VALORES = [
  { icono: 'beach_access', title: 'Especialistas en Nordeste', text: 'Conocemos cada rincón del Nordeste Brasilero. Nuestro equipo viaja regularmente para brindarte la mejor experiencia.' },
  { icono: 'flight', title: 'Paquetes completos', text: 'Nos encargamos de todo: vuelos, traslados, hospedaje y paseos. Vos solo pensá en disfrutar.' },
  { icono: 'forum', title: 'Atención personalizada', text: 'Te acompañamos desde la consulta hasta que volvés a casa. Siempre disponibles por WhatsApp.' },
]

const DESTINOS = ['Porto de Galinhas', 'Maragogi', 'Maceió', 'Pipa', 'Fernando de Noronha']

export default function Nosotros() {
  const { t } = useLang()

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            Quiénes somos
          </h1>
          <p className="font-body-md text-body-lg text-hero-cream/90 max-w-2xl mt-4">
            {t('about_text')}
          </p>
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-12 md:py-16">
        {/* Valores */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-12">
          {VALORES.map(({ icono, title, text }) => (
            <div key={title} className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-hero-navy/10">
              <div className="w-16 h-16 rounded-full bg-hero-cream flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-hero-navy text-[32px]">{icono}</span>
              </div>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-2">{title}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{text}</p>
            </div>
          ))}
        </div>

        {/* Destinos */}
        <div className="bg-hero-cream rounded-2xl p-8 mb-6">
          <h2 className="font-display-hero uppercase text-hero-navy mb-5"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
            Nuestros destinos
          </h2>
          <div className="flex flex-wrap gap-3">
            {DESTINOS.map(d => (
              <span key={d} className="bg-white border border-hero-navy/20 text-hero-navy font-label-lg text-[14px] px-5 py-2 rounded-full">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-hero-navy rounded-2xl px-8 py-12 text-center">
          <h2 className="font-display-hero uppercase text-hero-cream mb-3"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '0.01em' }}>
            ¿Listo para tu próximo viaje?
          </h2>
          <p className="font-body-md text-body-md text-hero-cream/70 mb-8">
            Hablá con nosotros y armamos el paquete perfecto para vos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/5491100000000?text=Hola!%20Quiero%20armar%20un%20viaje%20al%20Nordeste%20Brasilero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              WhatsApp
            </a>
            <a
              href="https://www.instagram.com/dreamtours_esp/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border-2 border-hero-yellow text-hero-cream font-label-lg text-label-lg uppercase px-8 py-3 rounded-full hover:bg-hero-yellow hover:text-hero-navy transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
