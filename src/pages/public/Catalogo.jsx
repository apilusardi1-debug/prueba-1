import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function Catalogo({ categoria }) {
  const { t } = useLang()
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [destinoFiltro, setDestinoFiltro] = useState('')

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const { data, error } = await excursionesApi.getAll()
        if (!error && data) setExcursiones(data.map(normalizarExcursion))
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = excursiones.filter((ex) => {
    const matchCat = !categoria || ex.categoria === categoria
    const matchDest = !destinoFiltro || ex.destino === destinoFiltro
    const matchBusq = !busqueda || ex.nombre.toLowerCase().includes(busqueda.toLowerCase()) || ex.destino?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchDest && matchBusq
  })

  const destinosUnicos = [...new Set(excursiones.filter(e => !categoria || e.categoria === categoria).map(e => e.destino).filter(Boolean))]

  if (loading) return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#b07420', fontSize: '1rem', fontWeight: 600 }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-10">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>
            {categoria === 'paquetes' ? 'Paquetes aéreos' : categoria === 'excursiones' ? 'Excursiones' : 'Catálogo'}
          </p>
          <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2rem,4vw,3rem)', color: '#1C1208', lineHeight: 1.1, marginBottom: 8 }}>
            {t('catalog_title')}
          </h1>
          <p style={{ color: '#1C1208AA', fontSize: '1rem' }}>{t('catalog_subtitle')}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            placeholder={t('catalog_search')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1, border: '1.5px solid #e8d09a', borderRadius: 12, padding: '10px 16px', fontSize: '0.9rem', background: 'white', color: '#1C1208', outline: 'none' }}
            onFocus={e => e.target.style.borderColor='#b07420'}
            onBlur={e => e.target.style.borderColor='#e8d09a'}
          />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setDestinoFiltro('')}
              style={{ padding: '8px 18px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: !destinoFiltro ? '#1C1208' : 'white', color: !destinoFiltro ? '#f9f3e3' : '#1C1208AA', outline: '1.5px solid ' + (!destinoFiltro ? '#1C1208' : '#e8d09a') }}>
              {t('catalog_all')}
            </button>
            {destinosUnicos.map((d) => (
              <button key={d} onClick={() => setDestinoFiltro(d)}
                style={{ padding: '8px 18px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: destinoFiltro === d ? '#1C1208' : 'white', color: destinoFiltro === d ? '#f9f3e3' : '#1C1208AA', outline: '1.5px solid ' + (destinoFiltro === d ? '#1C1208' : '#e8d09a') }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-24" style={{ color: '#1C120866' }}>
            <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</p>
            <p style={{ fontSize: '1rem' }}>{t('catalog_empty')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtrados.map((ex) => (
              <div key={ex.id} className="flex flex-col overflow-hidden transition-all"
                style={{ background: 'white', borderRadius: 20, border: '1px solid #e8d09a' }}>
                <div className="relative overflow-hidden" style={{ height: 210 }}>
                  <img src={ex.imagen} alt={ex.nombre} className="w-full h-full object-cover" />
                  {ex.cuposDisponibles <= 3 && (
                    <span style={{ position: 'absolute', top: 12, right: 12, background: '#c0392b', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                      ¡Últimos {ex.cuposDisponibles}!
                    </span>
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: '#1C1208CC', color: '#f2e4c0', fontSize: '0.65rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {ex.destino}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.05rem', color: '#1C1208', marginBottom: 6 }}>{ex.nombre}</h3>
                  <p style={{ fontSize: '0.82rem', color: '#1C1208AA', marginBottom: 14, flex: 1, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ex.descripcion}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: '#1C120888', marginBottom: 16 }}>
                    <span>⏱ {ex.duracion}</span>
                    <span>·</span>
                    <span>👥 {ex.cuposDisponibles} {t('catalog_spots')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e8d09a', paddingTop: 14 }}>
                    <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.15rem', color: '#b07420' }}>{formatPrecio(ex.precio, ex.moneda)}</span>
                    <Link to={`/excursiones/${ex.id}`}
                      style={{ background: '#1C1208', color: '#f9f3e3', padding: '8px 18px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#b07420'}
                      onMouseLeave={e => e.currentTarget.style.background='#1C1208'}>
                      {t('catalog_see')}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
