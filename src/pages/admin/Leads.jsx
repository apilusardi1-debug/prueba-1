import { useState, useEffect } from 'react'
import { leadsApi } from '../../lib/supabase.js'
import Badge from '../../components/ui/Badge.jsx'

const COLUMNAS = ['nuevo', 'contactado', 'reservado', 'perdido']
const estadosLead = {
  nuevo:      { label: 'Nuevo',      color: 'bg-blue-100 text-blue-700' },
  contactado: { label: 'Contactado', color: 'bg-yellow-100 text-yellow-700' },
  reservado:  { label: 'Reservado',  color: 'bg-green-100 text-green-700' },
  perdido:    { label: 'Perdido',    color: 'bg-red-100 text-red-700' },
}

const MAKE_WEBHOOK = 'https://hook.eu1.make.com/elh45qvyqefs87sfctg2w0ltm61okrdt'

const FORM_VACIO = { nombre: '', whatsapp: '', excursion: '', fecha: '', hospedaje: 'no' }

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('kanban')
  const [seleccionado, setSeleccionado] = useState(null)
  const [mostrarFormLead, setMostrarFormLead] = useState(false)
  const [formLead, setFormLead] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        const { data } = await leadsApi.getAll()
        if (data) setLeads(data)
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  async function cambiarEstado(id, nuevoEstado) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, estado: nuevoEstado } : l))
    await leadsApi.updateEstado(id, nuevoEstado, null)
  }

  async function registrarLeadWhatsApp() {
    if (!formLead.nombre.trim() || !formLead.whatsapp.trim()) return
    setEnviando(true)
    try {
      await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formLead.nombre,
          whatsapp: formLead.whatsapp,
          excursion: formLead.excursion,
          fecha: formLead.fecha,
          hospedaje: formLead.hospedaje,
        }),
      })
      setMostrarFormLead(false)
      setFormLead(FORM_VACIO)
      setTimeout(async () => {
        const { data } = await leadsApi.getAll()
        if (data) setLeads(data)
      }, 2000)
    } catch (_) {
      alert('Error al enviar. Revisá la conexión.')
    }
    setEnviando(false)
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
                      onClick={() => setSeleccionado(lead)}>
                      <p className="font-semibold text-sm text-gray-900">{lead.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{lead.excursion_interes}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">{lead.origen}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {lead.whatsapp && (
                        <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                          💬 WhatsApp
                        </a>
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
                        {lead.whatsapp && <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500">💬</a>}
                        <button onClick={() => setSeleccionado(lead)} className="text-xs font-medium text-gray-600 hover:text-gray-900">Ver</button>
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
              <h2 className="font-bold text-lg">📲 Registrar lead de WhatsApp</h2>
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
                <input type="text" value={formLead.excursion} onChange={e => setFormLead({...formLead, excursion: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: Cataratas" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de interés</label>
                <input type="date" value={formLead.fecha} onChange={e => setFormLead({...formLead, fecha: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">¿Necesita hospedaje?</label>
                <select value={formLead.hospedaje} onChange={e => setFormLead({...formLead, hospedaje: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                  <option value="consultar">A consultar</option>
                </select>
              </div>
            </div>
            <button onClick={registrarLeadWhatsApp} disabled={enviando}
              className="mt-5 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              {enviando ? 'Enviando...' : '📲 Registrar lead'}
            </button>
          </div>
        </div>
      )}

      {seleccionado && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSeleccionado(null)}>
          <div className="bg-white w-96 h-full shadow-xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{seleccionado.nombre}</h2>
              <button onClick={() => setSeleccionado(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-400">WhatsApp</span><span>{seleccionado.whatsapp || '–'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{seleccionado.email || '–'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Excursión</span><span>{seleccionado.excursion_interes}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Origen</span><span>{seleccionado.origen}</span></div>
            </div>
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-1">Estado</p>
              <select value={seleccionado.estado}
                onChange={e => { cambiarEstado(seleccionado.id, e.target.value); setSeleccionado(p => ({ ...p, estado: e.target.value })) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {Object.entries(estadosLead).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-1">Notas</p>
              <textarea rows={4} defaultValue={seleccionado.notas}
                onBlur={e => guardarNota(seleccionado.id, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                placeholder="Agregar notas..." />
            </div>
            {seleccionado.whatsapp && (
              <a href={`https://wa.me/${seleccionado.whatsapp}?text=Hola%20${encodeURIComponent(seleccionado.nombre)}!%20Te%20contactamos%20de%20Dream%20Tours`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                💬 Contactar por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
