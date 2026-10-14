import { useState } from 'react'
import { claveTexto } from '../../lib/reservasPlanilla.js'

// Alta y edición de una reserva con los mismos campos que la planilla de Excel del
// equipo de paseos. Paseo, chofer y vendedor se escriben libre, pero el campo sugiere
// los nombres ya usados para que no aparezcan "Fran" y "francisco" como dos personas.

const hoy = () => new Date().toISOString().slice(0, 10)

const VACIA = {
  fecha_venta: '', cliente_nombre: '', cliente_whatsapp: '', personas: 1,
  paseo: '', fecha: '', sin_traslado: false,
  total: '', sena: '', saldo_cliente: '', moneda: 'BRL',
  chofer_texto: '', comision_chofer: '', hospedaje: '', vendedor_texto: '',
  notas: '', estado: 'confirmada',
}

const ESTADOS = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada' }

const INPUT = 'w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1'

const aTexto = (v) => (v == null ? '' : String(v))
const aNumero = (v) => (String(v).trim() === '' ? null : Number(String(v).replace(',', '.')))

export default function ModalReservaPlanilla({ reserva, excursiones, sugerencias, onGuardar, onCerrar }) {
  const [form, setForm] = useState(() => reserva ? {
    ...VACIA,
    ...Object.fromEntries(Object.keys(VACIA).map(k => [k, typeof VACIA[k] === 'boolean' ? !!reserva[k] : aTexto(reserva[k])])),
    paseo: reserva.paseo || reserva.excursiones?.nombre || '',
    moneda: reserva.moneda || 'BRL',
    estado: reserva.estado || 'confirmada',
  } : { ...VACIA, fecha_venta: hoy() })
  // El saldo se calcula solo (venta − seña) hasta que alguien lo escribe a mano
  const [saldoManual, setSaldoManual] = useState(!!reserva && reserva.saldo_cliente != null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) {
    setForm(p => {
      const n = { ...p, [k]: v }
      if (!saldoManual && (k === 'total' || k === 'sena')) {
        const t = aNumero(n.total), s = aNumero(n.sena)
        n.saldo_cliente = t == null ? '' : String(Math.max(t - (s || 0), 0))
      }
      return n
    })
    setError('')
  }

  async function guardar(e) {
    e.preventDefault()
    const falta = !form.cliente_nombre.trim() ? 'Falta el nombre del cliente.'
      : !form.paseo.trim() ? 'Falta el paseo.'
      : !form.fecha ? 'Falta la fecha del paseo.'
      : !(Number(form.personas) > 0) ? 'La cantidad tiene que ser al menos 1.'
      : [form.total, form.sena, form.saldo_cliente, form.comision_chofer].some(v => String(v).trim() && Number.isNaN(aNumero(v))) ? 'Revisá los montos: solo números.'
      : null
    if (falta) { setError(falta); return }

    // Si el paseo es uno del catálogo, queda vinculado (Agenda, costos operativos)
    const exc = excursiones.find(x => claveTexto(x.nombre) === claveTexto(form.paseo))
    const datos = {
      fecha_venta: form.fecha_venta || null,
      cliente_nombre: form.cliente_nombre.trim(),
      cliente_whatsapp: form.cliente_whatsapp.replace(/\D/g, '') || null,
      personas: parseInt(form.personas, 10),
      paseo: exc ? exc.nombre : form.paseo.trim(),
      excursion_id: exc?.id || null,
      fecha: form.fecha,
      sin_traslado: form.sin_traslado,
      total: aNumero(form.total) ?? 0,
      sena: aNumero(form.sena),
      saldo_cliente: aNumero(form.saldo_cliente),
      moneda: form.moneda,
      chofer_texto: form.chofer_texto.trim() || null,
      comision_chofer: aNumero(form.comision_chofer),
      hospedaje: form.hospedaje.trim() || null,
      vendedor_texto: form.vendedor_texto.trim() || null,
      notas: form.notas.trim() || null,
      estado: form.estado,
    }
    setGuardando(true)
    try {
      await onGuardar(datos)
    } catch (err) {
      setError('No se pudo guardar: ' + (err?.message || 'intentá de nuevo'))
      setGuardando(false)
    }
  }

  const Campo = ({ label, k, type = 'text', lista, ...rest }) => (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input type={type} value={form[k]} list={lista} onChange={e => set(k, e.target.value)} className={INPUT} {...rest} />
    </label>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={onCerrar}>
      <form onSubmit={guardar} noValidate onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">{reserva ? 'Editar reserva' : 'Nueva reserva'}</h2>
          <button type="button" onClick={onCerrar} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Campo({ label: 'Fecha de venta', k: 'fecha_venta', type: 'date' })}
          {Campo({ label: 'Fecha del paseo *', k: 'fecha', type: 'date' })}
          {Campo({ label: 'Cliente *', k: 'cliente_nombre' })}
          {Campo({ label: 'Contacto (WhatsApp)', k: 'cliente_whatsapp', inputMode: 'tel', placeholder: 'Ej: 5491155555555' })}
          <div className="sm:col-span-2 grid grid-cols-[1fr_96px] gap-3">
            {Campo({ label: 'Paseo *', k: 'paseo', lista: 'sug-paseos', placeholder: 'Ej: Maragogi, Traslado Porto → Aeropuerto Recife' })}
            {Campo({ label: 'Cantidad *', k: 'personas', type: 'number', min: 1 })}
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
            <input type="checkbox" checked={form.sin_traslado} onChange={e => set('sin_traslado', e.target.checked)}
              className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-400" />
            Sin traslado <span className="text-xs text-gray-400 dark:text-zinc-500">(el cliente va por su cuenta)</span>
          </label>

          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {Campo({ label: 'Valor venta', k: 'total', inputMode: 'decimal' })}
            {Campo({ label: 'Seña / com. vendedor', k: 'sena', inputMode: 'decimal' })}
            <label className="block">
              <span className={LABEL}>Saldo cliente</span>
              <input value={form.saldo_cliente} inputMode="decimal"
                onChange={e => { setSaldoManual(true); set('saldo_cliente', e.target.value) }} className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>Moneda</span>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className={INPUT}>
                <option value="BRL">R$</option>
                <option value="USD">US$</option>
              </select>
            </label>
          </div>

          {Campo({ label: 'Chofer del día', k: 'chofer_texto', lista: 'sug-choferes' })}
          {Campo({ label: 'Comisión chofer', k: 'comision_chofer', inputMode: 'decimal' })}
          {Campo({ label: 'Hospedaje', k: 'hospedaje' })}
          {Campo({ label: 'Vendedor', k: 'vendedor_texto', lista: 'sug-vendedores' })}
          <label className="block sm:col-span-2">
            <span className={LABEL}>Observaciones</span>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} className={INPUT} />
          </label>
          <label className="block">
            <span className={LABEL}>Estado</span>
            <select value={form.estado} onChange={e => set('estado', e.target.value)} className={INPUT}>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <datalist id="sug-paseos">{sugerencias.paseos.map(p => <option key={p} value={p} />)}</datalist>
        <datalist id="sug-choferes">{sugerencias.choferes.map(p => <option key={p} value={p} />)}</datalist>
        <datalist id="sug-vendedores">{sugerencias.vendedores.map(p => <option key={p} value={p} />)}</datalist>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
          {error && <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg mb-3">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onCerrar} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
