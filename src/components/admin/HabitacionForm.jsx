import { useRef, useState } from 'react'
import { subirImagen, subirVideoHospedaje } from '../../lib/supabase.js'

export const EMPTY_HABITACION = {
  nombre: '', superficie: '', capacidad: '', cantidad: '', camas: '', vista: '',
  descripcion: '', imagen: '', galeria: [], video: '', amenities: [''],
  nombre_dueno: '', contacto_dueno: '',
}

export default function HabitacionForm({ form, setForm, error }) {
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [subiendoGaleria, setSubiendoGaleria] = useState(false)
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const fileRef = useRef()
  const galeriaFileRef = useRef()
  const videoFileRef = useRef()

  async function handleImagen(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoImg(true)
    const { url, error } = await subirImagen(archivo)
    if (error) console.error('Error al subir imagen:', error)
    else setForm(p => ({ ...p, imagen: url }))
    setSubiendoImg(false)
  }

  async function handleGaleria(e) {
    const archivos = Array.from(e.target.files || [])
    if (!archivos.length) return
    setSubiendoGaleria(true)
    for (const archivo of archivos) {
      const { url } = await subirImagen(archivo)
      if (url) setForm(p => ({ ...p, galeria: [...p.galeria, url] }))
    }
    setSubiendoGaleria(false)
    if (galeriaFileRef.current) galeriaFileRef.current.value = ''
  }

  function quitarDeGaleria(idx) {
    setForm(p => ({ ...p, galeria: p.galeria.filter((_, i) => i !== idx) }))
  }

  async function handleVideo(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoVideo(true)
    const { url, error } = await subirVideoHospedaje(archivo)
    if (error) console.error('Error al subir video:', error)
    else setForm(p => ({ ...p, video: url }))
    setSubiendoVideo(false)
  }

  function setAmenity(idx, valor) {
    setForm(p => ({ ...p, amenities: p.amenities.map((a, i) => i === idx ? valor : a) }))
  }
  function agregarAmenity() {
    setForm(p => ({ ...p, amenities: [...p.amenities, ''] }))
  }
  function quitarAmenity(idx) {
    setForm(p => ({ ...p, amenities: p.amenities.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="space-y-3 text-sm">
      {error && <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

      {/* Foto principal */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Foto principal</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImagen} className="hidden" />
        {form.imagen ? (
          <div className="relative">
            <img src={form.imagen} alt="preview" className="w-full h-28 object-cover rounded-lg" />
            <button type="button" onClick={() => { setForm(p => ({ ...p, imagen: '' })); if (fileRef.current) fileRef.current.value = '' }}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">✕ Quitar</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendoImg}
            className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg py-5 text-gray-400 dark:text-zinc-500 text-sm hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-50">
            {subiendoImg ? '⏳ Subiendo...' : '📷 Subir foto principal'}
          </button>
        )}
      </div>

      {/* Galería */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Galería de fotos (opcional)</label>
        <input ref={galeriaFileRef} type="file" accept="image/*" multiple onChange={handleGaleria} className="hidden" />
        {form.galeria.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {form.galeria.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt="" className="w-full h-16 object-cover rounded-lg" />
                <button type="button" onClick={() => quitarDeGaleria(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">✕</button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => galeriaFileRef.current?.click()} disabled={subiendoGaleria}
          className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium disabled:opacity-50">
          {subiendoGaleria ? '⏳ Subiendo...' : '+ Agregar fotos'}
        </button>
      </div>

      {/* Video */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Video (opcional, se muestra en el sitio público)</label>
        <input ref={videoFileRef} type="file" accept="video/*" onChange={handleVideo} className="hidden" />
        {form.video ? (
          <div className="relative">
            <video src={form.video} controls className="w-full h-28 rounded-lg bg-black" />
            <button type="button" onClick={() => { setForm(p => ({ ...p, video: '' })); if (videoFileRef.current) videoFileRef.current.value = '' }}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">✕ Quitar</button>
          </div>
        ) : (
          <button type="button" onClick={() => videoFileRef.current?.click()} disabled={subiendoVideo}
            className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg py-5 text-gray-400 dark:text-zinc-500 text-sm hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-50">
            {subiendoVideo ? '⏳ Subiendo...' : '🎬 Subir video'}
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Nombre *</label>
        <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: Departamento 3 cuartos"
          className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Descripción</label>
        <textarea rows={4} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
          className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Superficie (m²)</label>
          <input type="number" min="0" value={form.superficie} onChange={e => setForm(p => ({ ...p, superficie: e.target.value }))}
            className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Capacidad (huéspedes)</label>
          <input type="number" min="0" value={form.capacidad} onChange={e => setForm(p => ({ ...p, capacidad: e.target.value }))}
            className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Camas</label>
          <input type="text" value={form.camas} onChange={e => setForm(p => ({ ...p, camas: e.target.value }))}
            placeholder="Ej: 2 matrimoniales + cucheta"
            className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Vista</label>
          <input type="text" value={form.vista} onChange={e => setForm(p => ({ ...p, vista: e.target.value }))}
            placeholder="Ej: Vista al mar"
            className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Amenities / servicios (opcional)</label>
        {form.amenities.map((a, i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <input value={a} onChange={e => setAmenity(i, e.target.value)} placeholder="Ej: Piscina, Wifi Gratuito..."
              className="flex-1 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <button type="button" onClick={() => quitarAmenity(i)} className="text-gray-400 hover:text-red-500 px-2">✕</button>
          </div>
        ))}
        <button type="button" onClick={agregarAmenity} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
          + Agregar amenity
        </button>
      </div>

      <div className="border-t border-dashed border-gray-200 dark:border-zinc-700 pt-3 mt-1">
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">🔒 Datos del propietario de este departamento — uso interno, nunca se muestran en el sitio público</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Nombre del dueño</label>
            <input type="text" value={form.nombre_dueno} onChange={e => setForm(p => ({ ...p, nombre_dueno: e.target.value }))}
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Contacto del dueño</label>
            <input type="text" value={form.contacto_dueno} onChange={e => setForm(p => ({ ...p, contacto_dueno: e.target.value }))}
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function datosDesdeFormHabitacion(form, hospedajeId) {
  return {
    hospedaje_id: hospedajeId,
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    imagen: form.imagen.trim(),
    galeria: form.galeria.filter(Boolean),
    video: form.video.trim(),
    amenities: form.amenities.map(a => a.trim()).filter(Boolean),
    superficie: parseFloat(form.superficie) || null,
    capacidad: parseInt(form.capacidad) || 0,
    cantidad: parseInt(form.cantidad) || 0,
    camas: form.camas.trim(),
    vista: form.vista.trim(),
  }
}
