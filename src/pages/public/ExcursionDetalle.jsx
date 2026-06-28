import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { excursionesApi, normalizarExcursion, reservasApi, vendedoresApi } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

const FORM_EMPTY = { fecha: '', nombre: '', telefono: '', adultos: 1, menores: 0, ubicacion: '', codigo_vendedor: '' }

export default function ExcursionDetalle() {
  const { id } = useParams()
  const { t } = useLang()
  const { config } = useSiteConfig()
  const [ex, setEx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_EMPTY)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState(null)
  const [vendedor, setVendedor] = useState(null)
  const [codigoError, setCodigoError] = useState('')
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        const { data, error } = await excursionesApi.getById(id)
        if (!error && data) setEx(normalizarExcursion(data))
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [id])

  function abrirModal() {
    setForm({ ...FORM_EMPTY, fecha: ex?.fechas?.[0] || '' })
    setExito(false)
    setError(null)
    setVendedor(null)
    setCodigoError('')
    setModal(true)
  }

  async function verificarCodigo() {
    if (!form.codigo_vendedor.trim()) return
    setVerificandoCodigo(true)
    setCodigoError('')
    const { data, error } = await vendedoresApi.getByCodigoReferido(form.codigo_vendedor.trim())
    if (error || !data) {
      setCodigoError('Código no válido')
      setVendedor(null)
    } else {
      setVendedor(data)
    }
    setVerificandoCodigo(false)
  }

  async function enviarReserva(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('Ingresá tu nombre.'); return }
    if (!form.telefono.trim()) { setError('Ingresá tu número de WhatsApp.'); return }
    if (!form.fecha) { setError('Seleccioná una fecha de salida.'); return }
    setEnviando(true)
    setError(null)
    try {
      const personas = (form.adultos || 0) + (form.menores || 0)
      const { error } = await reservasApi.create({
        excursion_id: ex.id,
        fecha: form.fecha,
        cliente_nombre: form.nombre.trim(),
        cliente_whatsapp: form.telefono.trim().replace(/\D/g, ''),
        adultos: form.adultos,
        menores: form.menores,
        personas,
        ubicacion: form.ubicacion.trim() || null,
        hospedaje: form.ubicacion.trim() || null,
        estado: 'pendiente',
        vendedor_id: vendedor?.id || null,
        vendedor_codigo: vendedor ? form.codigo_vendedor.toUpperCase() : null,
      })
      if (error) throw error
      setExito(true)
    } catch (err) {
      setError('Error: ' + (err?.message || 'Intentá de nuevo.'))
    }
    setEnviando(false)
  }

  if (loading) return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#b07420', fontWeight: 600 }}>Cargando...</p>
    </div>
  )

  if (!ex) return (
    <div style={{ textAlign: 'center', padding: '96px 16px', color: '#1C120899' }}>
      <p style={{ fontSize: '3rem', marginBottom: 12 }}>🗺️</p>
      <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Excursión no encontrada</p>
      <Link to="/excursiones" style={{ marginTop: 16, display: 'inline-block', color: '#b07420', textDecoration: 'none', fontWeight: 600 }}>
        ← Volver
      </Link>
    </div>
  )

  const backTo = ex.categoria === 'paquetes' ? '/paquetes' : ex.categoria === 'traslados' ? '/traslados' : '/excursiones'

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to={backTo} style={{ fontSize: '0.82rem', color: '#b07420', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          ← {t('detail_back')}
        </Link>

        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <div style={{ borderRadius: 20, overflow: 'hidden', height: 320 }}>
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-full object-cover" />
            </div>
            {ex.incluye?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('detail_includes')}</p>
                <div className="flex flex-wrap gap-2">
                  {ex.incluye.map((item) => (
                    <span key={item} style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: '1px solid #a5d6a7' }}>
                      ✓ {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b07420', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>{ex.destino}</p>
            <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: '#1C1208', lineHeight: 1.1, marginBottom: 12 }}>{ex.nombre}</h1>
            <p style={{ color: '#1C1208AA', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: 24 }}>{ex.descripcion}</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: t('detail_duration'), value: `⏱ ${ex.duracion}` },
                { label: t('detail_difficulty'), value: `🎯 ${ex.dificultad}` },
                { label: t('detail_spots'), value: `👥 ${ex.cuposDisponibles} / ${ex.cupos}`, red: ex.cuposDisponibles <= 3 },
                { label: t('detail_category'), value: `🏷️ ${ex.categoria}` },
              ].map(({ label, value, red }) => (
                <div key={label} style={{ background: 'white', border: '1px solid #e8d09a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.65rem', color: '#1C120888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', color: red ? '#c0392b' : '#1C1208' }}>{value}</p>
                </div>
              ))}
            </div>

            {ex.fechas?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('detail_next_dates')}</p>
                <div className="flex flex-wrap gap-2">
                  {ex.fechas.map((f) => (
                    <span key={f} style={{ background: 'white', border: '1px solid #d9a83a', color: '#8a581e', fontSize: '0.82rem', fontWeight: 600, padding: '6px 14px', borderRadius: 10 }}>
                      {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e8d09a', paddingTop: 24 }}>
              <div>
                <p style={{ fontSize: '0.7rem', color: '#1C120888', marginBottom: 4 }}>{t('detail_per_person')}</p>
                <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '2rem', color: '#b07420', lineHeight: 1 }}>{formatPrecio(ex.precio, 'USD')}</p>
              </div>
              <button
                onClick={abrirModal}
                style={{ background: '#1C1208', color: '#f9f3e3', fontWeight: 700, padding: '14px 32px', borderRadius: 14, border: 'none', fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background='#b07420'}
                onMouseLeave={e => e.currentTarget.style.background='#1C1208'}
              >
                {t('detail_book')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de reserva */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(28,18,8,0.6)' }} onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#f9f3e3' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ background: '#1C1208', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.65rem', color: '#d9a83a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>{ex.destino}</p>
                <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.15rem', color: '#f9f3e3', lineHeight: 1.2 }}>{ex.nombre}</h2>
              </div>
              <button onClick={() => setModal(false)} style={{ color: '#f9f3e3aa', fontSize: '1.4rem', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
              {exito ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</p>
                  <h3 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.3rem', color: '#1C1208', marginBottom: 8 }}>¡Solicitud enviada!</h3>
                  <p style={{ color: '#1C1208AA', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.6 }}>
                    Nuestro equipo te va a contactar por WhatsApp a la brevedad para confirmar tu reserva.
                  </p>
                  <a
                    href={`https://wa.me/${config.whatsapp}?text=Hola!%20Acabo%20de%20solicitar%20reserva%20para%20${encodeURIComponent(ex.nombre)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25d366', color: 'white', fontWeight: 700, padding: '12px 28px', borderRadius: 12, textDecoration: 'none', fontSize: '0.9rem' }}
                  >
                    💬 Confirmar por WhatsApp
                  </a>
                </div>
              ) : (
                <form onSubmit={enviarReserva} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {error && <p style={{ background: '#fde8e8', color: '#c0392b', fontSize: '0.82rem', padding: '10px 14px', borderRadius: 10 }}>{error}</p>}

                  {/* Fecha */}
                  {ex.fechas?.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Fecha de salida
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {ex.fechas.map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, fecha: f }))}
                            style={{
                              padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s',
                              background: form.fecha === f ? '#1C1208' : 'white',
                              color: form.fecha === f ? '#f9f3e3' : '#8a581e',
                              border: `1.5px solid ${form.fecha === f ? '#1C1208' : '#d9a83a'}`,
                            }}
                          >
                            {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nombre */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: María García"
                      style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', background: 'white', color: '#1C1208', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor='#b07420'}
                      onBlur={e => e.target.style.borderColor='#e8d09a'}
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Número de WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                      placeholder="Ej: 1145678901"
                      style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', background: 'white', color: '#1C1208', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor='#b07420'}
                      onBlur={e => e.target.style.borderColor='#e8d09a'}
                    />
                  </div>

                  {/* Personas */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Cantidad de personas
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { key: 'adultos', label: 'Adultos', icon: '👤' },
                        { key: 'menores', label: 'Menores', icon: '👶' },
                      ].map(({ key, label, icon }) => (
                        <div key={key} style={{ background: 'white', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', color: '#1C1208AA', fontWeight: 600 }}>{icon} {label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button type="button" onClick={() => setForm(p => ({ ...p, [key]: Math.max(key === 'adultos' ? 1 : 0, p[key] - 1) }))}
                              style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px solid #e8d09a', background: 'white', color: '#1C1208', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1C1208', minWidth: 16, textAlign: 'center' }}>{form[key]}</span>
                            <button type="button" onClick={() => setForm(p => ({ ...p, [key]: p[key] + 1 }))}
                              style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px solid #e8d09a', background: 'white', color: '#1C1208', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ubicación */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      ¿Dónde te pasamos a buscar?
                    </label>
                    <input
                      type="text"
                      value={form.ubicacion}
                      onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))}
                      placeholder="Ej: Hotel Viva, Av. Beira Mar 1200"
                      style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', background: 'white', color: '#1C1208', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor='#b07420'}
                      onBlur={e => e.target.style.borderColor='#e8d09a'}
                    />
                  </div>

                  {/* Código de vendedor */}
                  <div style={{ borderTop: '1px solid #e8d09a', paddingTop: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Código de vendedor <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.7rem', color: '#1C120888' }}>(opcional)</span>
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={form.codigo_vendedor}
                        onChange={e => {
                          setForm(p => ({ ...p, codigo_vendedor: e.target.value.toUpperCase() }))
                          setVendedor(null)
                          setCodigoError('')
                        }}
                        placeholder="Ej: JUAN01"
                        maxLength={20}
                        style={{
                          flex: 1, border: `1.5px solid ${vendedor ? '#25d366' : codigoError ? '#e74c3c' : '#e8d09a'}`,
                          borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem',
                          background: vendedor ? '#f0fdf4' : 'white', color: '#1C1208',
                          outline: 'none', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={verificarCodigo}
                        disabled={!form.codigo_vendedor.trim() || verificandoCodigo}
                        style={{
                          background: '#1C1208', color: '#f9f3e3', fontWeight: 700,
                          padding: '10px 18px', borderRadius: 10, border: 'none',
                          fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
                          opacity: (!form.codigo_vendedor.trim() || verificandoCodigo) ? 0.4 : 1,
                        }}
                      >
                        {verificandoCodigo ? '...' : 'Verificar'}
                      </button>
                    </div>
                    {vendedor && (
                      <p style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, marginTop: 6 }}>
                        ✓ Código válido — {vendedor.nombre}
                      </p>
                    )}
                    {codigoError && (
                      <p style={{ fontSize: '0.78rem', color: '#e74c3c', marginTop: 6 }}>{codigoError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={enviando}
                    style={{ width: '100%', background: '#1C1208', color: '#f9f3e3', fontWeight: 700, padding: '14px', borderRadius: 12, border: 'none', fontSize: '0.95rem', cursor: 'pointer', marginTop: 4, opacity: enviando ? 0.6 : 1, transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!enviando) e.currentTarget.style.background='#b07420' }}
                    onMouseLeave={e => { if (!enviando) e.currentTarget.style.background='#1C1208' }}
                  >
                    {enviando ? 'Enviando...' : 'Solicitar reserva 🎉'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
