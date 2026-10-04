import { useEffect, useState } from 'react'
import { anfitrionaApi } from '../../lib/supabase.js'
import Ic from '../admin/dashboard/Ic.jsx'
import { avisar, confirmar } from '../ui/Avisos.jsx'

export const CONCEPTOS_SALDO = [
  { id: 'hospedaje', label: 'Hospedaje' },
  { id: 'traslados', label: 'Traslados' },
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'otros', label: 'Otros servicios' },
]

// Datos que tiene que tener cada hospedaje para estar OK (para pagar el saldo y
// coordinar la llegada). Lo usan la ficha y la tarjeta del embudo.
export function faltantesHospedaje(h) {
  const falta = []
  if (!h.proveedor?.trim()) falta.push('proveedor')
  if (!h.contacto?.trim()) falta.push('contacto')
  if (!h.pix?.trim()) falta.push('PIX')
  return falta
}

const CAMPO = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'
const ETIQUETA = 'mb-1 block text-[11px] font-medium text-gray-500 dark:text-zinc-400'
const BOTON_SECUNDARIO = 'text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-100'

const VACIO_HOSPEDAJE = { nombre: '', proveedor: '', contacto: '', pix: '', fecha_checkin: '', fecha_checkout: '' }

function reales(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fechaCorta(fecha) {
  return fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

function aNumero(valor) {
  return Number(String(valor).replace(',', '.')) || 0
}

export default function AnfitrionaDatos({ lead, hospedajes, setHospedajes }) {
  const propios = hospedajes.filter(h => h.lead_id === lead.id)
  return (
    <div className="space-y-6">
      <SeccionHospedajes key={`h-${lead.id}`} leadId={lead.id} propios={propios} setHospedajes={setHospedajes} />
      <SeccionSaldos key={`s-${lead.id}`} leadId={lead.id} />
    </div>
  )
}

function SeccionHospedajes({ leadId, propios, setHospedajes }) {
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function setCampo(campo, valor) {
    setEditando(e => ({ ...e, form: { ...e.form, [campo]: valor } }))
  }

  async function guardar() {
    const f = editando.form
    if (!f.nombre.trim()) return avisar('Ponele un nombre al hospedaje (hotel o departamento).')
    const datos = {
      nombre: f.nombre.trim(),
      proveedor: f.proveedor.trim() || null,
      contacto: f.contacto.trim() || null,
      pix: f.pix.trim() || null,
      fecha_checkin: f.fecha_checkin || null,
      fecha_checkout: f.fecha_checkout || null,
    }
    setGuardando(true)
    const res = editando.id
      ? await anfitrionaApi.updateHospedaje(editando.id, datos)
      : await anfitrionaApi.createHospedaje({ ...datos, lead_id: leadId })
    setGuardando(false)
    if (res?.error || !res?.data) return avisar('No se pudo guardar el hospedaje: ' + (res?.error?.message || 'error desconocido'))
    const fila = res.data
    setHospedajes(prev => editando.id ? prev.map(h => h.id === fila.id ? fila : h) : [...prev, fila])
    setEditando(null)
  }

  async function eliminar(h) {
    if (!await confirmar(`¿Eliminar el hospedaje ${h.nombre}? Su alarma de cobro también se pierde.`)) return
    const res = await anfitrionaApi.deleteHospedaje(h.id)
    if (res?.error) return avisar('No se pudo eliminar el hospedaje: ' + res.error.message)
    setHospedajes(prev => prev.filter(x => x.id !== h.id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Hospedajes</p>
        {!editando && (
          <button onClick={() => setEditando({ id: null, form: { ...VACIO_HOSPEDAJE } })} className={BOTON_SECUNDARIO}>
            + Agregar hospedaje
          </button>
        )}
      </div>

      {propios.length === 0 && !editando && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">Todavía no hay hospedajes cargados.</p>
      )}

      {propios.map(h => {
        const falta = faltantesHospedaje(h)
        if (editando?.id === h.id) return <FormularioHospedaje key={h.id} editando={editando} setCampo={setCampo} guardar={guardar} guardando={guardando} cancelar={() => setEditando(null)} />
        return (
          <div key={h.id} className="rounded-xl border border-gray-100 p-3 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{h.nombre}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {fechaCorta(h.fecha_checkin) ? `Check-in ${fechaCorta(h.fecha_checkin)}` : 'Sin fecha de check-in'}
                  {fechaCorta(h.fecha_checkout) ? ` · Check-out ${fechaCorta(h.fecha_checkout)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {falta.length === 0
                  ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">OK</span>
                  : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Falta {falta.join(', ')}</span>}
                <button onClick={() => setEditando({ id: h.id, form: { nombre: h.nombre || '', proveedor: h.proveedor || '', contacto: h.contacto || '', pix: h.pix || '', fecha_checkin: h.fecha_checkin || '', fecha_checkout: h.fecha_checkout || '' } })}
                  title="Editar hospedaje" className="text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200">
                  <Ic n="pencil" className="h-4 w-4" />
                </button>
                <button onClick={() => eliminar(h)} title="Eliminar hospedaje" className="text-gray-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400">
                  <Ic n="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-gray-400 dark:text-zinc-500">Proveedor</p><p className="truncate text-gray-800 dark:text-zinc-200">{h.proveedor || '–'}</p></div>
              <div><p className="text-gray-400 dark:text-zinc-500">Contacto</p><p className="truncate text-gray-800 dark:text-zinc-200">{h.contacto || '–'}</p></div>
              <div><p className="text-gray-400 dark:text-zinc-500">PIX</p><p className="truncate text-gray-800 dark:text-zinc-200">{h.pix || '–'}</p></div>
            </div>
          </div>
        )
      })}

      {editando && editando.id === null && (
        <FormularioHospedaje editando={editando} setCampo={setCampo} guardar={guardar} guardando={guardando} cancelar={() => setEditando(null)} />
      )}
    </div>
  )
}

function FormularioHospedaje({ editando, setCampo, guardar, guardando, cancelar }) {
  const f = editando.form
  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div>
        <label className={ETIQUETA}>Nombre del hospedaje</label>
        <input value={f.nombre} onChange={e => setCampo('nombre', e.target.value)} placeholder="Ej: Hotel Porto da Barra" className={CAMPO} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA}>Proveedor</label>
          <input value={f.proveedor} onChange={e => setCampo('proveedor', e.target.value)} placeholder="Dueño o empresa" className={CAMPO} />
        </div>
        <div>
          <label className={ETIQUETA}>Contacto</label>
          <input value={f.contacto} onChange={e => setCampo('contacto', e.target.value)} placeholder="WhatsApp o teléfono" className={CAMPO} />
        </div>
        <div>
          <label className={ETIQUETA}>PIX</label>
          <input value={f.pix} onChange={e => setCampo('pix', e.target.value)} placeholder="Llave PIX para el pago" className={CAMPO} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={ETIQUETA}>Check-in</label>
            <input type="date" value={f.fecha_checkin} onChange={e => setCampo('fecha_checkin', e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label className={ETIQUETA}>Check-out</label>
            <input type="date" value={f.fecha_checkout} onChange={e => setCampo('fecha_checkout', e.target.value)} className={CAMPO} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={cancelar} className={BOTON_SECUNDARIO}>Cancelar</button>
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {guardando ? 'Guardando...' : 'Guardar hospedaje'}
        </button>
      </div>
    </div>
  )
}

function SeccionSaldos({ leadId }) {
  const [saldos, setSaldos] = useState([])

  useEffect(() => {
    anfitrionaApi.getSaldos(leadId).then(res => { if (res?.data) setSaldos(res.data) })
  }, [leadId])

  const total = saldos.reduce((s, x) => s + Number(x.monto || 0), 0)
  const pagado = saldos.reduce((s, x) => s + Number(x.pagado || 0), 0)

  async function agregar() {
    const res = await anfitrionaApi.createSaldo({ lead_id: leadId, concepto: 'hospedaje', descripcion: '', monto: 0, pagado: 0 })
    if (res?.error || !res?.data) return avisar('No se pudo agregar el saldo: ' + (res?.error?.message || 'error desconocido'))
    setSaldos(prev => [...prev, res.data])
  }

  function cambiarLocal(id, cambios) {
    setSaldos(prev => prev.map(s => s.id === id ? { ...s, ...cambios } : s))
  }

  async function guardarCambio(id, cambios) {
    const res = await anfitrionaApi.updateSaldo(id, cambios)
    if (res?.error) avisar('No se pudo guardar el saldo: ' + res.error.message)
  }

  async function eliminar(s) {
    if (!await confirmar('¿Eliminar este saldo?')) return
    const res = await anfitrionaApi.deleteSaldo(s.id)
    if (res?.error) return avisar('No se pudo eliminar el saldo: ' + res.error.message)
    setSaldos(prev => prev.filter(x => x.id !== s.id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Saldos</p>
        <button onClick={agregar} className={BOTON_SECUNDARIO}>+ Agregar saldo</button>
      </div>

      {saldos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-xs dark:bg-zinc-800/60">
          <div><p className="text-gray-400 dark:text-zinc-500">Total</p><p className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{reales(total)}</p></div>
          <div><p className="text-gray-400 dark:text-zinc-500">Pagado</p><p className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{reales(pagado)}</p></div>
          <div><p className="text-gray-400 dark:text-zinc-500">Pendiente</p><p className={`font-semibold tabular-nums ${total - pagado > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{reales(total - pagado)}</p></div>
        </div>
      )}

      {saldos.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">Sin saldos cargados. Agregalos a mano según el presupuesto del cliente.</p>
      )}

      {saldos.map(s => (
        <div key={s.id} className="space-y-2 rounded-xl border border-gray-100 p-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <select value={s.concepto} onChange={e => { cambiarLocal(s.id, { concepto: e.target.value }); guardarCambio(s.id, { concepto: e.target.value }) }}
              className="shrink-0 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              {CONCEPTOS_SALDO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <input value={s.descripcion || ''} placeholder="Descripción (ej: 3 noches, traslado ida)"
              onChange={e => cambiarLocal(s.id, { descripcion: e.target.value })}
              onBlur={e => guardarCambio(s.id, { descripcion: e.target.value.trim() || null })}
              className={`${CAMPO} py-1.5`} />
            <button onClick={() => eliminar(s)} title="Eliminar saldo" className="shrink-0 text-gray-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400">
              <Ic n="trash" className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={ETIQUETA}>Monto (R$)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={s.monto}
                onChange={e => cambiarLocal(s.id, { monto: e.target.value })}
                onBlur={e => guardarCambio(s.id, { monto: Math.max(0, aNumero(e.target.value)) })}
                className={`${CAMPO} py-1.5 tabular-nums`} />
            </div>
            <div>
              <label className={ETIQUETA}>Pagado (R$)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={s.pagado}
                onChange={e => cambiarLocal(s.id, { pagado: e.target.value })}
                onBlur={e => guardarCambio(s.id, { pagado: Math.max(0, aNumero(e.target.value)) })}
                className={`${CAMPO} py-1.5 tabular-nums`} />
            </div>
            <div>
              <p className={ETIQUETA}>Pendiente</p>
              <p className={`py-1.5 text-sm font-semibold tabular-nums ${Number(s.monto) - Number(s.pagado) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {reales(Number(s.monto) - Number(s.pagado))}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
