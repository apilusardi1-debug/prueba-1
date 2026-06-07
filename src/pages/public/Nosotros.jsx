import { useLang } from '../../context/LanguageContext.jsx'

export default function Nosotros() {
  const { t } = useLang()

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-14">
        <p className="text-5xl mb-4">✈️</p>
        <h1 className="text-4xl font-black text-gray-900 mb-4">DREAMSTOUR</h1>
        <p className="text-xl text-gray-500 max-w-xl mx-auto">{t('about_text')}</p>
      </div>

      {/* Valores */}
      <div className="grid md:grid-cols-3 gap-6 mb-14">
        {[
          { icon: '🏖️', title: 'Especialistas en Nordeste', text: 'Conocemos cada rincón del Nordeste Brasilero. Nuestro equipo viaja regularmente para brindarte la mejor experiencia.' },
          { icon: '✈️', title: 'Paquetes completos', text: 'Nos encargamos de todo: vuelos, traslados, hospedaje y excursiones. Vos solo pensá en disfrutar.' },
          { icon: '💬', title: 'Atención personalizada', text: 'Te acompañamos desde la consulta hasta que volvés a casa. Siempre disponibles por WhatsApp.' },
        ].map(({ icon, title, text }) => (
          <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <p className="text-4xl mb-3">{icon}</p>
            <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500">{text}</p>
          </div>
        ))}
      </div>

      {/* Destinos que operamos */}
      <div className="bg-brand-50 rounded-2xl p-8 mb-14">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Nuestros destinos</h2>
        <div className="flex flex-wrap gap-3">
          {['🐠 Porto de Galinhas', '🪸 Maragogi', '🌴 Maceió', '🏄 Pipa', '🏜️ Natal', '🐢 Fernando de Noronha'].map((d) => (
            <span key={d} className="bg-white border border-brand-200 text-brand-700 font-medium px-4 py-2 rounded-full text-sm">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* CTA contacto */}
      <div className="text-center bg-gray-900 text-white rounded-2xl p-10">
        <h2 className="text-2xl font-bold mb-3">¿Listo para tu próximo viaje?</h2>
        <p className="text-gray-400 mb-6">Hablá con nosotros y armamos el paquete perfecto para vos.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://wa.me/5491100000000?text=Hola!%20Quiero%20armar%20un%20viaje%20al%20Nordeste%20Brasilero"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-7 py-3 rounded-full transition-colors"
          >
            💬 WhatsApp
          </a>
          <a
            href="https://instagram.com/dreamstour"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-bold px-7 py-3 rounded-full transition-opacity"
          >
            📸 Instagram
          </a>
        </div>
      </div>
    </div>
  )
}
