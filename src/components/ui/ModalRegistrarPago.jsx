import { useState, useEffect } from 'react'
import { pagosApi, reservasApi, movimientosApi, conceptosApi } from '../../lib/supabase.js'

const METODOS = ['efectivo', 'transferencia', 'qr', 'tarjeta']

function hoy() { return new Date().toISOString().split('T')[0] }

// Único punto que registra un pago: crea el registro individual en
// "pagos" (historial), actualiza el "pagado" acumulado de la reserva
// (saldo), y opcionalmente carga el ingreso en la caja de Finanzas —
// las 3 cosas que antes se anotaban sueltas y sin relación entre sí.
export default function ModalRegistrarPago({ reserva, clienteId, clienteNombre, onGuardado, onCerrar }) {
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [conceptos, setConceptos] = useState([])
  const [concepto, setConcepto] = useState('')
  const [registrarCaja, setRegistrarCaja] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const saldo = Math.max((reserva.total || 0) - (reserva.pagado || 0), 0)

  useEffect(() => {
    conceptosApi.getAll().then(({ data }) => {
      const lista = (data || []).filter(c => c.activo)
      setConceptos(lista)
      setConcepto(lista[0]?.nombre || '')
    })
  }, [])

  async function guardar() {
    const montoNum = parseFloat(monto)
    if (!montoNum || montoNum <= 0) return setError('Ingresá un monto válido.')
    setError('')
    setGuardando(true)

    const { error: errPago } = await pagosApi.create({
      cliente_id: clienteId || null,
      reserva_id: reserva.id,
      monto: montoNum,
      moneda: 'BRL',
      metodo,
      estado: 'confirmado',
    })
    if (errPago) {
      setGuardando(false)
      return setError('No se pudo guardar el historial de pago: ' + errPago.message)
    }

    const nuevoPagado = (reserva.pagado || 0) + montoNum
    const { error: errReserva } = await reservasApi.updatePago(reserva.id, nuevoPagado)
    if (errReserva) {
      setGuardando(false)
      return setError('El pago se guardó pero no se pudo actualizar el saldo de la reserva: ' + errReserva.message)
    }

    if (registrarCaja) {
      const excursionNombre = reserva.excursiones?.nombre
      const { error: errCaja } = await movimientosApi.create({
        fecha: hoy(),
        tipo: 'ingreso',
        categoria: nuevoPagado >= (reserva.total || 0) ? 'pago_total' : 'sena',
        concepto: `${concepto || 'Pago'} — ${clienteNombre || reserva.cliente_nombre}${excursionNombre ? ' — ' + excursionNombre : ''}`,
        monto: montoNum,
        moneda: 'BRL',
        cliente_id: clienteId || null,
        cliente_nombre: clienteNombre || reserva.cliente_nombre,
        persona_nombre: null,
        metodo,
        estado: 'confirmado',
        notas: null,
      })
      if (errCaja) {
        setGuardando(false)
        return setError('El pago se guardó pero no se pudo cargar el ingreso en Finanzas: ' + errCaja.message)
      }
    }

    setGuardando(false)
    onGuardado(nuevoPagado)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Registrar pago</h2>
          <button onClick={onCerrar} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
          Saldo pendiente: <span className="font-semibold text-gray-800 dark:text-zinc-200">R$ {saldo.toLocaleString('es-AR')}</span>
        </p>

        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Monto (R$)</label>
            <input
              type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
              placeholder={saldo ? String(saldo) : '0.00'} autoFocus
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Método</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
            <input type="checkbox" checked={registrarCaja} onChange={e => setRegistrarCaja(e.target.checked)}
              className="rounded border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 text-brand-600 focus:ring-brand-500" />
            Registrar también como ingreso en Finanzas
          </label>

          {registrarCaja && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Concepto (Finanzas)</label>
              <select value={concepto} onChange={e => setConcepto(e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                {conceptos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
          )}
        </div>

        <button onClick={guardar} disabled={guardando}
          className="mt-5 w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
          {guardando ? 'Guardando...' : 'Registrar pago'}
        </button>
      </div>
    </div>
  )
}
