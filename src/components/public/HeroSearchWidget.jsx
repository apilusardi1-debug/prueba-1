import { useState } from 'react'

const TABS = [
  { key: 'hotel',    label: 'Hotel' },
  { key: 'vuelo',    label: 'Vuelo' },
  { key: 'paseo',    label: 'Paseo' },
  { key: 'paquete',  label: 'Paquete' },
]

const FIELDS = [
  { key: 'ubicacion', icon: 'location_on',    label: 'Ubicación', placeholder: '¿A dónde vas?' },
  { key: 'checkin',   icon: 'calendar_today', label: 'Check in',  placeholder: 'Agregar fecha' },
  { key: 'checkout',  icon: 'calendar_today', label: 'Check out', placeholder: 'Agregar fecha' },
  { key: 'personas',  icon: 'group',          label: 'Personas',  placeholder: '¿Cuántos viajan?' },
]

// Widget visual — sin lógica de búsqueda real todavía.
export default function HeroSearchWidget() {
  const [tab, setTab] = useState('hotel')

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="inline-flex bg-hero-cream rounded-full p-1 shadow-lg relative z-10 mb-[-2px]">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-full font-label-lg text-label-sm uppercase tracking-wide transition-colors ${
              tab === t.key ? 'bg-hero-sky text-hero-navy' : 'text-hero-navy/60 hover:text-hero-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-hero-cream rounded-3xl md:rounded-full shadow-xl p-2 flex flex-col md:flex-row items-stretch md:items-center gap-1 overflow-hidden">
        {FIELDS.map((f, i) => (
          <div key={f.key} className="flex items-center gap-2 flex-1 min-w-0 px-4 py-2.5 md:border-r md:last-of-type:border-r-0 border-hero-navy/10">
            <span className="material-symbols-outlined text-hero-navy/50 text-[18px] flex-shrink-0">{f.icon}</span>
            <div className="min-w-0">
              <div className="font-label-sm text-[10px] uppercase tracking-wide text-hero-navy/50">{f.label}</div>
              <div className="font-body-md text-[14px] text-hero-navy/80 truncate">{f.placeholder}</div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="flex items-center justify-center gap-2 bg-hero-sky text-hero-navy font-label-lg text-label-sm uppercase px-6 py-3 rounded-full hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          Buscar
        </button>
      </div>
    </div>
  )
}
