import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSeleccionPaseos } from '../../context/SeleccionPaseosContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { formatPrecio } from '../../data/mockData.js'
import { armarMensajePedidoWeb } from '../../../supabase/functions/_shared/pedidoWebPaseos.ts'
import { BTN_PRINCIPAL, BTN_ELEGIDO } from './botones.js'

// Panel "Mi selección" + botón flotante que lo abre. La reserva de paseos no
// se cierra en el sitio: el cliente elige paseos, fechas de estadía y
// pasajeros, y se le abre WhatsApp con el mensaje ya armado para la agencia.
// El formato del mensaje vive en _shared/pedidoWebPaseos.ts: el CRM lo reconoce
// y completa el lead solo (paseos, destino, vendedor).
// No hay total: algunos paseos se cobran por persona y otros por vehículo o
// sesión, y el precio de los menores varía — un total estimado saldría mal.

const UNIDAD_PRECIO_LABEL = {
  persona:  '/ persona',
  paseo:    '/ paseo',
  sesion:   '/ sesión',
  sesión:   '/ sesión',
  traslado: '/ traslado',
}

const CAMPO = 'w-full border-2 border-hero-navy/15 focus:border-hero-navy rounded-xl px-3 py-2.5 font-body-md text-body-md text-hero-navy bg-white outline-none transition-colors'
const LABEL = 'block font-label-lg text-label-sm uppercase text-hero-navy/80 mb-1.5'

const hoy = () => new Date().toISOString().slice(0, 10)

