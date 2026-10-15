import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { viajesPaquetesApi, leadsApi, clientesApi } from '../../../lib/supabase.js'
import FichaPersona from '../../../components/ficha/FichaPersona.jsx'
import { confirmar } from '../../../components/ui/Avisos.jsx'
import { IcGrande } from '../../../components/admin/dashboard/Ic.jsx'
import { formatMonto, fechaCorta, claveTexto } from '../../../lib/reservasPlanilla.js'

// Viajes de paquetes con las mismas columnas que la planilla de Excel del equipo de
// paquetes ("PLANILLA VIAJES"), para que carguen acá en vez de en el Excel. Las dos
// pestañas del Excel (VIAJES y YA SE FUERON) son acá dos vistas de la misma lista: un
// viaje "ya se fue" cuando pasó su fecha de regreso. Columnas: migración
// 20261015100000_viajes_paquetes_planilla.sql. Cada viaje se une solo a su lead y cliente
// por el teléfono, y su saldo, hospedaje y vuelos quedan en la ficha (ver
// 20261015120000_viajes_paquetes_vinculos.sql): el nombre abre esa ficha.

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' })
const yaSeFue = (v) => (v.fecha_regreso || v.fecha_llegada || '9999') < hoy()

const VACIO = {
  hora_llegada: '', fecha_llegada: '', cliente_nombre: '', personas: '', hospedaje: '',
  fecha_regreso: '', hora_regreso: '', saldo: '', moneda: 'BRL', llave_pix: '',
  observaciones: '', contacto_hospedaje: '', detalles_texto: '', detalles_url: '',
  cliente_contacto: '', info_extra: '',
}

const INPUT = 'w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1'
const aNumero = (v) => (String(v ?? '').trim() === '' ? null : Number(String(v).replace(',', '.')))

// Número de un contacto escrito a mano ("+54 9 11 6978-5885"); con más de un número
// ("Carolina: +54… | Julieta: +34…") o sin número, null
function numeroContacto(t) {
  const partes = String(t || '').split(/[|/]/)
  if (partes.length !== 1) return null
  const n = String(t).replace(/\D/g, '')
  return n.length >= 10 && n.length <= 15 ? n : null
}

