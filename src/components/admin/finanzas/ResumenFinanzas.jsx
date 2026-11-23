import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { movimientosApi, reservasApi } from '../../../lib/supabase.js'
import { nombrePaseo, saldoDe, formatMonto, fechaCorta } from '../../../lib/reservasPlanilla.js'
import {
  resumenVentas, margenPorPaseo, totalesMargen, comisionesVendedor, comisionesChofer, cobrosPendientes,
  ORIGEN_LIQ_CHOFER, FINANZAS_INICIO,
} from '../../../lib/finanzasPlanillas.js'

// Resumen de Finanzas armado con las planillas de paseos (Reservas) y los movimientos de caja.
// Cada moneda va por separado, sin convertir.

const CARD = 'bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm'
const TH = 'px-3 py-2 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide'
const TD = 'px-3 py-2.5 text-sm'
const hoy = () => new Date().toISOString().slice(0, 10)

function Dato({ etiqueta, valor, clase = 'text-gray-900 dark:text-zinc-100', ayuda }) {
  return (
    <div title={ayuda}>
      <p className="text-xs text-gray-400 dark:text-zinc-500">{etiqueta}</p>
      <p className={`text-lg font-bold ${clase}`}>{valor}</p>
    </div>
  )
}

function Seccion({ titulo, nota, children, vacio }) {
  return (
    <div className={CARD}>
      <div className="px-5 pt-4 pb-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{titulo}</p>
        {nota && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{nota}</p>}
      </div>
      {vacio ? <p className="px-5 pb-5 text-sm text-gray-400 dark:text-zinc-500">{vacio}</p> : <div className="overflow-x-auto pb-2">{children}</div>}
    </div>
  )
}

