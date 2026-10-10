import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { excursionesApi, normalizarExcursion, reservasApi, vendedoresApi } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

const FORM_EMPTY = { fecha: '', nombre: '', telefono: '', adultos: 1, menores: 0, ubicacion: '', codigo_vendedor: '' }

// `categoria` es el valor crudo de la base ('excursiones', 'paquetes',
// 'traslados') — acá se traduce a lo que ve el cliente ("Excursiones" ahora
// se llama "Paseos" en todo el sitio).
const CATEGORIA_LABEL = { excursiones: 'Paseos', paquetes: 'Paquetes', traslados: 'Traslados' }

// No todos los paseos se cobran por persona (ej. Buggy/Jet Ski/Quad son por
// vehículo, con varias personas incluidas) — `precioUnidad` viene de la base
// y se traduce acá a la leyenda que va arriba del precio.
const UNIDAD_PRECIO_LABEL = {
  persona: 'Precio por persona',
  paseo:   'Precio por paseo',
  sesion:  'Precio por sesión',
  sesión:  'Precio por sesión',
  traslado: 'Precio por traslado',
}

function IconoCheck() {
  return (
    <svg className="w-4 h-4 text-hero-navy flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Estilo compartido por todos los campos de texto/número del modal de
// reserva — así quedan todos iguales sin repetir la clase larga en cada uno.
const CAMPO = 'w-full border-2 border-hero-navy/15 focus:border-hero-navy rounded-xl px-4 py-2.5 font-body-md text-body-md text-hero-navy bg-white outline-none transition-colors'
const LABEL = 'block font-label-lg text-label-sm uppercase text-hero-navy/80 mb-1.5'

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
      const { error } = await reservasApi.crearPublica({
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

  if (loading) {
    return (
      <div className="bg-surface min-h-screen pt-32 flex justify-center">
        <div className="w-8 h-8 border-4 border-hero-navy/20 border-t-hero-navy rounded-full animate-spin" />
      </div>
    )
  }

  if (!ex) {
    return (
      <div className="bg-surface min-h-screen pt-32 px-margin-mobile text-center">
        <p className="font-display-hero uppercase text-hero-navy text-2xl mb-4">Paseo no encontrado</p>
        <Link to="/excursiones" className="font-label-lg text-label-sm uppercase text-hero-navy underline">{t('detail_back')}</Link>
      </div>
    )
  }

  const backTo = ex.categoria === 'paquetes' ? '/paquetes' : ex.categoria === 'traslados' ? '/traslados' : '/excursiones'
  const metaCards = [
    { label: t('detail_duration'), value: ex.duracion, icon: 'schedule' },
    { label: t('detail_difficulty'), value: ex.dificultad, icon: 'flag' },
    // Los paseos (categoria "excursiones") no muestran cupos — pedido explícito
    ...(ex.categoria !== 'excursiones' ? [{ label: t('detail_spots'), value: `${ex.cuposDisponibles} / ${ex.cupos}`, icon: 'group', red: ex.cuposDisponibles <= 3 }] : []),
    { label: t('detail_category'), value: CATEGORIA_LABEL[ex.categoria] || ex.categoria, icon: 'sell' },
  ].filter(m => m.value)

  return (
    <div className="bg-surface min-h-screen">
      <div className="pt-24 md:pt-28 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Link to={backTo} className="inline-flex items-center gap-1.5 font-label-lg text-label-sm uppercase text-hero-navy/70 hover:text-hero-navy mb-6">
          {t('detail_back')}
        </Link>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Foto + incluye */}
          <div>
            <div className="rounded-2xl overflow-hidden bg-surface-variant h-72 md:h-96">
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-full object-cover" />
            </div>
            {ex.incluye?.length > 0 && (
              <div className="mt-6">
                <p className="font-label-lg text-label-sm uppercase text-on-surface-variant mb-3">{t('detail_includes')}</p>
                <div className="grid gap-y-2.5 gap-x-4 sm:grid-cols-2">
                  {ex.incluye.map(item => (
                    <div key={item} className="flex items-center gap-2 font-body-md text-body-md text-deep-ocean">
                      <IconoCheck /> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {ex.destino && (
              <span className="inline-block font-label-lg text-label-sm uppercase bg-hero-cream text-hero-navy px-3 py-1 rounded-full mb-3">
                {ex.destino}
              </span>
            )}
            <h1 className="font-display-hero uppercase text-hero-navy leading-none mb-3"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', letterSpacing: '0.01em' }}>
              {ex.nombre}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-6">{ex.descripcion}</p>

            {metaCards.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {metaCards.map(({ label, value, icon, red }) => (
                  <div key={label} className="bg-white border-2 border-hero-navy/10 rounded-xl px-4 py-3 text-center">
                    <p className="font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">{label}</p>
                    <p className={`font-label-lg text-[14px] flex items-center justify-center gap-1.5 ${red ? 'text-red-600' : 'text-hero-navy'}`}>
                      <span className="material-symbols-outlined text-[16px]">{icon}</span>{value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {ex.fechas?.length > 0 && (
              <div className="mb-7">
                <p className="font-label-lg text-label-sm uppercase text-on-surface-variant mb-3">{t('detail_next_dates')}</p>
                <div className="flex flex-wrap gap-2">
                  {ex.fechas.map(f => (
                    <span key={f} className="bg-hero-cream text-hero-navy font-label-lg text-[13px] font-semibold px-3.5 py-1.5 rounded-lg">
                      {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t-2 border-hero-navy/10 pt-6">
              <div>
                <p className="font-label-sm text-[11px] uppercase text-on-surface-variant mb-1">{UNIDAD_PRECIO_LABEL[ex.precioUnidad] || t('detail_per_person')}</p>
                <p className="font-display-hero text-hero-navy leading-none" style={{ fontSize: '2rem' }}>{formatPrecio(ex.precio, ex.moneda)}</p>
              </div>
              <button onClick={abrirModal}
                className="bg-hero-navy hover:bg-deep-ocean text-white font-label-lg text-label-lg uppercase px-8 py-3.5 rounded-full transition-colors">
                {t('detail_book')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-16" />

      {/* Modal de reserva */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-hero-navy/70 backdrop-blur-sm" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-surface" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-hero-navy px-6 py-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                {ex.destino && (
                  <p className="font-label-sm text-[11px] uppercase tracking-widest text-hero-yellow mb-1">{ex.destino}</p>
                )}
                <h2 className="font-display-hero uppercase text-hero-cream text-lg leading-tight truncate">{ex.nombre}</h2>
              </div>
              <button onClick={() => setModal(false)} className="text-hero-cream/60 hover:text-hero-cream text-2xl leading-none flex-shrink-0">✕</button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {exito ? (
                <div className="text-center py-5">
                  <p className="text-5xl mb-3">🎉</p>
                  <h3 className="font-display-hero uppercase text-hero-navy text-xl mb-2">¡Solicitud enviada!</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed">
                    Nuestro equipo te va a contactar por WhatsApp a la brevedad para confirmar tu reserva.
                  </p>
                  <a
                    href={`https://wa.me/${config.whatsapp}?text=Hola!%20Acabo%20de%20solicitar%20reserva%20para%20${encodeURIComponent(ex.nombre)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#25d366] text-white font-label-lg text-label-lg uppercase px-7 py-3 rounded-full"
                  >
                    💬 Confirmar por WhatsApp
                  </a>
                </div>
              ) : (
                <form onSubmit={enviarReserva} className="flex flex-col gap-4">
                  {error && <p className="bg-red-50 text-red-600 font-body-md text-[13px] px-3.5 py-2.5 rounded-lg">{error}</p>}

                  {/* Fecha: si el paseo tiene salidas fijas (los paquetes aéreos)
                      se elige entre esas; si no (la mayoría de las experiencias, que
                      se coordinan por WhatsApp para cualquier día) se ingresa una
                      fecha libre. Sin esto, un paseo sin `fechas` cargadas no tenía
                      forma de completar este campo obligatorio del formulario. */}
                  {ex.fechas?.length > 0 ? (
                    <div>
                      <label className={LABEL}>Fecha de salida</label>
                      <div className="flex flex-wrap gap-2">
                        {ex.fechas.map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, fecha: f }))}
                            className={`px-4 py-2 rounded-lg font-label-lg text-[13px] font-semibold border-2 transition-colors ${
                              form.fecha === f ? 'bg-hero-navy border-hero-navy text-hero-cream' : 'bg-white border-hero-navy/15 text-hero-navy hover:border-hero-navy'
                            }`}
                          >
                            {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className={LABEL}>Fecha de salida *</label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().slice(0, 10)}
                        value={form.fecha}
                        onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                        className={CAMPO}
                      />
                    </div>
                  )}

                  <div>
                    <label className={LABEL}>Nombre completo *</label>
                    <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: María García" className={CAMPO} />
                  </div>

                  <div>
                    <label className={LABEL}>Número de WhatsApp *</label>
                    <input type="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                      placeholder="Ej: 1145678901" className={CAMPO} />
                  </div>

                  <div>
                    <label className={LABEL}>Cantidad de personas</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { key: 'adultos', label: 'Adultos' },
                        { key: 'menores', label: 'Menores' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between bg-white border-2 border-hero-navy/15 rounded-xl px-3.5 py-2.5">
                          <span className="font-body-md text-[13px] text-on-surface-variant font-medium">{label}</span>
                          <div className="flex items-center gap-2.5">
                            <button type="button" onClick={() => setForm(p => ({ ...p, [key]: Math.max(key === 'adultos' ? 1 : 0, p[key] - 1) }))}
                              className="w-7 h-7 rounded-full border-2 border-hero-navy/20 text-hero-navy font-bold flex items-center justify-center hover:border-hero-navy transition-colors">−</button>
                            <span className="font-label-lg text-[14px] text-hero-navy min-w-[16px] text-center">{form[key]}</span>
                            <button type="button" onClick={() => setForm(p => ({ ...p, [key]: p[key] + 1 }))}
                              className="w-7 h-7 rounded-full border-2 border-hero-navy/20 text-hero-navy font-bold flex items-center justify-center hover:border-hero-navy transition-colors">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>¿Dónde te pasamos a buscar?</label>
                    <input type="text" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))}
                      placeholder="Ej: Hotel Viva, Av. Beira Mar 1200" className={CAMPO} />
                  </div>

                  <div className="border-t-2 border-hero-navy/10 pt-4">
                    <label className={LABEL}>Código de vendedor <span className="normal-case font-normal text-on-surface-variant/70 text-[11px]">(opcional)</span></label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.codigo_vendedor}
                        onChange={e => { setForm(p => ({ ...p, codigo_vendedor: e.target.value.toUpperCase() })); setVendedor(null); setCodigoError('') }}
                        placeholder="Ej: JUAN01" maxLength={20}
                        className={`flex-1 border-2 rounded-xl px-4 py-2.5 font-mono text-[14px] tracking-wider uppercase outline-none transition-colors ${
                          vendedor ? 'border-green-500 bg-green-50' : codigoError ? 'border-red-400' : 'border-hero-navy/15 focus:border-hero-navy bg-white'
                        } text-hero-navy`}
                      />
                      <button type="button" onClick={verificarCodigo} disabled={!form.codigo_vendedor.trim() || verificandoCodigo}
                        className="bg-hero-navy text-hero-cream font-label-lg text-[13px] uppercase px-4 py-2.5 rounded-xl whitespace-nowrap disabled:opacity-40">
                        {verificandoCodigo ? '...' : 'Verificar'}
                      </button>
                    </div>
                    {vendedor && <p className="font-body-md text-[13px] text-green-600 font-semibold mt-1.5">✓ Código válido — {vendedor.nombre}</p>}
                    {codigoError && <p className="font-body-md text-[13px] text-red-500 mt-1.5">{codigoError}</p>}
                  </div>

                  <button type="submit" disabled={enviando}
                    className="w-full bg-hero-navy hover:bg-deep-ocean text-hero-cream font-label-lg text-label-lg uppercase py-3.5 rounded-full mt-1 transition-colors disabled:opacity-60">
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
