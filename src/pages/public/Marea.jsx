import { useState } from 'react'
import { useLang } from '../../context/LanguageContext.jsx'

const destinos = ['Porto de Galinhas', 'Maragogi', 'Maceió', 'Pipa', 'Natal', 'Fernando de Noronha']

function generarMarea(destino) {
  const hoy = new Date()
  const dias = []
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() + i)
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
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>Condiciones</p>
          <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2rem,4vw,3rem)', color: '#1C1208', lineHeight: 1.1, marginBottom: 8 }}>
            {t('tides_title')}
          </h1>
          <p style={{ color: '#1C1208AA', fontSize: '1rem' }}>{t('tides_subtitle')}</p>
        </div>

        {/* Selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {destinos.map((d) => (
            <button
              key={d}
              onClick={() => setDestinoSel(d)}
              style={{
                padding: '8px 18px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: destinoSel === d ? '#1C1208' : 'white',
                color: destinoSel === d ? '#f9f3e3' : '#1C1208AA',
                outline: '1.5px solid ' + (destinoSel === d ? '#1C1208' : '#e8d09a')
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="space-y-3">
          {mareas.map(({ fecha, mareas: eventos }) => {
            const esHoy = fecha.toDateString() === new Date().toDateString()
            return (
              <div
                key={fecha.toISOString()}
                style={{
                  background: esHoy ? 'white' : 'white',
                  borderRadius: 16,
                  border: esHoy ? '2px solid #d9a83a' : '1px solid #e8d09a',
                  overflow: 'hidden',
                  boxShadow: esHoy ? '0 4px 16px rgba(176,116,32,0.12)' : 'none'
                }}
              >
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, background: esHoy ? '#fdf8ee' : '#f9f3e3', borderBottom: '1px solid #e8d09a' }}>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C1208', fontSize: '0.95rem', textTransform: 'capitalize' }}>
                    {fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {esHoy && (
                    <span style={{ fontSize: '0.65rem', background: '#b07420', color: '#f9f3e3', padding: '3px 10px', borderRadius: 999, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Hoy
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: 'none' }}>
                  {eventos.map((e, i) => (
                    <div key={i} style={{ padding: '16px 12px', textAlign: 'center', borderRight: i < 3 ? '1px solid #f2e4c0' : 'none' }}>
                      <p style={{ fontSize: '1.4rem', lineHeight: 1, marginBottom: 6 }}>
                        {e.tipo === 'alta' ? '🌊' : '🏖️'}
                      </p>
                      <p style={{ fontWeight: 700, color: '#1C1208', fontSize: '0.9rem', marginBottom: 2 }}>{e.hora}</p>
                      <p style={{ fontSize: '0.7rem', fontWeight: 600, color: e.tipo === 'alta' ? '#2563eb' : '#b07420', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {e.tipo === 'alta' ? 'Alta' : 'Baja'}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#1C120888', marginTop: 2 }}>{e.altura}m</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: '0.75rem', color: '#1C120866', textAlign: 'center', marginTop: 24 }}>
          * Datos orientativos. Para excursiones acuáticas, consultá con tu guía local.
        </p>
      </div>
    </div>
  )
}