export function Contador({ label, valor, min, onChange }) {
  return (
    <div className="flex items-center justify-between bg-white border-2 border-hero-navy/15 rounded-xl px-3.5 py-2.5">
      <span className="font-body-md text-[13px] text-on-surface-variant font-medium">{label}</span>
      <div className="flex items-center gap-2.5">
        <button type="button" aria-label={`Restar ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, valor - 1))}
          className="w-7 h-7 rounded-full border-2 border-hero-navy/20 text-hero-navy font-bold flex items-center justify-center hover:border-hero-navy transition-colors">−</button>
        <span className="font-label-lg text-[14px] text-hero-navy min-w-[16px] text-center">{valor}</span>
        <button type="button" aria-label={`Sumar ${label.toLowerCase()}`} onClick={() => onChange(Math.min(30, valor + 1))}
          className="w-7 h-7 rounded-full border-2 border-hero-navy/20 text-hero-navy font-bold flex items-center justify-center hover:border-hero-navy transition-colors">+</button>
      </div>
    </div>
  )
}

export default function SeleccionPaseos() {
  const { paseos, quitar, abierta, abrir, cerrar } = useSeleccionPaseos()
  const { config } = useSiteConfig()
  const { pathname } = useLocation()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [adultos, setAdultos] = useState(2)
  const [edades, setEdades] = useState([])
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)

  // Escape cierra el panel; mientras está abierto, la página de atrás no scrollea
  useEffect(() => {
    if (!abierta) return
    const onKey = (e) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', onKey)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierta])

  useEffect(() => { cerrar() }, [pathname])

  // El aviso de error se va apenas el cliente corrige lo que faltaba
  useEffect(() => { setError(null) }, [desde, hasta, edades])

  function cambiarMenores(n) {
    setEdades(prev => n > prev.length ? [...prev, ...Array(n - prev.length).fill('')] : prev.slice(0, n))
  }

  function enviar() {
    if (!desde || !hasta) { setError('Indicá las fechas de tu estadía.'); return }
    if (hasta < desde) { setError('La fecha de salida tiene que ser posterior a la de llegada.'); return }
    if (edades.some(e => e === '')) { setError('Indicá la edad de cada menor.'); return }
    setError(null)
    const texto = armarMensajePedidoWeb({ paseos, desde, hasta, adultos, edadesMenores: edades, codigoVendedor: codigo.trim() })
    window.open(`https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  const cantidad = paseos.length

  return (
    <>
      {/* Botón flotante: en celular va arriba de la barra de navegación de abajo */}
      {cantidad > 0 && !abierta && (
        <button onClick={abrir}
          className="fixed z-40 right-4 bottom-20 md:bottom-6 md:right-6 flex items-center gap-3 bg-hero-navy text-hero-cream pl-3 pr-5 py-2.5 rounded-full shadow-[0_8px_24px_rgba(7,46,64,0.35)] hover:bg-deep-ocean transition-colors">
          <span className="relative w-9 h-9 rounded-full bg-hero-yellow text-hero-navy flex items-center justify-center">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">beach_access</span>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[12px] font-bold flex items-center justify-center">{cantidad}</span>
          </span>
          <span className="font-label-lg text-label-sm uppercase">Mi selección</span>
        </button>
      )}

      {abierta && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-hero-navy/60 backdrop-blur-sm" onClick={cerrar}>
          <aside role="dialog" aria-modal="true" aria-label="Mi selección de paseos"
            className="w-full max-w-md h-full bg-surface flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="bg-hero-navy px-6 py-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-label-sm text-[12px] uppercase tracking-widest text-hero-yellow mb-1">Tu viaje</p>
                <h2 className="font-display-hero uppercase text-hero-cream text-2xl leading-none">Mi selección</h2>
              </div>
              <button onClick={cerrar} aria-label="Cerrar" className="text-hero-cream/75 hover:text-hero-cream text-2xl leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {cantidad === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant text-center py-10">
                  Todavía no agregaste paseos. Elegí los que te interesan desde el catálogo.
                </p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2.5">
                    {paseos.map(p => (
                      <li key={p.id} className="flex items-center gap-3 bg-white border-2 border-hero-navy/10 rounded-xl p-2.5">
                        {p.imagen && <img src={p.imagen} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-label-lg text-[14px] text-hero-navy leading-tight truncate">{p.nombre}</p>
                          <p className="font-body-md text-[13px] text-on-surface-variant">
                            {formatPrecio(p.precio, p.moneda)} {UNIDAD_PRECIO_LABEL[p.precioUnidad] || ''}
                          </p>
                        </div>
                        <button onClick={() => quitar(p.id)} aria-label={`Quitar ${p.nombre}`}
                          className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0">✕</button>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <p className={LABEL}>Fechas de tu estadía</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block">
                        <span className="block font-body-md text-[13px] text-on-surface-variant mb-1">Llegada</span>
                        <input type="date" min={hoy()} value={desde}
                          onChange={e => { setDesde(e.target.value); if (hasta && e.target.value > hasta) setHasta('') }}
                          className={CAMPO} />
                      </label>
                      <label className="block">
                        <span className="block font-body-md text-[13px] text-on-surface-variant mb-1">Salida</span>
                        <input type="date" min={desde || hoy()} value={hasta} onChange={e => setHasta(e.target.value)} className={CAMPO} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className={LABEL}>Pasajeros</p>
                    <div className="flex flex-col gap-2.5">
                      <Contador label="Adultos" valor={adultos} min={1} onChange={setAdultos} />
                      <Contador label="Menores" valor={edades.length} min={0} onChange={cambiarMenores} />
                    </div>
                    {edades.length > 0 && (
                      <div className="mt-3">
                        <span className="block font-body-md text-[13px] text-on-surface-variant mb-1.5">Edad de cada menor</span>
                        <div className="grid grid-cols-4 gap-2">
                          {edades.map((edad, i) => (
                            <select key={i} value={edad} aria-label={`Edad del menor ${i + 1}`}
                              onChange={e => setEdades(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                              className={CAMPO + ' px-2'}>
                              <option value="">—</option>
                              {Array.from({ length: 18 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={LABEL}>
                      Código de vendedor <span className="normal-case font-normal text-on-surface-variant text-[12px]">(opcional)</span>
                    </label>
                    <input type="text" value={codigo} maxLength={20} placeholder="Ej: JUAN01"
                      onChange={e => setCodigo(e.target.value.toUpperCase())}
                      className={CAMPO + ' font-mono tracking-wider uppercase'} />
                  </div>
                </>
              )}
            </div>

            {cantidad > 0 && (
              <div className="border-t-2 border-hero-navy/10 px-6 py-4 bg-white">
                {error && <p className="bg-red-50 text-red-600 font-body-md text-[13px] px-3.5 py-2.5 rounded-lg mb-3">{error}</p>}
                <button onClick={enviar}
                  className={`${BTN_PRINCIPAL} w-full`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chat</span>
                  Enviar por WhatsApp
                </button>
                <p className="font-body-md text-[13px] text-on-surface-variant text-center mt-2.5">
                  Te respondemos por WhatsApp con disponibilidad y precio final.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  )
}

// Botón de agregar/quitar un paseo, compartido por el catálogo y el detalle
export function BotonAgregarPaseo({ ex, className = '' }) {
  const { tiene, agregar, quitar } = useSeleccionPaseos()
  const agregado = tiene(ex.id)
  return (
    <button type="button" onClick={() => agregado ? quitar(ex.id) : agregar(ex)} aria-pressed={agregado}
      className={`${agregado ? BTN_ELEGIDO : BTN_PRINCIPAL} ${className}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{agregado ? 'check' : 'add'}</span>
      {agregado ? 'Agregado' : 'Agregar a mi selección'}
    </button>
  )
}
