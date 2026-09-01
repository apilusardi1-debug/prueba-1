import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hospedajesApi, habitacionesApi, propietariosApi } from '../../../lib/supabase.js'
import HospedajeForm, { EMPTY_HOSPEDAJE, datosDesdeForm } from '../../../components/admin/HospedajeForm.jsx'
import HabitacionForm, { EMPTY_HABITACION, datosDesdeFormHabitacion } from '../../../components/admin/HabitacionForm.jsx'

export default function EditarHospedaje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(EMPTY_HOSPEDAJE)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  // Tipos de habitación / departamentos: acá SÍ existe ya el hospedaje, así que
  // cada alta/edición/borrado se guarda de una en la base (no queda pendiente
  // como en "Nuevo hospedaje").
  const [habitaciones, setHabitaciones] = useState([])
  const [propietariosPorHabitacion, setPropietariosPorHabitacion] = useState({})
  const [cargandoHabitaciones, setCargandoHabitaciones] = useState(true)
  const [editandoHab, setEditandoHab] = useState(null) // null | 'nueva' | id
  const [habForm, setHabForm] = useState(EMPTY_HABITACION)
  const [guardandoHab, setGuardandoHab] = useState(false)
  const [errorHab, setErrorHab] = useState(null)
  const [habABorrar, setHabABorrar] = useState(null)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setCargando(true)
    const { data, error } = await hospedajesApi.getById(id)
    if (error || !data) {
      setError('No se pudo cargar el hospedaje.')
      setCargando(false)
      return
    }
    setForm({
      nombre: data.nombre || '', tipo: data.tipo || 'Hotel', destino: data.destino || '',
      ubicacion: data.ubicacion || '', direccion: data.direccion || '', descripcion: data.descripcion || '',
      imagen: data.imagen || '', galeria: data.galeria || [], video: data.video || '', amenities: (data.amenities || []).length ? data.amenities : [''],
      estrellas: data.estrellas ? String(data.estrellas) : '', capacidad: data.capacidad ? String(data.capacidad) : '',
      precio_min: data.precio_min ? String(data.precio_min) : '', contacto: data.contacto || '', whatsapp: data.whatsapp || '',
      origen: data.origen || 'Dueño directo', nombre_dueno: '', contacto_dueno: '',
    })
    const { data: propietario } = await propietariosApi.getByHospedaje(id)
    if (propietario) {
      setForm(p => ({ ...p, nombre_dueno: propietario.nombre_dueno || '', contacto_dueno: propietario.contacto_dueno || '' }))
    }
    setCargando(false)
    cargarHabitaciones()
  }

  async function cargarHabitaciones() {
    setCargandoHabitaciones(true)
    const { data } = await habitacionesApi.getByHospedaje(id)
    setHabitaciones(data || [])
    const propietarios = await Promise.all(
      (data || []).map(hab => propietariosApi.getByHabitacion(hab.id).then(({ data: p }) => [hab.id, p]))
    )
    setPropietariosPorHabitacion(Object.fromEntries(propietarios.filter(([, p]) => p)))
    setCargandoHabitaciones(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const { error } = await hospedajesApi.update(id, datosDesdeForm(form))
      if (error) throw error
      if (form.nombre_dueno.trim() || form.contacto_dueno.trim()) {
        await propietariosApi.upsertHospedaje(id, {
          nombre_dueno: form.nombre_dueno.trim(),
          contacto_dueno: form.contacto_dueno.trim(),
        })
      }
      navigate('/admin/hospedajes')
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'intentá de nuevo'))
      setGuardando(false)
    }
  }

  function abrirNuevaHabitacion() {
    setHabForm(EMPTY_HABITACION)
    setErrorHab(null)
    setEditandoHab('nueva')
  }

  async function abrirEditarHabitacion(hab) {
    setHabForm({
      nombre: hab.nombre || '', superficie: hab.superficie ? String(hab.superficie) : '',
      capacidad: hab.capacidad ? String(hab.capacidad) : '', cantidad: hab.cantidad ? String(hab.cantidad) : '',
      camas: hab.camas || '', vista: hab.vista || '', descripcion: hab.descripcion || '',
      imagen: hab.imagen || '', galeria: hab.galeria || [], video: hab.video || '',
      amenities: (hab.amenities || []).length ? hab.amenities : [''],
      nombre_dueno: '', contacto_dueno: '',
    })
    setErrorHab(null)
    setEditandoHab(hab.id)
    const { data: propietario } = await propietariosApi.getByHabitacion(hab.id)
    if (propietario) {
      setHabForm(p => ({ ...p, nombre_dueno: propietario.nombre_dueno || '', contacto_dueno: propietario.contacto_dueno || '' }))
    }
  }

  async function guardarHabitacion() {
    if (!habForm.nombre.trim()) {
      setErrorHab('El nombre es obligatorio.')
      return
    }
    setGuardandoHab(true)
    setErrorHab(null)
    try {
      const datos = datosDesdeFormHabitacion(habForm, id)
      let habitacionId = editandoHab
      if (editandoHab === 'nueva') {
        const { data, error } = await habitacionesApi.create(datos)
        if (error) throw error
        habitacionId = data.id
      } else {
        const { error } = await habitacionesApi.update(editandoHab, datos)
        if (error) throw error
      }
      if (habForm.nombre_dueno.trim() || habForm.contacto_dueno.trim()) {
        await propietariosApi.upsertHabitacion(habitacionId, {
          nombre_dueno: habForm.nombre_dueno.trim(),
          contacto_dueno: habForm.contacto_dueno.trim(),
        })
      }
      setEditandoHab(null)
      await cargarHabitaciones()
    } catch (e) {
      setErrorHab('Error al guardar: ' + (e.message || 'intentá de nuevo'))
    }
    setGuardandoHab(false)
  }

  async function eliminarHabitacion() {
    if (!habABorrar) return
    await habitacionesApi.delete(habABorrar.id)
    setHabABorrar(null)
    await cargarHabitaciones()
  }

  if (cargando) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando hospedaje...</div>

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Editar hospedaje</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{form.nombre}</p>
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
        </p>

        {cargandoHabitaciones ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500 mb-4">Cargando...</p>
        ) : (
          <>
            {habitaciones.length > 0 && (
              <div className="space-y-2 mb-4">
                {habitaciones.map(hab => (
                  <div key={hab.id} className="flex items-center gap-3 border border-gray-100 dark:border-zinc-800 rounded-xl p-3">
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
                      {propietariosPorHabitacion[hab.id]?.nombre_dueno && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          🔒 {propietariosPorHabitacion[hab.id].nombre_dueno}
                          {propietariosPorHabitacion[hab.id].contacto_dueno && ` · ${propietariosPorHabitacion[hab.id].contacto_dueno}`}
                        </p>
                      )}
                    </div>
                    <button onClick={() => abrirEditarHabitacion(hab)}
                      className="text-xs font-medium py-1.5 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => setHabABorrar(hab)}
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
          </>
        )}
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
              <button onClick={guardarHabitacion} disabled={guardandoHab} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {guardandoHab ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {habABorrar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setHabABorrar(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-center font-bold text-base text-gray-900 dark:text-zinc-100 mb-1">¿Eliminar "{habABorrar.nombre}"?</h3>
            <p className="text-center text-sm text-gray-400 dark:text-zinc-500 mb-6">No se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setHabABorrar(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={eliminarHabitacion} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
