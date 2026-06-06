import { useState } from 'react'
import { leads as initialLeads, estadosLead } from '../../data/mockData.js'
import Badge from '../../components/ui/Badge.jsx'

const COLUMNAS = ['nuevo', 'contactado', 'reservado', 'perdido']

export default function Leads() {
  const [leads, setLeads] = useState(initialLeads)
  const [vista, setVista] = useState('kanban') // 'kanban' | 'tabla'
  const [seleccionado, setSeleccionado] = useState(null)

  function cambiarEstado(id, nuevoEstado) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, estado: nuevoEstado } : l))
  }

  function guardarNota(id, nota) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, notas: nota } : l))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-400 text-sm">{leads.length} leads en total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVista('kanban')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${vista === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setVista('tabla')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${vista === 'tabla' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            Tabla
          </button>
        </div>
      </div>

      {/* Vista Kanban */}
      {vista === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNAS.map((col) => {
            const colLeads = leads.filter((l) => l.estado === col)
            const { label, color } = estadosLead[col]
            return (
              <div key={col} className="bg-gray-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Badge className={color}>{label}</Badge>
                  <span className="text-xs text-gray-400 font-medium">{colLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {colLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSeleccionado(lead)}
                    >
                      <p className="font-semibold text-sm text-gray-900">{lead.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{lead.excursionInteres}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">{lead.origen}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {new Date(lead.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {lead.whatsapp && (
                        <a
                          href={`https://wa.me/${lead.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                        >
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

      {/* Vista Tabla */}
      {vista === 'tabla' && (
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
              {leads.map((lead) => {
                const estado = estadosLead[lead.estado]
                return (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{lead.nombre}</td>
                    <td className="px-5 py-3 text-gray-500">{lead.excursionInteres}</td>
                    <td className="px-5 py-3 text-gray-500">{lead.origen}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(lead.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={lead.estado}
                        onChange={(e) => cambiarEstado(lead.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${estado.color}`}
                      >
                        {Object.entries(estadosLead).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {lead.whatsapp && (
                          <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600" title="WhatsApp">
                            💬
                          </a>
                        )}
                        <button onClick={() => setSeleccionado(lead)} className="text-brand-500 hover:text-brand-700 text-xs font-medium">
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel lateral del lead seleccionado */}
      {seleccionado && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSeleccionado(null)}>
          <div className="bg-white w-96 h-full shadow-xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{seleccionado.nombre}</h2>
              <button onClick={() => setSeleccionado(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-400">WhatsApp</span><span>{seleccionado.whatsapp || '–'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{seleccionado.email || '–'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Excursión</span><span>{seleccionado.excursionInteres}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Origen</span><span>{seleccionado.origen}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Fecha</span><span>{new Date(seleccionado.fecha).toLocaleDateString('es-AR')}</span></div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-1">Estado</p>
              <select
                value={seleccionado.estado}
                onChange={(e) => {
                  cambiarEstado(seleccionado.id, e.target.value)
                  setSeleccionado((prev) => ({ ...prev, estado: e.target.value }))
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {Object.entries(estadosLead).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-1">Notas</p>
              <textarea
                rows={4}
                defaultValue={seleccionado.notas}
                onBlur={(e) => guardarNota(seleccionado.id, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="Agregar notas..."
              />
            </div>

            {seleccionado.whatsapp && (
              <a
                href={`https://wa.me/${seleccionado.whatsapp}?text=Hola%20${encodeURIComponent(seleccionado.nombre)}!%20Te%20contactamos%20de%20Turismo%20Patagonia`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                💬 Contactar por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
