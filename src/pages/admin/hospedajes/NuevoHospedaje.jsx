import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospedajesApi, habitacionesApi, propietariosApi } from '../../../lib/supabase.js'
import HospedajeForm, { EMPTY_HOSPEDAJE, datosDesdeForm } from '../../../components/admin/HospedajeForm.jsx'
import HabitacionForm, { EMPTY_HABITACION, datosDesdeFormHabitacion } from '../../../components/admin/HabitacionForm.jsx'

export default function NuevoHospedaje() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_HOSPEDAJE)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  // Tipos de habitación / departamentos cargados antes de guardar el hospedaje
  // (todavía no existen en la base — recién se crean cuando se guarda todo junto,
  // porque necesitan el id del hospedaje ya creado).
  const [habitaciones, setHabitaciones] = useState([])
  const [editandoHab, setEditandoHab] = useState(null) // null | 'nueva' | _tempId
  const [habForm, setHabForm] = useState(EMPTY_HABITACION)
  const [errorHab, setErrorHab] = useState(null)

  function abrirNuevaHabitacion() {
    setHabForm(EMPTY_HABITACION)
    setErrorHab(null)
    setEditandoHab('nueva')
  }
  function abrirEditarHabitacion(hab) {
    setHabForm({ ...hab })
    setErrorHab(null)
    setEditandoHab(hab._tempId)
  }
  function guardarHabitacionLocal() {
    if (!habForm.nombre.trim()) {
      setErrorHab('El nombre es obligatorio.')
      return
    }
    if (editandoHab === 'nueva') {
      setHabitaciones(prev => [...prev, { ...habForm, _tempId: crypto.randomUUID() }])
    } else {
      setHabitaciones(prev => prev.map(h => h._tempId === editandoHab ? { ...habForm, _tempId: editandoHab } : h))
    }
    setEditandoHab(null)
  }
  function borrarHabitacionLocal(tempId) {
    setHabitaciones(prev => prev.filter(h => h._tempId !== tempId))
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const { data, error } = await hospedajesApi.create(datosDesdeForm(form))
      if (error) throw error
      if (form.nombre_dueno.trim() || form.contacto_dueno.trim()) {
        await propietariosApi.upsertHospedaje(data.id, {
          nombre_dueno: form.nombre_dueno.trim(),
          contacto_dueno: form.contacto_dueno.trim(),
        })
      }
      for (const hab of habitaciones) {
        const { data: habCreada, error: habError } = await habitacionesApi.create(datosDesdeFormHabitacion(hab, data.id))
        if (habError) throw habError
        if (hab.nombre_dueno.trim() || hab.contacto_dueno.trim()) {
          await propietariosApi.upsertHabitacion(habCreada.id, {
            nombre_dueno: hab.nombre_dueno.trim(),
            contacto_dueno: hab.contacto_dueno.trim(),
          })
        }
      }
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
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Cargá un hotel, posada o departamento asociado a DreamsTours</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6">
        <HospedajeForm form={form} setForm={setForm} error={error} />
      </div>

      {/* Tipos de habitación / departamentos */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6">
        <h3 className="font-bold text-gray-900 dark:text-zinc-100 mb-1">Tipos de habitación / departamentos</h3>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Para hoteles/posadas: un tipo por cada categoría de cuarto. Para un complejo de departamentos
          de distintos dueños: uno por cada unidad, con sus propias fotos, video y dueño interno.
          Se crean recién al guardar el hospedaje.
        </p>

        {habitaciones.length > 0 && (
          <div className="space-y-2 mb-4">
            {habitaciones.map(hab => (
              <div key={hab._tempId} className="flex items-center gap-3 border border-gray-100 dark:border-zinc-800 rounded-xl p-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
                  {hab.imagen ? (
                    <img src={hab.imagen} alt="" className="w-full h-full object-cover" />
                  ) : hab.video ? (
                    <video src={`${hab.video}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-gray-900 dark:text-zinc-100 truncate">{hab.nombre}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {[hab.capacidad ? `hasta ${hab.capacidad} huéspedes` : null, hab.camas || null].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {hab.nombre_dueno && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      🔒 {hab.nombre_dueno}{hab.contacto_dueno && ` · ${hab.contacto_dueno}`}
                    </p>
                  )}
                </div>
                <button onClick={() => abrirEditarHabitacion(hab)}
                  className="text-xs font-medium py-1.5 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  Editar
                </button>
                <button onClick={() => borrarHabitacionLocal(hab._tempId)}
                  className="text-xs py-1.5 px-2 rounded-lg border border-red-100 dark:border-red-900 text-red-400 dark:text-red-500 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={abrirNuevaHabitacion}
          className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl py-3 text-sm text-gray-500 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
          + Agregar tipo de habitación / departamento
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/admin/hospedajes')} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors bg-white dark:bg-zinc-900">
          Cancelar
        </button>
        <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {editandoHab && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setEditandoHab(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4 text-gray-900 dark:text-zinc-100">
              {editandoHab === 'nueva' ? 'Nuevo tipo de habitación / departamento' : 'Editar habitación / departamento'}
            </h2>
            <HabitacionForm form={habForm} setForm={setHabForm} error={errorHab} />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditandoHab(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={guardarHabitacionLocal} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