export default function ResumenFinanzas({ reservas, movimientos, costos = [], desde, hasta, etiquetaPeriodo, onCambio }) {
  const [confirmando, setConfirmando] = useState(null) // clave de la fila de chofer a liquidar
  const [liquidando, setLiquidando] = useState(false)
  const [error, setError] = useState('')
  const hoyStr = hoy()

  const ventas = useMemo(() => resumenVentas(reservas, movimientos, desde, hasta), [reservas, movimientos, desde, hasta])
  const margen = useMemo(() => margenPorPaseo(reservas, desde, hasta, nombrePaseo, costos), [reservas, desde, hasta, costos])
  const margenTot = useMemo(() => totalesMargen(margen), [margen])
  const vendedores = useMemo(() => comisionesVendedor(reservas, desde, hasta), [reservas, desde, hasta])
  const choferes = useMemo(() => comisionesChofer(reservas, desde, hasta), [reservas, desde, hasta])
  const pendientes = useMemo(() => cobrosPendientes(reservas, hoyStr, 7), [reservas, hoyStr])

  const monedas = [...new Set([...Object.keys(ventas.ventas), ...Object.keys(ventas.cobrado), ...Object.keys(margenTot)])].sort()

  async function liquidar(f) {
    setLiquidando(true)
    setError('')
    let usuario = null
    try { const s = JSON.parse(localStorage.getItem('admin_session') || '{}'); usuario = s.nombre || s.email || null } catch { /* sin sesión */ }
    const { data, error: e1 } = (await movimientosApi.create({
      fecha: hoyStr, tipo: 'egreso', categoria: 'chofer',
      concepto: `Comisión chofer ${f.chofer} - ${f.idsPorPagar.length} paseo${f.idsPorPagar.length === 1 ? '' : 's'}`,
      monto: f.porPagar, moneda: f.moneda, persona_nombre: f.chofer, metodo: 'efectivo', estado: 'confirmado',
      registrado_por: usuario, origen: ORIGEN_LIQ_CHOFER, cobrador: f.chofer,
    })) || {}
    if (e1 || !data) {
      setError(`No se pudo registrar el pago a ${f.chofer}: ${e1?.message || 'sin respuesta'}. Si dice que falta una columna, hay que correr primero el SQL de Finanzas.`)
      setLiquidando(false)
      return
    }
    const res = await Promise.all(f.idsPorPagar.map(id => reservasApi.update(id, { comision_chofer_pagada_at: hoyStr, comision_chofer_liq_id: data.id })))
    if (res.some(r => r?.error)) {
      // No quedan pagos a medias: se deshace el egreso y se pide reintentar
      await movimientosApi.delete(data.id)
      setError(`No se pudo marcar como pagadas las comisiones de ${f.chofer}. No se registró nada; probá de nuevo.`)
    }
    setLiquidando(false)
    setConfirmando(null)
    onCambio?.()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        Período: {etiquetaPeriodo}. Cada moneda por separado. La seña es de los vendedores (su comisión) y no entra a la caja de la agencia;
        el saldo entra cuando Francisco registra el cobro en Reservas. Finanzas empieza el {fechaCorta(FINANZAS_INICIO)}: los paseos anteriores
        se dan por cobrados y pagados (están en las planillas contables) y no figuran como pendientes.
      </p>
      {error && <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

      {/* Una tarjeta por moneda */}
      {monedas.length === 0 ? (
        <div className={CARD + ' p-6 text-sm text-gray-400 dark:text-zinc-500'}>No hay ventas ni cobros en este período.</div>
      ) : monedas.map(m => {
        const mg = margenTot[m]
        return (
          <div key={m} className={CARD + ' p-5'}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-3">{m === 'USD' ? 'Dólares (US$)' : 'Reales (R$)'}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Dato etiqueta="Ventas del período" valor={formatMonto(ventas.ventas[m] || 0, m)} ayuda="Total vendido en reservas no canceladas, por fecha de venta" />
              <Dato etiqueta="Seña (vendedores)" valor={formatMonto(ventas.sena[m] || 0, m)} ayuda="La cobra el vendedor y es su comisión: no entra a la caja" />
              <Dato etiqueta="Saldo cobrado en caja" valor={formatMonto(ventas.cobrado[m] || 0, m)} clase="text-green-600 dark:text-green-400" ayuda="Cobros de saldo ya registrados en el período" />
              <Dato etiqueta="Por cobrar" valor={formatMonto(ventas.porCobrar[m] || 0, m)} clase="text-red-500 dark:text-red-400" ayuda="Saldo pendiente de todos los paseos desde el inicio de Finanzas, sin importar cuándo se vendieron" />
              <Dato etiqueta="Margen de paseos" valor={mg ? formatMonto(mg.margen, m) : formatMonto(0, m)}
                clase={mg && mg.margen < 0 ? 'text-red-500 dark:text-red-400' : 'text-brand-700 dark:text-brand-400'}
                ayuda="Venta − seña − costo de operar, de los paseos confirmados o completados del período" />
              {mg && mg.sinCosto > 0 && (
                <p className="col-span-2 md:col-span-5 text-xs text-amber-600 dark:text-amber-400">
                  {mg.sinCosto} reserva{mg.sinCosto === 1 ? '' : 's'} sin costo cargado: su margen está sin descontar el costo y puede ser mayor que el real.
                </p>
              )}
            </div>
          </div>
        )
      })}

      {/* Cobros: lo que hay que registrar y lo que viene */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Seccion titulo={`Saldos de paseos ya realizados sin registrar (${pendientes.vencidos.length})`}
          nota="El paseo ya pasó y el saldo sigue pendiente: hay que registrar el cobro (botón Cobrado en Reservas)."
          vacio={pendientes.vencidos.length === 0 ? 'No hay saldos atrasados.' : null}>
          <ListaCobros lista={pendientes.vencidos.slice(0, 10)} resto={pendientes.vencidos.length - 10} />
        </Seccion>
        <Seccion titulo={`Cobros de los próximos 7 días (${pendientes.proximos.length})`}
          nota="Saldos que el guía debería cobrar en estos paseos."
          vacio={pendientes.proximos.length === 0 ? 'No hay saldos para cobrar en los próximos días.' : null}>
          <ListaCobros lista={pendientes.proximos.slice(0, 10)} resto={pendientes.proximos.length - 10} />
        </Seccion>
      </div>

      <Seccion titulo="Margen por paseo" nota="Venta − seña del vendedor − costo de operar (el calculado con chofer y guía; si falta, la comisión del chofer de la planilla)."
        vacio={margen.length === 0 ? 'No hay paseos confirmados o completados en este período.' : null}>
        <table className="w-full">
          <thead><tr className="text-left">
            <th className={TH}>Paseo</th><th className={TH + ' text-right'}>Reservas</th><th className={TH + ' text-right'}>Pax</th>
            <th className={TH + ' text-right'}>Ventas</th><th className={TH + ' text-right'}>Seña</th><th className={TH + ' text-right'}>Costo</th><th className={TH + ' text-right'}>Margen</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
            {margen.map(f => (
              <tr key={f.paseo + f.moneda}>
                <td className={TD + ' font-medium text-gray-800 dark:text-zinc-200'}>
                  {f.paseo}
                  {f.sinCosto > 0 && <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400" title="Reservas de este paseo sin costo cargado">{f.sinCosto} sin costo</span>}
                  {f.costoOtraMoneda > 0 && <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400" title="El costo está en otra moneda y no se sumó">{f.costoOtraMoneda} con costo en otra moneda</span>}
                </td>
                <td className={TD + ' text-right'}>{f.reservas}</td>
                <td className={TD + ' text-right'}>{f.pax}</td>
                <td className={TD + ' text-right'}>{formatMonto(f.ventas, f.moneda)}</td>
                <td className={TD + ' text-right'}>{formatMonto(f.sena, f.moneda)}</td>
                <td className={TD + ' text-right'}>{formatMonto(f.costo, f.moneda)}</td>
                <td className={TD + ` text-right font-semibold ${f.margen < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatMonto(f.margen, f.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Seccion titulo="Comisiones por vendedor" nota="Es la seña de cada venta (por fecha de venta). La cobra el vendedor, por eso ya está pagada."
          vacio={vendedores.length === 0 ? 'No hay ventas en este período.' : null}>
          <table className="w-full">
            <thead><tr className="text-left"><th className={TH}>Vendedor</th><th className={TH + ' text-right'}>Ventas</th><th className={TH + ' text-right'}>Vendido</th><th className={TH + ' text-right'}>Comisión (seña)</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {vendedores.map(f => (
                <tr key={f.vendedor + f.moneda}>
                  <td className={TD + ' font-medium text-gray-800 dark:text-zinc-200'}>{f.vendedor}</td>
                  <td className={TD + ' text-right'}>{f.ventas}</td>
                  <td className={TD + ' text-right'}>{formatMonto(f.total, f.moneda)}</td>
                  <td className={TD + ' text-right font-semibold'}>{formatMonto(f.sena, f.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>

        <Seccion titulo="Comisiones por chofer" nota="Se devenga por paseo confirmado o completado. Al liquidar queda un egreso en Movimientos."
          vacio={choferes.length === 0 ? 'No hay comisiones de chofer cargadas en este período.' : null}>
          <table className="w-full">
            <thead><tr className="text-left"><th className={TH}>Chofer</th><th className={TH + ' text-right'}>Paseos</th><th className={TH + ' text-right'}>Devengado</th><th className={TH + ' text-right'}>Pagado</th><th className={TH + ' text-right'}>Por pagar</th><th className={TH}></th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {choferes.map(f => {
                const clave = f.chofer + f.moneda
                return (
                  <tr key={clave}>
                    <td className={TD + ' font-medium text-gray-800 dark:text-zinc-200'}>{f.chofer}</td>
                    <td className={TD + ' text-right'}>{f.paseos}</td>
                    <td className={TD + ' text-right'}>{formatMonto(f.devengado, f.moneda)}</td>
                    <td className={TD + ' text-right'}>{formatMonto(f.pagado, f.moneda)}</td>
                    <td className={TD + ` text-right font-semibold ${f.porPagar > 0 ? 'text-red-500 dark:text-red-400' : ''}`}>{formatMonto(f.porPagar, f.moneda)}</td>
                    <td className={TD + ' text-right whitespace-nowrap'}>
                      {f.porPagar > 0 && f.chofer !== 'Sin chofer' && (confirmando === clave ? (
                        <span className="text-xs">
                          <button disabled={liquidando} onClick={() => liquidar(f)} className="font-semibold text-green-600 dark:text-green-400 disabled:opacity-50">{liquidando ? 'Pagando...' : 'Confirmar pago'}</button>
                          <span className="mx-1 text-gray-300 dark:text-zinc-700">/</span>
                          <button disabled={liquidando} onClick={() => setConfirmando(null)} className="text-gray-400 dark:text-zinc-500">Cancelar</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmando(clave)} className="text-xs font-semibold px-2.5 py-1 rounded-full border border-brand-300 dark:border-brand-800 text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40">Liquidar</button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Seccion>
      </div>
    </div>
  )
}

function ListaCobros({ lista, resto }) {
  return (
    <div>
      <ul className="divide-y divide-gray-50 dark:divide-zinc-800">
        {lista.map(r => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 dark:text-zinc-200 truncate">{r.cliente_nombre}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{nombrePaseo(r)} · {fechaCorta(r.fecha)}</p>
            </div>
            <span className="font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">{formatMonto(saldoDe(r), r.moneda)}</span>
          </li>
        ))}
      </ul>
      {resto > 0 && <p className="px-5 pt-2 text-xs text-gray-400 dark:text-zinc-500">y {resto} más</p>}
      <p className="px-5 pt-2"><Link to="/admin/reservas" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Abrir Reservas</Link></p>
    </div>
  )
}
