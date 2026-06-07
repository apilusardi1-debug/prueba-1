import { useState } from 'react'
import { useLang } from '../../context/LanguageContext.jsx'

const destinos = ['Porto de Galinhas', 'Maragogi', 'Maceió', 'Pipa', 'Natal', 'Fernando de Noronha']

// Genera datos de marea de ejemplo para los próximos 7 días
function generarMarea(destino) {
  const hoy = new Date()
  const dias = []
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() + i)
    // Simula 4 eventos de marea por día (2 altas, 2 bajas)
    const base = (i * 47 + destino.length * 13) % 60
    dias.push({
      fecha,
      mareas: [
        { hora: `${String(4 + (base % 3)).padStart(2,'0')}:${String(base % 60).padStart(2,'0')}`, tipo: 'alta', altura: (1.2 + Math.sin(i) * 0.4).toFixed(2) },
        { hora: `${String(10 + (base % 2)).padStart(2,'0')}:${String((base + 30) % 60).padStart(2,'0')}`, tipo: 'baja', altura: (0.3 + Math.sin(i + 1) * 0.2).toFixed(2) },
        { hora: `${String(16 + (base % 3)).padStart(2,'0')}:${String((base + 15) % 60).padStart(2,'0')}`, tipo: 'alta', altura: (1.1 + Math.sin(i + 2) * 0.5).toFixed(2) },
        { hora: `${String(22 + (base % 2)).padStart(2,'0')}:${String((base + 45) % 60).padStart(2,'0')}`, tipo: 'baja', altura: (0.2 + Math.sin(i + 3) * 0.15).toFixed(2) },
      ],
    })
  }
  return dias
}

export default function Marea() {
  const { t } = useLang()
  const [destinoSel, setDestinoSel] = useState(destinos[0])
  const mareas = generarMarea(destinoSel)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">{t('tides_title')}</h1>
      <p className="text-gray-500 mb-8">{t('tides_subtitle')}</p>

      {/* Selector de destino */}
      <div className="flex flex-wrap gap-2 mb-8">
        {destinos.map((d) => (
          <button
            key={d}
            onClick={() => setDestinoSel(d)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${destinoSel === d ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="space-y-4">
        {mareas.map(({ fecha, mareas: eventos }) => {
          const esHoy = fecha.toDateString() === new Date().toDateString()
          return (
            <div key={fecha.toISOString()} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${esHoy ? 'border-brand-300 ring-1 ring-brand-200' : 'border-gray-100'}`}>
              <div className={`px-5 py-3 flex items-center gap-2 ${esHoy ? 'bg-brand-50' : 'bg-gray-50'}`}>
                <p className="font-semibold text-gray-800">
                  {fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {esHoy && <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full font-medium">Hoy</span>}
              </div>
              <div className="grid grid-cols-4 divide-x divide-gray-100">
                {eventos.map((e, i) => (
                  <div key={i} className="px-4 py-4 text-center">
                    <p className={`text-lg font-bold mb-1 ${e.tipo === 'alta' ? 'text-blue-600' : 'text-orange-500'}`}>
                      {e.tipo === 'alta' ? '🌊' : '🏖️'}
                    </p>
                    <p className="font-bold text-gray-800 text-sm">{e.hora}</p>
                    <p className={`text-xs font-medium capitalize ${e.tipo === 'alta' ? 'text-blue-500' : 'text-orange-400'}`}>
                      {e.tipo === 'alta' ? 'Alta' : 'Baja'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{e.altura}m</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        * Datos orientativos. Para excursiones acuáticas, consultá con tu guía local.
      </p>
    </div>
  )
}
