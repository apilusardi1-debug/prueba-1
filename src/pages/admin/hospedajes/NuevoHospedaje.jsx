import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospedajesApi } from '../../../lib/supabase.js'
import HospedajeForm, { EMPTY_HOSPEDAJE, datosDesdeForm } from '../../../components/admin/HospedajeForm.jsx'

export default function NuevoHospedaje() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_HOSPEDAJE)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function guardar() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const { error } = await hospedajesApi.create(datosDesdeForm(form))
      if (error) throw error
      navigate('/admin/hospedajes')
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'intentá de nuevo'))
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/hospedajes')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Nuevo hospedaje</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Cargá un hotel o resort asociado a DreamsTour</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6">
        <HospedajeForm form={form} setForm={setForm} error={error} />

        <div className="flex gap-3 mt-6">
          <button onClick={() => navigate('/admin/hospedajes')} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
