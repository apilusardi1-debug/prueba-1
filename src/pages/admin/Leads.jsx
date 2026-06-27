import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leadsApi, excursionesApi, clientesApi } from '../../lib/supabase.js'
import Badge from '../../components/ui/Badge.jsx'

const COLUMNAS = ['nuevo', 'contactado', 'reservado', 'perdido']
const estadosLead = {
  nuevo:      { label: 'Nuevo',      color: 'bg-blue-100 text-blue-700' },
  contactado: { label: 'Contactado', color: 'bg-yellow-100 text-yellow-700' },
  reservado:  { label: 'Reservado',  color: 'bg-green-100 text-green-700' },
  perdido:    { label: 'Perdido',    color: 'bg-red-100 text-red-700' },
}

const FORM_VACIO = { nombre: '', whatsapp: '', excursion_id: '', notas: '' }

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('kanban')
  const [seleccionado, setSeleccionado] = useState(null)
  const [mostrarFormLead, setMostrarFormLead] = useState(false)
  const [formLead, setFormLead] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [convertidoMsg, setConvertidoMsg] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [guardandoLead, setGuardandoLead] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [{ data: l }, { data: e }] = await Promise.all([
          leadsApi.getAll(),
          excursionesApi.getAll(),
        ])
        if (l) setLeads(l)
        if (e) setExcursiones(e)
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  async function eliminarLead(id) {
    await leadsApi.delete(id)
    setLeads(prev => prev.filter(l => l.id !== id))
    setEliminandoId(null)
    if (seleccionado?.id === id) setSeleccionado(null)
  }

  async function cambiarEstado(id, nuevoEstado) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, estado: nuevoEstado } : l))
    await leadsApi.updateEstado(id, nuevoEstado, null)
  }

  async function registrarLead() {
    if (!formLead.nombre.trim() || !formLead.whatsapp.trim()) return
    setEnviando(true)
    const excursionNombre = excursiones.find(e => e.id === formLead.excursion_id)?.nombre || ''
    const { data, error } = await leadsApi.create({
      nombre: formLead.nombre,
      whatsapp: formLead.whatsapp,
      excursion_interes: excursionNombre,
      excursion_id: formLead.excursion_id || null,
      notas: formLead.notas,
      origen: 'WhatsApp',
      estado: 'nuevo',
    })
    if (!error && data) {
      setLeads(prev => [data, ...prev])
      setMostrarFormLead(false)
      setFormLead(FORM_VACIO)
    } else {
      alert('Error al guardar. Revisá la conexión.')
    }
    setEnviando(false)
  }

  function abrirLead(lead) {
    setSeleccionado(lead)
    setConvertidoMsg('')
    setEditForm({
      nombre: lead.nombre || '',
      whatsapp: lead.whatsapp || '',
      email: lead.email || '',
      excursion_interes: lead.excursion_interes || '',
      excursion_id: lead.excursion_id || '',
      origen: lead.origen || '',
      estado: lead.estado || 'nuevo',
      notas: lead.notas || '',
    })
  }

  async function guardarLead() {
    if (!editForm.nombre.trim()) return
    setGuardandoLead(true)
    const { data } = await leadsApi.update(seleccionado.id, editForm)
    if (data) {
      setLeads(prev => prev.map(l => l.id === data.id ? data : l))
      setSeleccionado(data)
    }
    setGuardandoLead(false)
  }

  async function convertirACliente(lead) {
    setConvirtiendo(true)
    setConvertidoMsg('')
    const phone = (lead.whatsapp || '').replace(/\D/g, '')

    // Ver si ya existe como cliente
    const { data: existente } = await clientesApi.getByWhatsapp(phone)
    if (existente) {
      setConvertidoMsg('ya_existe')
      setConvirtiendo(false)
      return
    }

    const { data } = await clientesApi.create({
      nombre: lead.nombre,
      whatsapp: phone,
      email: lead.email || null,
    })

    if (data) {
      await cambiarEstado(lead.id, 'reservado')
      setSeleccionado(p => ({ ...p, estado: 'reservado' }))
      setConvertidoMsg('ok')
    }
    setConvirtiendo(false)
  }

  async function guardarNota(id, notas) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notas } : l))
    await leadsApi.updateEstado(id, leads.find(l => l.id === id)?.estado, notas)
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando leads...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-400 text-sm">{leads.length} leads en total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarFormLead(true)}
            className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            📲 Lead de WhatsApp
          </button>
          {['kanban','tabla'].map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${vista === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {leads.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🎯</p>
          <p>Aún no hay leads. Aparecerán acá cuando alguien complete el formulario de reserva.</p>
        </div>
      )}

      {vista === 'kanban' && leads.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNAS.map((col) => {
            const colLeads = leads.filter(l => l.estado === col)
            const { label, color } = estadosLead[col]
            return (
              <div key={col} className="bg-gray-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Badge className={color}>{label}</Badge>
                  <span className="text-xs text-gray-400 font-medium">{colLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {colLeads.map(lead => (
                    <div key={lead.id} className="bg-white rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => abrirLead(lead)}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-gray-900">{lead.nombre}</p>
                        {eliminandoId === lead.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => eliminarLead(lead.id)} className="text-xs font-semibold text-red-500 hover:text-red-700">Sí</button>
                            <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400">No</button>
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setEliminandoId(lead.id) }}
                            className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{lead.excursion_interes}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">{lead.origen}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {lead.whatsapp && (
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/admin/crm/whatsapp?phone=${lead.whatsapp}`) }}
                          className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                          💬 WhatsApp
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {vista === 'tabla' && leads.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Excursión</th>
                <th className="px-5 py-3 text-left">Origen</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map(lead => {
                const estado = estadosLead[lead.estado] || estadosLead.nuevo
                return (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{lead.nombre}</td>
                    <td className="px-5 py-3 text-gray-500">{lead.excursion_interes}</td>
                    <td className="px-5 py-3 text-gray-500">{lead.origen}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(lead.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-5 py-3">
                      <select value={lead.estado} onChange={e => cambiarEstado(lead.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${estado.color}`}>
                        {Object.entries(estadosLead).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {lead.whatsapp && <button onClick={() => navigate(`/admin/crm/whatsapp?phone=${lead.whatsapp}`)} className="text-green-500">💬</button>}
                        <button onClick={() => abrirLead(lead)} className="text-xs font-medium text-gray-600 hover:text-gray-900">Ver</button>
                        {eliminandoId === lead.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">¿Eliminar?</span>
                            <button onClick={() => eliminarLead(lead.id)} className="text-xs font-semibold text-red-500 hover:text-red-700">Sí</button>
                            <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setEliminandoId(lead.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostrarFormLead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setMostrarFormLead(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">📲 Nuevo lead</h2>
              <button onClick={() => setMostrarFormLead(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nombre *</label>
                <input type="text" value={formLead.nombre} onChange={e => setFormLead({...formLead, nombre: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: María González" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">WhatsApp *</label>
                <input type="text" value={formLead.whatsapp} onChange={e => setFormLead({...formLead, whatsapp: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: 5491112345678" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Excursión de interés</label>
                <select value={formLead.excursion_id} onChange={e => setFormLead({...formLead, excursion_id: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">— Sin especificar</option>
                  {excursiones.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
                <textarea value={formLead.notas} onChange={e => setFormLead({...formLead, notas: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  placeholder="Ej: Quiere ir en julio, grupo de 4 personas..." />
              </div>
            </div>
            <button onClick={registrarLead} disabled={enviando}
              className="mt-5 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              {enviando ? 'Guardando...' : '✅ Guardar lead'}
            </button>
          </div>
        </div>
      )}

      {seleccionado && editForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => { setSeleccionado(null); setConvertidoMsg('') }}>
          <div className="bg-white w-96 h-full shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-lg text-gray-900">Lead</h2>
              <button onClick={() => { setSeleccionado(null); setConvertidoMsg('') }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Campos editables */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {[
                { key: 'nombre',    label: 'Nombre',    type: 'text', placeholder: 'Nombre completo' },
                { key: 'whatsapp',  label: 'WhatsApp',  type: 'text', placeholder: '5491155554444' },
                { key: 'email',     label: 'Email',     type: 'text', placeholder: 'correo@email.com' },
                { key: 'origen',    label: 'Origen',    type: 'text', placeholder: 'WhatsApp, Instagram...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                  <input
                    type="text"
                    value={editForm[key]}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
                  />
                </div>
              ))}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Excursión de interés</label>
                <select
                  value={editForm.excursion_id}
                  onChange={e => {
                    const nombre = excursiones.find(x => x.id === e.target.value)?.nombre || ''
                    setEditForm(p => ({ ...p, excursion_id: e.target.value, excursion_interes: nombre }))
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
                >
                  <option value="">— Sin especificar</option>
                  {excursiones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Estado</label>
                <select
                  value={editForm.estado}
                  onChange={e => setEditForm(p => ({ ...p, estado: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
                >
                  {Object.entries(estadosLead).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Notas</label>
                <textarea
                  rows={4}
                  value={editForm.notas}
                  onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Observaciones, preferencias, detalles..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147] resize-none"
                />
              </div>

              {/* Guardar cambios */}
              <button
                onClick={guardarLead}
                disabled={guardandoLead}
                className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {guardandoLead ? 'Guardando...' : 'Guardar cambios'}
              </button>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                {/* Convertir a cliente */}
                {convertidoMsg === 'ok' && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
                    ✅ Convertido a cliente correctamente
                  </div>
                )}
                {convertidoMsg === 'ya_existe' && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-3 rounded-xl">
                    ⚠️ Ya existe como cliente con ese WhatsApp
                  </div>
                )}
                <button
                  onClick={() => convertirACliente(seleccionado)}
                  disabled={convirtiendo || convertidoMsg === 'ok'}
                  className="w-full flex items-center justify-center gap-2 bg-[#002147] hover:bg-[#003366] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {convirtiendo ? 'Convirtiendo...' : convertidoMsg === 'ok' ? '✅ Ya es cliente' : '👤 Convertir a cliente'}
                </button>

                {seleccionado.whatsapp && (
                  <button
                    onClick={() => { setSeleccionado(null); setConvertidoMsg(''); navigate(`/admin/crm/whatsapp?phone=${seleccionado.whatsapp}`) }}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    💬 Abrir en WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
