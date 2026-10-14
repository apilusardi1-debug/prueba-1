import { useEffect, useState } from 'react'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { Contador } from './SeleccionPaseos.jsx'
import {
  DESTINOS_PAQUETE, HOSPEDAJES_PAQUETE, PAISES_PAQUETE, armarMensajePedidoPaquete, nochesEntre,
} from '../../../supabase/functions/_shared/pedidoWebPaquete.ts'

// "Armar mi paquete": los mismos datos que pide el formulario del asistente por
// WhatsApp. Al enviar se abre WhatsApp con el mensaje armado; el CRM lo reconoce
// (_shared/pedidoWebPaquete.ts) y el lead entra al embudo de Paquetes ya filtrado.

const CAMPO = 'w-full border-2 border-hero-navy/15 focus:border-hero-navy rounded-xl px-3 py-2.5 font-body-md text-body-md text-hero-navy bg-white outline-none transition-colors'
const LABEL = 'block font-label-lg text-label-sm uppercase text-hero-navy/80 mb-1.5'

const hoy = () => new Date().toISOString().slice(0, 10)

function Opciones({ opciones, elegidas, onChange }) {
  const alternar = (o) => onChange(elegidas.includes(o) ? elegidas.filter(x => x !== o) : [...elegidas, o])
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(o => {
        const activa = elegidas.includes(o)
        return (
          <button key={o} type="button" aria-pressed={activa} onClick={() => alternar(o)}
            className={`px-3.5 py-2 rounded-full border-2 font-body-md text-[13px] font-medium transition-colors ${
              activa ? 'bg-hero-navy border-hero-navy text-hero-cream' : 'bg-white border-hero-navy/15 text-hero-navy hover:border-hero-navy/40'
            }`}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export default function FormularioPaquete({ onClose }) {
  const { config } = useSiteConfig()
  const [nombre, setNombre] = useState('')
  const [destinos, setDestinos] = useState([])
  const [pais, setPais] = useState('')
  const [origen, setOrigen] = useState('')
  const [adultos, setAdultos] = useState(2)
  const [edades, setEdades] = useState([])
  const [hospedajes, setHospedajes] = useState([])
  const [presupuesto, setPresupuesto] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [noches, setNoches] = useState(7)
  const [error, setError] = useState(null)

  // Escape cierra; mientras está abierto, la página de atrás no scrollea
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
    }
  }, [])

  // El aviso de error se va apenas el cliente cambia algo
  useEffect(() => { setError(null) }, [nombre, destinos, pais, origen, edades, hospedajes, presupuesto, desde, hasta, noches])

  function cambiarMenores(n) {
    setEdades(prev => n > prev.length ? [...prev, ...Array(n - prev.length).fill('')] : prev.slice(0, n))
  }

  function enviar(e) {
    e.preventDefault()
    const monto = Number(presupuesto)
    const falta =
      !nombre.trim() ? 'Indicá tu nombre.' :
      !destinos.length ? 'Elegí al menos un destino.' :
      !pais ? 'Indicá desde qué país viajás.' :
      !origen.trim() ? 'Indicá tu ciudad de origen.' :
      edades.some(x => x === '') ? 'Indicá la edad de cada menor.' :
      !hospedajes.length ? 'Elegí al menos un tipo de hospedaje.' :
      !(monto > 0) ? 'Indicá tu presupuesto.' :
      !desde || !hasta ? 'Indicá entre qué fechas podés viajar.' :
      hasta <= desde ? 'La fecha "hasta" tiene que ser posterior a la fecha "desde".' :
      noches > nochesEntre(desde, hasta) ? `Entre esas fechas entran como máximo ${nochesEntre(desde, hasta)} noches.` : null
    if (falta) { setError(falta); return }
    const texto = armarMensajePedidoPaquete({
      nombre: nombre.trim(), destinos, pais, origen: origen.trim(), adultos,
      edadesMenores: edades, hospedajes, presupuesto: monto, desde, hasta, noches,
    })
    window.open(`https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-hero-navy/60 backdrop-blur-sm md:p-6" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="Armar mi paquete" onSubmit={enviar} noValidate
        className="w-full max-w-xl max-h-[92vh] bg-surface rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="bg-hero-navy px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-label-sm text-[11px] uppercase tracking-widest text-hero-yellow mb-1">Paquete a medida</p>
            <h2 className="font-display-hero uppercase text-hero-cream text-2xl leading-none">Contanos tu viaje</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-hero-cream/60 hover:text-hero-cream text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <label className="block">
            <span className={LABEL}>Nombre</span>
            <input type="text" value={nombre} maxLength={80} autoComplete="name" onChange={e => setNombre(e.target.value)} className={CAMPO} />
          </label>

          <div>
            <p className={LABEL}>Destinos <span className="normal-case font-normal text-on-surface-variant/70 text-[11px]">(podés elegir varios)</span></p>
            <Opciones opciones={DESTINOS_PAQUETE} elegidas={destinos} onChange={setDestinos} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>País</span>
              <select value={pais} onChange={e => setPais(e.target.value)} className={CAMPO}>
                <option value="">Elegí</option>
                {PAISES_PAQUETE.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Ciudad de origen</span>
              <input type="text" value={origen} maxLength={60} placeholder="Ej: Rosario" onChange={e => setOrigen(e.target.value)} className={CAMPO} />
            </label>
          </div>

          <div>
            <p className={LABEL}>Pasajeros</p>
            <div className="flex flex-col gap-2.5">
              <Contador label="Adultos" valor={adultos} min={1} onChange={setAdultos} />
              <Contador label="Menores" valor={edades.length} min={0} onChange={cambiarMenores} />
            </div>
            {edades.length > 0 && (
              <div className="mt-3">
                <span className="block font-body-md text-[12px] text-on-surface-variant mb-1.5">Edad de cada menor</span>
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
            <p className={LABEL}>Hospedaje <span className="normal-case font-normal text-on-surface-variant/70 text-[11px]">(podés elegir varios)</span></p>
            <Opciones opciones={HOSPEDAJES_PAQUETE} elegidas={hospedajes} onChange={setHospedajes} />
          </div>

          <label className="block">
            <span className={LABEL}>Presupuesto total (USD)</span>
            <input type="number" inputMode="numeric" min="0" step="100" value={presupuesto} placeholder="Ej: 2500"
              onChange={e => setPresupuesto(e.target.value)} className={CAMPO} />
          </label>

          <div>
            <p className={LABEL}>¿Cuándo podés viajar?</p>
            <span className="block font-body-md text-[12px] text-on-surface-variant mb-2">El período en el que te gustaría viajar: buscamos la mejor opción dentro de esas fechas.</span>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="block font-body-md text-[12px] text-on-surface-variant mb-1">Desde</span>
                <input type="date" min={hoy()} value={desde}
                  onChange={e => { setDesde(e.target.value); if (hasta && e.target.value >= hasta) setHasta('') }}
                  className={CAMPO} />
              </label>
              <label className="block">
                <span className="block font-body-md text-[12px] text-on-surface-variant mb-1">Hasta</span>
                <input type="date" min={desde || hoy()} value={hasta} onChange={e => setHasta(e.target.value)} className={CAMPO} />
              </label>
            </div>
            <div className="mt-2.5">
              <Contador label="Noches que querés quedarte" valor={noches} min={1} onChange={setNoches} />
            </div>
          </div>
        </div>

        <div className="border-t-2 border-hero-navy/10 px-6 py-4 bg-white">
          {error && <p className="bg-red-50 text-red-600 font-body-md text-[13px] px-3.5 py-2.5 rounded-lg mb-3">{error}</p>}
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#25d366] hover:bg-[#1ebe5a] text-white font-label-lg text-label-lg uppercase py-3.5 rounded-full transition-colors">
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Enviar por WhatsApp
          </button>
          <p className="font-body-md text-[12px] text-on-surface-variant text-center mt-2.5">
            Te respondemos por WhatsApp con tu propuesta a medida.
          </p>
        </div>
      </form>
    </div>
  )
}
