import { useState, useEffect, useMemo } from 'react'
import { choferesApi, guiasApi, vendedoresApi, excursionesApi } from '../../lib/supabase.js'
import Ic, { IcGrande, IcTxt } from '../../components/admin/dashboard/Ic.jsx'

const TABS = [
  { id: 'choferes',   label: 'Choferes',   icono: 'car', api: choferesApi },
  { id: 'guias',      label: 'Guías',      icono: 'compass', api: guiasApi },
  { id: 'vendedores', label: 'Vendedores', icono: 'briefcase', api: vendedoresApi },
]

const EMPTY = { nombre: '', whatsapp: '', codigo_referido: '', capacidad: '', notas: '' }
const INPUT_F = 'w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const aNumero = (v) => (String(v).trim() === '' ? NaN : Number(String(v).replace(',', '.')))

const LABELS = { choferes: 'chofer', guias: 'guía', vendedores: 'vendedor' }

export default function Equipo() {
  const [tabActiva, setTabActiva] = useState('choferes')
  const [datos, setDatos] = useState({ choferes: [], guias: [], vendedores: [] })
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState('tarjetas')
  const [form, setForm] = useState(EMPTY)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [copiadoId, setCopiadoId] = useState(null)
  // Choferes: tarifa propia por paseo (por viaje, no por pasajero), { excursion_id: 'texto' }
  const [paseos, setPaseos] = useState([])
  const [tarifas, setTarifas] = useState({})
  const [errorForm, setErrorForm] = useState('')
  const nombrePaseo = useMemo(() => Object.fromEntries(paseos.map((p) => [p.id, p.nombre])), [paseos])
  const resumenTarifas = (item) => Object.entries(item.tarifas || {}).filter(([id]) => nombrePaseo[id])
    .map(([id, v]) => `${nombrePaseo[id]} R$ ${Number(v).toLocaleString('es-AR')}`).join(' · ')

  // El link personal (sin contraseña) donde guías y choferes ven los avisos de sus
  // operaciones: /guia/<token> o /chofer/<token>. Vendedores no tiene esto.
  function copiarLink(item) {
    const ruta = tabActiva === 'guias' ? 'guia' : 'chofer'
    navigator.clipboard.writeText(`${window.location.origin}/${ruta}/${item.token}`)
    setCopiadoId(item.id)
    setTimeout(() => setCopiadoId((id) => (id === item.id ? null : id)), 2000)
  }

  const tab = TABS.find((t) => t.id === tabActiva)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [rc, rg, rv, rp] = await Promise.all([
      choferesApi.getAll(),
      guiasApi.getAll(),
      vendedoresApi.getAll(),
      excursionesApi.getAll(),
    ])
    setPaseos((rp?.data || []).filter((e) => e.categoria === 'excursiones'))
    setDatos({
      choferes:   rc.data || [],
      guias:      rg.data || [],
      vendedores: rv.data || [],
    })
    setCargando(false)
  }

  async function cargarTab() {
    const { data } = await tab.api.getAll()
    setDatos((prev) => ({ ...prev, [tabActiva]: data || [] }))
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setTarifas({})
    setErrorForm('')
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(item) {
    setForm({
      nombre: item.nombre, whatsapp: item.whatsapp || '', codigo_referido: item.codigo_referido || '',
      capacidad: item.capacidad != null ? String(item.capacidad) : '', notas: item.notas || '',
    })
    setTarifas(Object.fromEntries(Object.entries(item.tarifas || {}).map(([k, v]) => [k, String(v)])))
    setErrorForm('')
    setEditando(item.id)
    setMostrarForm(true)
  }

  async function guardar() {
    const esChofer = tabActiva === 'choferes'
    // El WhatsApp de un chofer puede quedar vacío y completarse después
    if (!form.nombre.trim() || (!esChofer && !form.whatsapp.trim())) return
    let datos = { nombre: form.nombre.trim(), whatsapp: form.whatsapp.trim() }
    if (tabActiva === 'vendedores') datos.codigo_referido = form.codigo_referido
    if (esChofer) {
      const cap = aNumero(form.capacidad)
      if (String(form.capacidad).trim() !== '' && (Number.isNaN(cap) || cap < 1)) { setErrorForm('Los pasajeros que entran tienen que ser un número.'); return }
      const t = {}
      for (const [id, v] of Object.entries(tarifas)) {
        if (String(v).trim() === '') continue
        const n = aNumero(v)
        if (Number.isNaN(n) || n < 0) { setErrorForm(`Revisá la tarifa de ${nombrePaseo[id] || 'un paseo'}: solo números.`); return }
        t[id] = n
      }
      datos = { ...datos, capacidad: String(form.capacidad).trim() === '' ? null : Math.round(cap), notas: form.notas.trim() || null, tarifas: t }
    }
    setGuardando(true)
    const { error } = (editando ? await tab.api.update(editando, datos) : await tab.api.create(datos)) || {}
    setGuardando(false)
    if (error) { setErrorForm('No se pudo guardar: ' + error.message); return }
    setMostrarForm(false)
    cargarTab()
  }

  async function toggleActivo(item) {
    await tab.api.update(item.id, { activo: !item.activo })
    cargarTab()
  }

  const lista = datos[tabActiva] || []
  const filtrados = lista.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.whatsapp.includes(busqueda)
  )

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Equipo</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">Gestioná choferes, guías y vendedores</p>
        </div>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTabActiva(t.id); abrirNuevo() }}
              className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors border ${
                tabActiva === t.id
                  ? 'bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-700 text-white border-transparent'
                  : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700'
              }`}
            >
              + Agregar {LABELS[t.id]}
            </button>
          ))}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-1.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTabActiva(t.id); setBusqueda('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tabActiva === t.id
                ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Ic n={t.icono} className="h-4 w-4" />{t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tabActiva === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'}`}>
              {datos[t.id]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Buscador + toggle de vista */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder={`Buscar ${tab.label.toLowerCase()} por nombre o WhatsApp...`}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="flex gap-2 shrink-0">
          {['tarjetas', 'lista'].map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                vista === v
                  ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas / Lista */}
      {cargando ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-600">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-600">
          <IcGrande n={tab.icono} />
          <p className="font-medium">No hay {tab.label.toLowerCase()} registrados.</p>
          <button onClick={abrirNuevo} className="mt-4 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium underline">
            Agregar el primero
          </button>
        </div>
      ) : vista === 'lista' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800 text-left text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">WhatsApp</th>
                {tabActiva === 'vendedores' && <th className="px-5 py-3 font-medium">Código</th>}
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 dark:border-zinc-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-zinc-100">
                    <IcTxt n={tab.icono} />{item.nombre}
                    {tabActiva === 'choferes' && (item.capacidad || resumenTarifas(item)) && (
                      <p className="text-xs font-normal text-gray-500 dark:text-zinc-400 mt-0.5">{[item.capacidad ? `${item.capacidad} pasajeros` : null, resumenTarifas(item)].filter(Boolean).join(' · ')}</p>
                    )}
                    {tabActiva === 'choferes' && item.notas && <p className="text-xs font-normal italic text-gray-400 dark:text-zinc-500 mt-0.5">{item.notas}</p>}
                  </td>
                  <td className="px-5 py-3">
                    {item.whatsapp ? (
                      <a
                        href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium inline-flex items-center gap-1"
                      >
                        <IcTxt n="chat" />{item.whatsapp}
                      </a>
                    ) : <span className="text-xs text-amber-600 dark:text-amber-400">Falta el WhatsApp</span>}
                  </td>
                  {tabActiva === 'vendedores' && (
                    <td className="px-5 py-3">
                      {item.codigo_referido ? (
                        <span className="text-xs font-bold font-mono text-brand-700 dark:text-brand-400 tracking-wider bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-800 rounded-lg px-2 py-0.5">
                          {item.codigo_referido}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-400 dark:text-orange-400">Sin código</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActivo(item)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}
                    >
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => abrirEditar(item)}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
                      >
                        Editar
                      </button>
                      {(tabActiva === 'choferes' || tabActiva === 'guias') && (
                        <button
                          onClick={() => copiarLink(item)}
                          title="Link personal del chat interno de operaciones"
                          className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium inline-flex items-center gap-1"
                        >
                          <IcTxt n="clip" />{copiadoId === item.id ? 'Copiado' : 'Copiar link'}
                        </button>
                      )}
                      {item.whatsapp && (
                        <a
                          href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${item.nombre} 👋`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((item) => (
            <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-zinc-100"><IcTxt n={tab.icono} />{item.nombre}</p>
                  {item.whatsapp ? (
                    <a
                      href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium mt-0.5 inline-flex items-center gap-1"
                    >
                      <IcTxt n="chat" />{item.whatsapp}
                    </a>
                  ) : <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Falta el WhatsApp</p>}
                  {tabActiva === 'choferes' && (item.auto_modelo || item.capacidad) && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{[item.auto_modelo, item.capacidad ? `${item.capacidad} pasajeros` : null].filter(Boolean).join(' · ')}</p>
                  )}
                  {tabActiva === 'choferes' && resumenTarifas(item) && (
                    <p className="text-xs text-gray-600 dark:text-zinc-300 mt-1">{resumenTarifas(item)}</p>
                  )}
                  {tabActiva === 'choferes' && item.notas && <p className="text-xs italic text-gray-400 dark:text-zinc-500 mt-1">{item.notas}</p>}
                  {tabActiva === 'vendedores' && item.codigo_referido && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-800 rounded-lg px-2.5 py-1">
                      <span className="text-xs text-gray-400 dark:text-zinc-500">Código:</span>
                      <span className="text-xs font-bold font-mono text-brand-700 dark:text-brand-400 tracking-wider">{item.codigo_referido}</span>
                    </div>
                  )}
                  {tabActiva === 'vendedores' && !item.codigo_referido && (
                    <p className="text-xs text-orange-400 dark:text-orange-400 mt-1">Sin código asignado</p>
                  )}
                </div>
                <button
                  onClick={() => toggleActivo(item)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${item.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}
                >
                  {item.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-50 dark:border-zinc-800">
                <button
                  onClick={() => abrirEditar(item)}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
                >
                  Editar
                </button>
                <div className="flex items-center gap-3">
                  {(tabActiva === 'choferes' || tabActiva === 'guias') && (
                    <button
                      onClick={() => copiarLink(item)}
                      title="Link personal del chat interno de operaciones"
                      className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium inline-flex items-center gap-1"
                    >
                      <IcTxt n="clip" />{copiadoId === item.id ? 'Copiado' : 'Copiar link'}
                    </button>
                  )}
                  {item.whatsapp && (
                    <a
                      href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${item.nombre} 👋`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Abrir WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal agregar/editar */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">
                {editando ? `Editar ${LABELS[tabActiva]}` : `Nuevo ${LABELS[tabActiva]}`}
              </h2>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: Carlos Méndez"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: 5491112345678"
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Con código de país, sin +, sin espacios. Ej: 5491112345678</p>
              </div>
              {tabActiva === 'choferes' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Pasajeros que entran en su auto</label>
                    <input type="text" inputMode="numeric" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} className={INPUT_F} placeholder="Ej: 6" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Tarifa por viaje (R$)</label>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Lo que se le paga por cada viaje de ese paseo, sin importar cuántos pasajeros lleve. Si no tiene tarifa para un paseo, se usa el costo general del paseo.</p>
                    <div className="space-y-2">
                      {Object.keys(tarifas).map((id) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-gray-700 dark:text-zinc-300 truncate">{nombrePaseo[id] || 'Paseo'}</span>
                          <input type="text" inputMode="decimal" value={tarifas[id]} onChange={(e) => setTarifas({ ...tarifas, [id]: e.target.value })}
                            className={INPUT_F + ' !w-28 text-right'} aria-label={`Tarifa para ${nombrePaseo[id] || 'el paseo'}`} />
                          <button type="button" onClick={() => setTarifas(({ [id]: _quitado, ...resto }) => resto)} className="text-gray-300 hover:text-red-400 text-sm" title="Quitar">✕</button>
                        </div>
                      ))}
                      {paseos.filter((p) => !(p.id in tarifas)).length > 0 && (
                        <select value="" onChange={(e) => e.target.value && setTarifas({ ...tarifas, [e.target.value]: '' })} className={INPUT_F}>
                          <option value="">+ Agregar tarifa de otro paseo...</option>
                          {paseos.filter((p) => !(p.id in tarifas)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Notas</label>
                    <textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={INPUT_F} placeholder="Ej: trabaja solo los fines de semana" />
                  </div>
                </>
              )}
              {tabActiva === 'vendedores' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                    Código de referido <span className="text-gray-400 dark:text-zinc-500 font-normal">(único por vendedor)</span>
                  </label>
                  <input
                    type="text"
                    value={form.codigo_referido}
                    onChange={(e) => setForm({ ...form, codigo_referido: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder="Ej: JUAN01"
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Sin espacios. Se convierte a mayúsculas automáticamente.</p>
                </div>
              )}
            </div>
            {errorForm && <p className="mt-4 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{errorForm}</p>}
            <button
              onClick={guardar}
              disabled={guardando}
              className="mt-5 w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : `Agregar ${LABELS[tabActiva]}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
