import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

// Los textos están en src/lib/i18n.js (claves about_*), en español, portugués e inglés
const VALORES = [
  { icono: 'beach_access', n: 1 },
  { icono: 'flight', n: 2 },
  { icono: 'forum', n: 3 },
]

const DESTINOS = ['Porto de Galinhas', 'Maragogi', 'Maceió', 'Pipa', 'Fernando de Noronha']

export default function Nosotros() {
  const { t } = useLang()
  const { config } = useSiteConfig()

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            {t('about_heading')}
          </h1>
          <p className="font-body-md text-body-lg text-hero-cream/90 max-w-2xl mt-4">
            {t('about_text')}
          </p>
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-12 md:py-16">
        {/* Valores */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-12">
          {VALORES.map(({ icono, n }) => (
            <div key={n} className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-hero-navy/10">
              <div className="w-16 h-16 rounded-full bg-hero-cream flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-hero-navy text-[32px]">{icono}</span>
              </div>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-2">{t(`about_v${n}_title`)}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{t(`about_v${n}_text`)}</p>
            </div>
          ))}
        </div>

        {/* Destinos */}
        <div className="bg-hero-cream rounded-2xl p-8 mb-6">
          <h2 className="font-display-hero uppercase text-hero-navy mb-5"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }}>
            {t('about_destinations')}
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
            {t('about_cta_title')}
          </h2>
          <p className="font-body-md text-body-md text-hero-cream/70 mb-8">
            {t('about_cta_text')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(t('about_wa_message'))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              WhatsApp
            </a>
            <a
              href={config?.instagram_url || 'https://www.instagram.com/dreamtours_esp/'}
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
