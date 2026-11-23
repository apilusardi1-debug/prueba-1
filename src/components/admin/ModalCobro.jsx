import { useState } from 'react'
import { nombrePaseo, saldoDe, formatMonto, fechaCorta } from '../../lib/reservasPlanilla.js'

// Registrar el cobro del saldo de una o varias reservas de paseos. El guía cobra en el paseo y le pasa
// el comprobante a Francisco; Francisco lo carga acá. Cada cobro queda como ingreso en Finanzas y baja
// el saldo de la reserva (se puede cobrar de a partes).

const INPUT = 'w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1'
const hoy = () => new Date().toISOString().slice(0, 10)
const aNumero = (v) => (String(v).trim() === '' ? NaN : Number(String(v).replace(',', '.')))

const COBRADORES = ['Guía', 'Vendedor', 'Otro']
const METODOS = [['efectivo', 'Efectivo'], ['transferencia', 'Transferencia / Pix'], ['qr', 'QR'], ['tarjeta', 'Tarjeta']]

export default function ModalCobro({ reservas, onConfirmar, onCerrar }) {
  const [fecha, setFecha] = useState(hoy())
  const [cobrador, setCobrador] = useState('Guía')
  const [nombreCobrador, setNombreCobrador] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [nota, setNota] = useState('')
  const [montos, setMontos] = useState(() => Object.fromEntries(reservas.map(r => [r.id, String(saldoDe(r) ?? '')])))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e) {
    e.preventDefault()
    const lineas = []
    for (const r of reservas) {
      const m = aNumero(montos[r.id])
      if (String(montos[r.id]).trim() === '' || m === 0) continue
      if (Number.isNaN(m) || m < 0) { setError(`Revisá el monto de ${r.cliente_nombre}: solo números.`); return }
      if (m > saldoDe(r) + 0.005) { setError(`${r.cliente_nombre}: el monto no puede pasar del saldo (${formatMonto(saldoDe(r), r.moneda)}).`); return }
      lineas.push({ reserva: r, monto: m })
    }
    if (!lineas.length) { setError('No hay ningún monto para registrar.'); return }
    setGuardando(true)
    const msg = await onConfirmar({
      fecha, metodo, nota: nota.trim() || null, lineas,
      cobrador: cobrador === 'Guía' ? 'Guía' : (nombreCobrador.trim() || cobrador),
    })
    if (msg) { setError(msg); setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={onCerrar}>
      <form onSubmit={guardar} noValidate onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="px-6 pt-5 pb-2">
          <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Registrar cobro del saldo</h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Queda como ingreso en Finanzas y baja el saldo de la reserva. Para cobrar solo una parte, bajá el monto.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
          <div className="rounded-xl border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
            {reservas.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{r.cliente_nombre}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{nombrePaseo(r)} · {fechaCorta(r.fecha)} · saldo {formatMonto(saldoDe(r), r.moneda)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-zinc-500">{r.moneda === 'USD' ? 'US$' : 'R$'}</span>
                  <input value={montos[r.id]} inputMode="decimal" aria-label={`Monto cobrado a ${r.cliente_nombre}`}
                    onChange={ev => { setMontos(p => ({ ...p, [r.id]: ev.target.value })); setError('') }}
                    className={INPUT + ' w-24 text-right'} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Fecha del cobro</span>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>Cómo se pagó</span>
              <select value={metodo} onChange={e => setMetodo(e.target.value)} className={INPUT}>
                {METODOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Quién cobró</span>
              <select value={cobrador} onChange={e => setCobrador(e.target.value)} className={INPUT}>
                {COBRADORES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {cobrador !== 'Guía' && (
              <label className="block">
                <span className={LABEL}>Nombre</span>
                <input value={nombreCobrador} onChange={e => setNombreCobrador(e.target.value)}
                  placeholder={cobrador === 'Vendedor' ? (reservas[0]?.vendedor_texto || 'Nombre del vendedor') : 'Nombre'} className={INPUT} />
              </label>
            )}
          </div>
          <label className="block">
            <span className={LABEL}>Nota (opcional)</span>
            <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: comprobante del guía recibido por WhatsApp" className={INPUT} />
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
          {error && <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg mb-3">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onCerrar} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
              {guardando ? 'Registrando...' : 'Registrar cobro'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
