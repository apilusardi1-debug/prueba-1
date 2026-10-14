import { useEffect, useState } from 'react'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { Contador } from './SeleccionPaseos.jsx'
import { BTN_PRINCIPAL } from './botones.js'
import { useTextos } from '../../context/LanguageContext.jsx'
import {
  DESTINOS_PAQUETE, HOSPEDAJES_PAQUETE, PAISES_PAQUETE, armarMensajePedidoPaquete, nochesEntre,
} from '../../../supabase/functions/_shared/pedidoWebPaquete.ts'

// "Armar mi paquete": los mismos datos que pide el formulario del asistente por
// WhatsApp. Al enviar se abre WhatsApp con el mensaje armado; el CRM lo reconoce
// (_shared/pedidoWebPaquete.ts) y el lead entra al embudo de Paquetes ya filtrado.
// El formulario se ve en el idioma del sitio, pero el mensaje sale siempre en español
// (con los valores en español: hospedaje, país): así lo lee el CRM.

const TEXTOS = {
  es: {
    faltaNombre: 'Indicá tu nombre.', faltaDestino: 'Elegí al menos un destino.', faltaPais: 'Indicá desde qué país viajás.',
    faltaOrigen: 'Indicá tu ciudad de origen.', faltanEdades: 'Indicá la edad de cada menor.', faltaHospedaje: 'Elegí al menos un tipo de hospedaje.',
    faltaPresupuesto: 'Indicá tu presupuesto.', faltanFechas: 'Indicá entre qué fechas podés viajar.',
    fechasAlReves: 'La fecha "hasta" tiene que ser posterior a la fecha "desde".',
    demasiadasNoches: n => `Entre esas fechas entran como máximo ${n} noches.`,
    armarPaquete: 'Armar mi paquete', aMedida: 'Paquete a medida', contanos: 'Contanos tu viaje', cerrar: 'Cerrar',
    nombre: 'Nombre', destinos: 'Destinos', varios: '(podés elegir varios)', pais: 'País', elegi: 'Elegí', otro: 'Otro',
    paises: {}, origen: 'Ciudad de origen', ejemploOrigen: 'Ej: Rosario',
    pasajeros: 'Pasajeros', adultos: 'Adultos', menores: 'Menores', edadCadaMenor: 'Edad de cada menor', edadMenor: i => `Edad del menor ${i}`,
    hospedaje: 'Hospedaje', hospedajes: {}, presupuesto: 'Presupuesto total (USD)', ejemploPresupuesto: 'Ej: 2500',
    cuando: '¿Cuándo podés viajar?', cuandoAyuda: 'El período en el que te gustaría viajar: buscamos la mejor opción dentro de esas fechas.',
    desde: 'Desde', hasta: 'Hasta', noches: 'Noches que querés quedarte',
    enviar: 'Enviar por WhatsApp', respuesta: 'Te respondemos por WhatsApp con tu propuesta a medida.',
    datos: 'Usamos tus datos solo para responder tu consulta.', privacidad: 'Política de privacidad',
  },
  pt: {
    faltaNombre: 'Informe seu nome.', faltaDestino: 'Escolha pelo menos um destino.', faltaPais: 'Informe de qual país você viaja.',
    faltaOrigen: 'Informe sua cidade de origem.', faltanEdades: 'Informe a idade de cada menor.', faltaHospedaje: 'Escolha pelo menos um tipo de hospedagem.',
    faltaPresupuesto: 'Informe seu orçamento.', faltanFechas: 'Informe entre quais datas você pode viajar.',
    fechasAlReves: 'A data "até" tem que ser depois da data "de".',
    demasiadasNoches: n => `Entre essas datas cabem no máximo ${n} noites.`,
    armarPaquete: 'Montar meu pacote', aMedida: 'Pacote sob medida', contanos: 'Conte-nos sobre sua viagem', cerrar: 'Fechar',
    nombre: 'Nome', destinos: 'Destinos', varios: '(pode escolher vários)', pais: 'País', elegi: 'Escolha', otro: 'Outro',
    paises: { 'Perú': 'Peru', 'Uruguay': 'Uruguai', 'Paraguay': 'Paraguai' }, origen: 'Cidade de origem', ejemploOrigen: 'Ex.: Rosario',
    pasajeros: 'Passageiros', adultos: 'Adultos', menores: 'Menores', edadCadaMenor: 'Idade de cada menor', edadMenor: i => `Idade do menor ${i}`,
    hospedaje: 'Hospedagem', hospedajes: { 'Posada/Departamento': 'Pousada/Apartamento', 'Resort All Inclusive': 'Resort all inclusive' },
    presupuesto: 'Orçamento total (USD)', ejemploPresupuesto: 'Ex.: 2500',
    cuando: 'Quando você pode viajar?', cuandoAyuda: 'O período em que você gostaria de viajar: buscamos a melhor opção dentro dessas datas.',
    desde: 'De', hasta: 'Até', noches: 'Noites que você quer ficar',
    enviar: 'Enviar pelo WhatsApp', respuesta: 'Respondemos pelo WhatsApp com sua proposta sob medida.',
    datos: 'Usamos seus dados apenas para responder à sua consulta.', privacidad: 'Política de privacidade',
  },
  en: {
    faltaNombre: 'Enter your name.', faltaDestino: 'Choose at least one destination.', faltaPais: 'Tell us which country you’re traveling from.',
    faltaOrigen: 'Enter your home city.', faltanEdades: 'Enter the age of each child.', faltaHospedaje: 'Choose at least one type of accommodation.',
    faltaPresupuesto: 'Enter your budget.', faltanFechas: 'Tell us between which dates you can travel.',
    fechasAlReves: 'The "to" date must be after the "from" date.',
    demasiadasNoches: n => `Those dates fit at most ${n} nights.`,
    armarPaquete: 'Build my package', aMedida: 'Tailor-made package', contanos: 'Tell us about your trip', cerrar: 'Close',
    nombre: 'Name', destinos: 'Destinations', varios: '(choose as many as you like)', pais: 'Country', elegi: 'Choose', otro: 'Other',
    paises: { 'Perú': 'Peru' }, origen: 'Home city', ejemploOrigen: 'E.g. Rosario',
    pasajeros: 'Travelers', adultos: 'Adults', menores: 'Children', edadCadaMenor: 'Age of each child', edadMenor: i => `Age of child ${i}`,
    hospedaje: 'Accommodation', hospedajes: { 'Posada/Departamento': 'Inn/Apartment', 'Resort All Inclusive': 'All-inclusive resort' },
    presupuesto: 'Total budget (USD)', ejemploPresupuesto: 'E.g. 2500',
    cuando: 'When can you travel?', cuandoAyuda: 'The period when you’d like to travel: we’ll find the best option within those dates.',
    desde: 'From', hasta: 'To', noches: 'Nights you want to stay',
    enviar: 'Send via WhatsApp', respuesta: 'We’ll reply on WhatsApp with your tailor-made proposal.',
    datos: 'We only use your details to answer your inquiry.', privacidad: 'Privacy policy',
  },
}