export default function PlanillaViajes() {
  const [viajes, setViajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [vista, setVista] = useState('proximos') // 'proximos' | 'pasados'
  const [busqueda, setBusqueda] = useState('')
  const [soloSaldo, setSoloSaldo] = useState(false)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | viaje
  const [ficha, setFicha] = useState(null) // { lead } | { cliente }
  const navigate = useNavigate()

  // El contacto abre el chat del cliente en el CRM (no WhatsApp). Si el viaje está unido a
  // un lead o cliente se usa su número tal como está en el CRM (el de la planilla puede
  // venir escrito distinto, ej. con o sin el 9 de los celulares argentinos).
  async function abrirChat(v) {
    let numero = null
    if (v.lead_id) numero = (await leadsApi.getById(v.lead_id))?.data?.whatsapp
    if (!numero && v.cliente_id) numero = (await clientesApi.getById(v.cliente_id))?.data?.whatsapp
    numero = numero || numeroContacto(v.cliente_contacto)
    if (numero) navigate(`/admin/crm/whatsapp?phone=${String(numero).replace(/\D/g, '')}`)
  }

  function cargar() {
    return viajesPaquetesApi.getAll().then(({ data, error }) => {
      if (error) setErrorCarga(error.message)
      setViajes(data || [])
      setLoading(false)
    })
  }
  useEffect(() => { cargar() }, [])

  async function abrirFicha(v) {
    if (v.lead_id) {
      const { data } = await leadsApi.getById(v.lead_id)
      if (data) return setFicha({ lead: data })
    }
    if (v.cliente_id) {
      const { data } = await clientesApi.getById(v.cliente_id)
      if (data) setFicha({ cliente: data })
    }
  }

  const filtrados = useMemo(() => {
    const q = claveTexto(busqueda)
    const lista = viajes.filter(v => (vista === 'pasados') === yaSeFue(v))
      .filter(v => !soloSaldo || Number(v.saldo) > 0)
      .filter(v => !q || [v.cliente_nombre, v.hospedaje, v.cliente_contacto, v.observaciones, v.llave_pix]
        .some(x => claveTexto(x).includes(q)))
    // Próximos: el que llega antes, primero. Ya se fueron: el más reciente, primero.
    return vista === 'pasados' ? lista.reverse() : lista
  }, [viajes, vista, busqueda, soloSaldo])

  const cantidades = useMemo(() => ({
    proximos: viajes.filter(v => !yaSeFue(v)).length,
    pasados: viajes.filter(yaSeFue).length,
  }), [viajes])

  const enCurso = filtrados.filter(v => v.fecha_llegada && v.fecha_llegada <= hoy() && !yaSeFue(v)).length
  const saldoPendiente = filtrados.reduce((a, v) => a + (Number(v.saldo) > 0 ? Number(v.saldo) : 0), 0)

  async function guardar(datos) {
    const { error } = editando === 'nuevo'
      ? await viajesPaquetesApi.create(datos)
      : await viajesPaquetesApi.update(editando.id, datos)
    if (error) return error.message
    // Se relee todo: al guardar, la base lo une a su ficha por el teléfono
    await cargar()
    setEditando(null)
    return null
  }

  async function marcarCobrado(v) {
    const { error } = await viajesPaquetesApi.update(v.id, { saldo: 0 })
    if (!error) setViajes(prev => prev.map(x => x.id === v.id ? { ...x, saldo: 0 } : x))
  }

  async function eliminar(v) {
    if (!await confirmar(`¿Eliminar el viaje de ${v.cliente_nombre}?`)) return
    const { error } = await viajesPaquetesApi.delete(v.id)
    if (!error) setViajes(prev => prev.filter(x => x.id !== v.id))
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando viajes...</div>

  const th = 'px-3 py-2.5 text-left font-semibold whitespace-nowrap'
  const td = 'px-3 py-2 align-top'

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Planilla de viajes</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">Paquetes · {viajes.length} viajes en total</p>
        </div>
        <button onClick={() => setEditando('nuevo')}
          className="flex items-center gap-2 text-sm font-semibold text-white dark:text-zinc-900 bg-brand-600 dark:bg-zinc-100 rounded-xl px-4 py-2 hover:bg-brand-700 dark:hover:bg-zinc-200 transition-colors shadow-sm">
          <span className="text-base leading-none">+</span> Nuevo viaje
        </button>
      </div>

      {errorCarga && <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-xl px-4 py-3">No se pudieron cargar los viajes: {errorCarga}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Viajes', value: filtrados.length },
          { label: 'Pasajeros', value: filtrados.reduce((a, v) => a + (v.personas || 0), 0) },
          ...(vista === 'proximos' ? [{ label: 'De viaje ahora', value: enCurso }] : []),
          { label: 'Saldo a cobrar', value: formatMonto(saldoPendiente) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-2xl p-3.5 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mb-1">{label}</p>
            <p className="text-base font-bold text-gray-900 dark:text-zinc-100 leading-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[['proximos', 'Viajes'], ['pasados', 'Ya se fueron']].map(([k, label]) => (
          <button key={k} onClick={() => setVista(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${vista === k ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
            {label} <span className="opacity-60">{cantidades[k]}</span>
          </button>
        ))}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente, hospedaje, teléfono…"
          className="ml-auto border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
          <input type="checkbox" checked={soloSaldo} onChange={e => setSoloSaldo(e.target.checked)}
            className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-400" />
          Con saldo
        </label>
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-zinc-500">
          <IcGrande n="file" />
          <p>No hay viajes{(busqueda || soloSaldo) ? ' con estos filtros' : ''}.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] sticky top-0 z-10">
              <tr>
                <th className={th}>Hora llegada</th>
                <th className={th}>Fecha de viaje</th>
                <th className={th}>Cliente</th>
                <th className={th}>Cant.</th>
                <th className={th}>Hospedaje</th>
                <th className={th}>Fecha regreso</th>
                <th className={th}>Hora regreso</th>
                <th className={th}>Saldo</th>
                <th className={th}>Llave PIX</th>
                <th className={th}>Observaciones</th>
                <th className={th}>Contacto hospedaje</th>
                <th className={th}>Detalles y servicios</th>
                <th className={th}>Contacto cliente</th>
                <th className={th}>Info extra</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800 text-gray-700 dark:text-zinc-300">
              {filtrados.map(v => {
                const saldo = Number(v.saldo)
                const conChat = !!(v.lead_id || v.cliente_id || numeroContacto(v.cliente_contacto))
                const enViaje = v.fecha_llegada && v.fecha_llegada <= hoy() && !yaSeFue(v)
                return (
                  <tr key={v.id} onDoubleClick={() => setEditando(v)} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                    <td className={td + ' whitespace-nowrap'}>{v.hora_llegada || '—'}</td>
                    <td className={td + ' whitespace-nowrap font-medium'}>
                      {fechaCorta(v.fecha_llegada)}
                      {enViaje && <span className="ml-1.5 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">De viaje</span>}
                    </td>
                    <td className={td + ' font-medium text-gray-900 dark:text-zinc-100 min-w-[140px]'}>
                      {v.lead_id || v.cliente_id
                        ? <button onClick={() => abrirFicha(v)} title="Abrir la ficha del cliente" className="text-left font-medium hover:underline">{v.cliente_nombre}</button>
                        : <>{v.cliente_nombre} <span title="No hay ningún lead ni cliente con este teléfono" className="ml-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400 whitespace-nowrap">Sin ficha</span></>}
                    </td>
                    <td className={td + ' text-center'}>{v.personas ?? '—'}</td>
                    <td className={td + ' min-w-[180px] max-w-[280px]'}>{v.hospedaje || '—'}</td>
                    <td className={td + ' whitespace-nowrap'}>{fechaCorta(v.fecha_regreso)}</td>
                    <td className={td + ' whitespace-nowrap'}>{v.hora_regreso || '—'}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      {v.saldo == null ? '—' : (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${saldo > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatMonto(saldo, v.moneda)}</span>
                          {saldo > 0 && (
                            <button onClick={() => marcarCobrado(v)} title="El cliente pagó el saldo"
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/40">
                              Cobrado
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={td + ' min-w-[160px] max-w-[240px] text-gray-500 dark:text-zinc-400'}>{v.llave_pix || '—'}</td>
                    <td className={td + ' min-w-[200px] max-w-[320px] text-gray-500 dark:text-zinc-400'}><p className="line-clamp-3" title={v.observaciones || ''}>{v.observaciones || '—'}</p></td>
                    <td className={td + ' min-w-[120px]'}>{v.contacto_hospedaje || '—'}</td>
                    <td className={td + ' min-w-[160px] max-w-[240px]'}>
                      {v.detalles_url
                        ? <a href={v.detalles_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">{/^https?:/.test(v.detalles_texto || '') || !v.detalles_texto ? 'Ver detalles' : v.detalles_texto}</a>
                        : (v.detalles_texto || '—')}
                    </td>
                    <td className={td + ' whitespace-nowrap'}>
                      {conChat && v.cliente_contacto
                        ? <button onClick={() => abrirChat(v)} title="Abrir el chat en el CRM" className="text-left text-green-600 dark:text-green-400 hover:underline">{v.cliente_contacto}</button>
                        : (v.cliente_contacto || '—')}
                    </td>
                    <td className={td + ' min-w-[100px]'}>{v.info_extra || '—'}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      <button onClick={() => setEditando(v)} className="text-brand-600 dark:text-brand-400 hover:underline font-medium mr-3">Editar</button>
                      <button onClick={() => eliminar(v)} title="Eliminar" className="text-gray-300 dark:text-zinc-600 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {ficha && (
        <FichaPersona {...ficha} onCerrar={() => { setFicha(null); cargar() }} />
      )}

      {editando && (
        <ModalViaje viaje={editando === 'nuevo' ? null : editando} onGuardar={guardar} onCerrar={() => setEditando(null)} />
      )}
    </div>
  )
}

function ModalViaje({ viaje, onGuardar, onCerrar }) {
  const [form, setForm] = useState(() => viaje
    ? Object.fromEntries(Object.keys(VACIO).map(k => [k, viaje[k] == null ? VACIO[k] : String(viaje[k])]))
    : { ...VACIO })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setError('') }

  async function guardar(e) {
    e.preventDefault()
    const falta = !form.cliente_nombre.trim() ? 'Falta el nombre del cliente.'
      : !form.fecha_llegada ? 'Falta la fecha de viaje.'
      : form.fecha_regreso && form.fecha_regreso < form.fecha_llegada ? 'La fecha de regreso es anterior a la de viaje.'
      : [form.saldo, form.personas].some(v => String(v).trim() && Number.isNaN(aNumero(v))) ? 'Revisá la cantidad y el saldo: solo números.'
      : null
    if (falta) { setError(falta); return }
    const datos = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v).trim() === '' ? null : String(v).trim()]))
    datos.saldo = aNumero(form.saldo)
    datos.personas = form.personas ? parseInt(form.personas, 10) : null
    datos.moneda = form.moneda || 'BRL'
    setGuardando(true)
    const err = await onGuardar(datos)
    setGuardando(false)
    if (err) setError(err)
  }

  const campo = (k, label, props = {}) => (
    <div className={props.ancho ? 'sm:col-span-2' : ''}>
      <label className={LABEL}>{label}</label>
      {props.area
        ? <textarea rows={3} value={form[k]} onChange={e => set(k, e.target.value)} className={INPUT} />
        : <input type={props.type || 'text'} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={props.placeholder} inputMode={props.inputMode} className={INPUT} />}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <form onSubmit={guardar} onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4">{viaje ? 'Editar viaje' : 'Nuevo viaje'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campo('cliente_nombre', 'Nombre del cliente', { ancho: true })}
          {campo('fecha_llegada', 'Fecha de viaje', { type: 'date' })}
          {campo('hora_llegada', 'Hora de llegada', { placeholder: '09:55' })}
          {campo('fecha_regreso', 'Fecha de regreso', { type: 'date' })}
          {campo('hora_regreso', 'Hora de regreso', { placeholder: '11:00' })}
          {campo('personas', 'Cantidad de personas', { inputMode: 'numeric' })}
          <div>
            <label className={LABEL}>Saldo</label>
            <div className="flex gap-2">
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className={INPUT + ' w-24'}>
                <option value="BRL">R$</option>
                <option value="USD">US$</option>
              </select>
              <input value={form.saldo} onChange={e => set('saldo', e.target.value)} inputMode="decimal" className={INPUT} />
            </div>
          </div>
          {campo('hospedaje', 'Hospedaje', { ancho: true })}
          {campo('llave_pix', 'Llave PIX', { ancho: true, placeholder: 'A quién se le paga el hospedaje' })}
          {campo('contacto_hospedaje', 'Contacto del hospedaje')}
          {campo('cliente_contacto', 'Contacto del cliente')}
          {campo('detalles_texto', 'Detalles y servicios (nombre)')}
          {campo('detalles_url', 'Detalles y servicios (link)', { placeholder: 'https://canva.link/…' })}
          {campo('observaciones', 'Observaciones', { ancho: true, area: true })}
          {campo('info_extra', 'Información extra', { ancho: true })}
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCerrar} className="text-sm px-4 py-2 rounded-xl text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button type="submit" disabled={guardando}
            className="text-sm font-semibold px-4 py-2 rounded-xl text-white dark:text-zinc-900 bg-brand-600 dark:bg-zinc-100 hover:bg-brand-700 dark:hover:bg-zinc-200 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