const CAMPO = 'w-full border-2 border-hero-navy/15 focus:border-hero-navy rounded-xl px-3 py-2.5 font-body-md text-body-md text-hero-navy bg-white outline-none transition-colors'
const LABEL = 'block font-label-lg text-label-sm uppercase text-hero-navy/80 mb-1.5'

const hoy = () => new Date().toISOString().slice(0, 10)

function Opciones({ opciones, elegidas, onChange, etiqueta = o => o }) {
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
            {etiqueta(o)}
          </button>
        )
      })}
    </div>
  )
}

export default function FormularioPaquete({ onClose }) {
  const { config } = useSiteConfig()
  const tx = useTextos(TEXTOS)
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
      !nombre.trim() ? tx.faltaNombre :
      !destinos.length ? tx.faltaDestino :
      !pais ? tx.faltaPais :
      !origen.trim() ? tx.faltaOrigen :
      edades.some(x => x === '') ? tx.faltanEdades :
      !hospedajes.length ? tx.faltaHospedaje :
      !(monto > 0) ? tx.faltaPresupuesto :
      !desde || !hasta ? tx.faltanFechas :
      hasta <= desde ? tx.fechasAlReves :
      noches > nochesEntre(desde, hasta) ? tx.demasiadasNoches(nochesEntre(desde, hasta)) : null
    if (falta) { setError(falta); return }
    const texto = armarMensajePedidoPaquete({
      nombre: nombre.trim(), destinos, pais, origen: origen.trim(), adultos,
      edadesMenores: edades, hospedajes, presupuesto: monto, desde, hasta, noches,
    })
    window.open(`https://wa.me/${config?.whatsapp || ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-hero-navy/60 backdrop-blur-sm md:p-6" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label={tx.armarPaquete} onSubmit={enviar} noValidate
        className="w-full max-w-xl max-h-[92vh] bg-surface rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="bg-hero-navy px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-label-sm text-[12px] uppercase tracking-widest text-hero-yellow mb-1">{tx.aMedida}</p>
            <h2 className="font-display-hero uppercase text-hero-cream text-2xl leading-none">{tx.contanos}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={tx.cerrar} className="text-hero-cream/75 hover:text-hero-cream text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <label className="block">
            <span className={LABEL}>{tx.nombre}</span>
            <input type="text" value={nombre} maxLength={80} autoComplete="name" onChange={e => setNombre(e.target.value)} className={CAMPO} />
          </label>

          <div>
            <p className={LABEL}>{tx.destinos} <span className="normal-case font-normal text-on-surface-variant text-[12px]">{tx.varios}</span></p>
            <Opciones opciones={DESTINOS_PAQUETE} elegidas={destinos} onChange={setDestinos} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>{tx.pais}</span>
              <select value={pais} onChange={e => setPais(e.target.value)} className={CAMPO}>
                <option value="">{tx.elegi}</option>
                {PAISES_PAQUETE.map(p => <option key={p} value={p}>{tx.paises[p] || p}</option>)}
                <option value="Otro">{tx.otro}</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>{tx.origen}</span>
              <input type="text" value={origen} maxLength={60} placeholder={tx.ejemploOrigen} onChange={e => setOrigen(e.target.value)} className={CAMPO} />
            </label>
          </div>

          <div>
            <p className={LABEL}>{tx.pasajeros}</p>
            <div className="flex flex-col gap-2.5">
              <Contador label={tx.adultos} valor={adultos} min={1} onChange={setAdultos} />
              <Contador label={tx.menores} valor={edades.length} min={0} onChange={cambiarMenores} />
            </div>
            {edades.length > 0 && (
              <div className="mt-3">
                <span className="block font-body-md text-[13px] text-on-surface-variant mb-1.5">{tx.edadCadaMenor}</span>
                <div className="grid grid-cols-4 gap-2">
                  {edades.map((edad, i) => (
                    <select key={i} value={edad} aria-label={tx.edadMenor(i + 1)}
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
            <p className={LABEL}>{tx.hospedaje} <span className="normal-case font-normal text-on-surface-variant text-[12px]">{tx.varios}</span></p>
            <Opciones opciones={HOSPEDAJES_PAQUETE} elegidas={hospedajes} onChange={setHospedajes} etiqueta={o => tx.hospedajes[o] || o} />
          </div>

          <label className="block">
            <span className={LABEL}>{tx.presupuesto}</span>
            <input type="number" inputMode="numeric" min="0" step="100" value={presupuesto} placeholder={tx.ejemploPresupuesto}
              onChange={e => setPresupuesto(e.target.value)} className={CAMPO} />
          </label>

          <div>
            <p className={LABEL}>{tx.cuando}</p>
            <span className="block font-body-md text-[13px] text-on-surface-variant mb-2">{tx.cuandoAyuda}</span>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="block font-body-md text-[13px] text-on-surface-variant mb-1">{tx.desde}</span>
                <input type="date" min={hoy()} value={desde}
                  onChange={e => { setDesde(e.target.value); if (hasta && e.target.value >= hasta) setHasta('') }}
                  className={CAMPO} />
              </label>
              <label className="block">
                <span className="block font-body-md text-[13px] text-on-surface-variant mb-1">{tx.hasta}</span>
                <input type="date" min={desde || hoy()} value={hasta} onChange={e => setHasta(e.target.value)} className={CAMPO} />
              </label>
            </div>
            <div className="mt-2.5">
              <Contador label={tx.noches} valor={noches} min={1} onChange={setNoches} />
            </div>
          </div>
        </div>

        <div className="border-t-2 border-hero-navy/10 px-6 py-4 bg-white">
          {error && <p className="bg-red-50 text-red-600 font-body-md text-[13px] px-3.5 py-2.5 rounded-lg mb-3">{error}</p>}
          <button type="submit"
            className={`${BTN_PRINCIPAL} w-full`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chat</span>
            {tx.enviar}
          </button>
          <p className="font-body-md text-[13px] text-on-surface-variant text-center mt-2.5">
            {tx.respuesta}
          </p>
          <p className="font-body-md text-[12px] text-on-surface-variant text-center mt-1">
            {tx.datos}
            {' '}<a href="/privacidad" target="_blank" rel="noopener" className="underline underline-offset-2 text-hero-navy">{tx.privacidad}</a>
          </p>
        </div>
      </form>
    </div>
  )
}
