import { useState, useMemo, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { hospedajesApi, subirImagen } from '../../lib/supabase.js'

const TIPOS = ['Resort', 'Hotel', 'Pousada', 'Departamento']

const EMPTY = {
  nombre: '', tipo: 'Resort', destino: '', ubicacion: '', direccion: '',
  descripcion: '', imagen: '', galeria: [], amenities: [''],
  estrellas: '', capacidad: '', precio_min: '', contacto: '', whatsapp: '',
}

async function loadImgDataUrl(url) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function splitText(doc, text, maxWidth) {
  return doc.splitTextToSize(text, maxWidth)
}

async function generarPDF(hoteles) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margen = 18
  const ancho = W - margen * 2

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 42, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('DREAMSTOUR', margen, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text('Propuesta de Hospedaje — Nordeste Brasilero', margen, 26)

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(9)
  doc.text(`Generado el ${fecha}`, margen, 34)

  let y = 54

  for (let i = 0; i < hoteles.length; i++) {
    const h = hoteles[i]

    if (i > 0) {
      doc.addPage()
      y = 20
    }

    const imgData = h.imagen ? await loadImgDataUrl(h.imagen) : null
    if (imgData) {
      doc.addImage(imgData, 'JPEG', margen, y, ancho, 72, undefined, 'FAST')
    } else {
      doc.setFillColor(226, 232, 240)
      doc.roundedRect(margen, y, ancho, 72, 3, 3, 'F')
    }
    y += 78

    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margen, y, 32, 7, 2, 2, 'F')
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text((h.tipo || 'HOSPEDAJE').toUpperCase(), margen + 3, y + 5)
    y += 12

    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(h.nombre, margen, y)
    y += 7

    if (h.estrellas > 0) {
      doc.setTextColor(217, 119, 6)
      doc.setFontSize(11)
      doc.text('★'.repeat(h.estrellas) + '☆'.repeat(5 - h.estrellas), margen, y)
      y += 7
    }

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const linea2 = [h.destino ? `📍 ${h.destino}` : null, h.capacidad > 0 ? `👥 Hasta ${h.capacidad} personas` : null].filter(Boolean).join('   ·   ')
    if (linea2) { doc.text(linea2, margen, y); y += 9 }

    if (h.precio_min > 0) {
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(`Desde R$ ${h.precio_min}`, margen, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(148, 163, 184)
      doc.text('por noche', margen + 38, y)
      y += 10
    }

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(margen, y, W - margen, y)
    y += 8

    if (h.descripcion) {
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setLineHeightFactor(1.5)
      const lines = splitText(doc, h.descripcion, ancho)
      doc.text(lines, margen, y)
      y += lines.length * 6 + 10
    }

    const amenities = (h.amenities || []).filter(Boolean)
    if (amenities.length) {
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      const lineasAmenities = splitText(doc, amenities.join('   ·   '), ancho)
      doc.text(lineasAmenities, margen, y)
      y += lineasAmenities.length * 5 + 8
    }

    if (h.whatsapp || h.contacto) {
      doc.setFillColor(240, 253, 244)
      doc.roundedRect(margen, y, ancho, 14, 3, 3, 'F')
      doc.setTextColor(22, 163, 74)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      const linea = [h.whatsapp ? `WhatsApp: +${h.whatsapp}` : null, h.contacto ? `Email: ${h.contacto}` : null].filter(Boolean).join('   ·   ')
      doc.text(linea, margen + 5, y + 9)
      y += 20
    }
  }

  const totalPags = doc.getNumberOfPages()
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p)
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 287, W, 10, 'F')
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text('DreamsTour · Nordeste Brasilero · dreamstour.com', margen, 293)
    doc.text(`${p} / ${totalPags}`, W - margen, 293, { align: 'right' })
  }

  doc.save(`Propuesta_Hospedaje_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Componentes UI ───────────────────────────────────────────────────────────

function DropdownFiltro({ label, opciones, seleccionados, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(op) {
    onChange(seleccionados.includes(op) ? seleccionados.filter(v => v !== op) : [...seleccionados, op])
  }

  const activos = seleccionados.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
          activos > 0
            ? 'bg-brand-600 dark:bg-brand-500 text-white border-brand-600 dark:border-brand-500'
            : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'
        }`}
      >
        {label}
        {activos > 0 && (
          <span className="bg-white/30 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activos}</span>
        )}
        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${activos > 0 ? 'opacity-80' : 'text-gray-400'}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg py-1.5 min-w-[160px]">
          {opciones.map(op => (
            <button key={op} onClick={() => toggle(op)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left">
              <span className={`w-4 h-4 rounded flex-shrink-0 border transition-colors flex items-center justify-center ${
                seleccionados.includes(op) ? 'bg-brand-600 border-brand-600 dark:bg-brand-500 dark:border-brand-500' : 'border-gray-300 dark:border-zinc-600'
              }`}>
                {seleccionados.includes(op) && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              {op}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Estrellas({ n }) {
  if (!n) return null
  return <span className="text-amber-400 text-sm tracking-tight">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

export default function Hospedajes() {
  const [hospedajes, setHospedajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState({ categorias: [], ubicaciones: [] })
  const [seleccionados, setSeleccionados] = useState([])
  const [generando, setGenerando] = useState(false)

  const [editando, setEditando] = useState(null) // null | 'nuevo' | id
  const [form, setForm] = useState(EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [subiendoGaleria, setSubiendoGaleria] = useState(false)
  const [aBorrar, setABorrar] = useState(null)
  const fileRef = useRef()
  const galeriaFileRef = useRef()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data, error } = await hospedajesApi.getAll()
      if (!error && data) setHospedajes(data)
    } catch (_) {}
    setLoading(false)
  }

  function setFiltro(key, val) {
    setSeleccion(prev => ({ ...prev, [key]: val }))
  }

  const hayFiltros = busqueda || Object.values(seleccion).some(v => v.length > 0)

  function resetFiltros() {
    setBusqueda('')
    setSeleccion({ categorias: [], ubicaciones: [] })
  }

  function toggleSeleccion(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const ubicacionesDisponibles = useMemo(
    () => Array.from(new Set(hospedajes.map(h => h.ubicacion).filter(Boolean))),
    [hospedajes]
  )

  const filtrados = useMemo(() => {
    return hospedajes.filter(h => {
      if (busqueda && !h.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !(h.destino || '').toLowerCase().includes(busqueda.toLowerCase())) return false
      if (seleccion.categorias.length && !seleccion.categorias.includes(h.tipo)) return false
      if (seleccion.ubicaciones.length && !seleccion.ubicaciones.includes(h.ubicacion)) return false
      return true
    })
  }, [hospedajes, busqueda, seleccion])

  async function exportar() {
    const hotelesExportar = hospedajes.filter(h => seleccionados.includes(h.id))
    if (!hotelesExportar.length) return
    setGenerando(true)
    try {
      await generarPDF(hotelesExportar)
    } finally {
      setGenerando(false)
    }
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setError(null)
    setEditando('nuevo')
  }

  function abrirEditar(h) {
    setForm({
      nombre: h.nombre || '', tipo: h.tipo || 'Resort', destino: h.destino || '',
      ubicacion: h.ubicacion || '', direccion: h.direccion || '', descripcion: h.descripcion || '',
      imagen: h.imagen || '', galeria: h.galeria || [], amenities: (h.amenities || []).length ? h.amenities : [''],
      estrellas: h.estrellas ? String(h.estrellas) : '', capacidad: h.capacidad ? String(h.capacidad) : '',
      precio_min: h.precio_min ? String(h.precio_min) : '', contacto: h.contacto || '', whatsapp: h.whatsapp || '',
    })
    setError(null)
    setEditando(h.id)
  }

  async function handleImagen(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoImg(true)
    const { url, error } = await subirImagen(archivo)
    if (error) setError('Error al subir imagen: ' + error)
    else setForm(p => ({ ...p, imagen: url }))
    setSubiendoImg(false)
  }

  async function handleGaleria(e) {
    const archivos = Array.from(e.target.files || [])
    if (!archivos.length) return
    setSubiendoGaleria(true)
    for (const archivo of archivos) {
      const { url, error } = await subirImagen(archivo)
      if (url) setForm(p => ({ ...p, galeria: [...p.galeria, url] }))
      if (error) setError('Error al subir imagen: ' + error)
    }
    setSubiendoGaleria(false)
    if (galeriaFileRef.current) galeriaFileRef.current.value = ''
  }

  function quitarDeGaleria(idx) {
    setForm(p => ({ ...p, galeria: p.galeria.filter((_, i) => i !== idx) }))
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

  async function guardar() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    const datos = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      destino: form.destino.trim(),
      ubicacion: form.ubicacion.trim(),
      direccion: form.direccion.trim(),
      descripcion: form.descripcion.trim(),
      imagen: form.imagen.trim(),
      galeria: form.galeria.filter(Boolean),
      amenities: form.amenities.map(a => a.trim()).filter(Boolean),
      estrellas: parseInt(form.estrellas) || 0,
      capacidad: parseInt(form.capacidad) || 0,
      precio_min: parseFloat(form.precio_min) || null,
      contacto: form.contacto.trim(),
      whatsapp: form.whatsapp.trim(),
      activa: true,
    }

    try {
      if (editando === 'nuevo') {
        const { data, error } = await hospedajesApi.create(datos)
        if (error) throw error
        if (data) setHospedajes(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      } else {
        const { data, error } = await hospedajesApi.update(editando, datos)
        if (error) throw error
        if (data) setHospedajes(prev => prev.map(h => h.id === editando ? data : h))
      }
      setEditando(null)
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'intentá de nuevo'))
    }
    setGuardando(false)
  }

  async function eliminar() {
    if (!aBorrar) return
    try {
      await hospedajesApi.delete(aBorrar.id)
      setHospedajes(prev => prev.filter(h => h.id !== aBorrar.id))
      setSeleccionados(prev => prev.filter(id => id !== aBorrar.id))
    } catch (_) {}
    setABorrar(null)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando hospedajes...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Hospedajes</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Hoteles y resorts asociados a DreamsTour</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 dark:text-zinc-500">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-[#002147] dark:bg-zinc-100 dark:text-zinc-900 rounded-xl px-4 py-2 hover:bg-[#003366] dark:hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span> Nuevo hospedaje
          </button>
          <button
            onClick={exportar}
            disabled={seleccionados.length === 0 || generando}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              seleccionados.length > 0
                ? 'bg-brand-600 dark:bg-brand-500 text-white hover:bg-brand-700 dark:hover:bg-brand-600 shadow-sm'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed'
            }`}
          >
            {generando ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            Exportar propuesta{seleccionados.length > 0 ? ` (${seleccionados.length})` : ''}
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
          />
        </div>
        <DropdownFiltro label="Categoría" opciones={TIPOS} seleccionados={seleccion.categorias} onChange={val => setFiltro('categorias', val)} />
        <DropdownFiltro label="Ubicación" opciones={ubicacionesDisponibles} seleccionados={seleccion.ubicaciones} onChange={val => setFiltro('ubicaciones', val)} />
        {hayFiltros && (
          <button onClick={resetFiltros} className="text-xs text-red-500 dark:text-red-400 hover:underline font-medium ml-1">Limpiar</button>
        )}
      </div>

      {/* Tip selección */}
      {seleccionados.length === 0 && filtrados.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Seleccioná uno o más hospedajes para habilitar la exportación.
        </p>
      )}

      {/* Resultados */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">
          {hospedajes.length === 0 ? 'Todavía no hay hospedajes cargados. Creá el primero.' : 'Ningún hospedaje coincide con los filtros.'}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtrados.map(h => {
            const estaSeleccionado = seleccionados.includes(h.id)
            return (
              <div
                key={h.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border-2 overflow-hidden flex flex-col transition-all ${
                  estaSeleccionado
                    ? 'border-brand-500 shadow-md shadow-brand-500/10'
                    : 'border-transparent hover:border-gray-200 dark:hover:border-zinc-700'
                }`}
                style={{ outline: estaSeleccionado ? undefined : '1px solid #e5e7eb' }}
              >
                <div className="relative h-52 overflow-hidden cursor-pointer" onClick={() => toggleSeleccion(h.id)}>
                  {h.imagen ? (
                    <img src={h.imagen} alt={h.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-zinc-800" />
                  )}
                  <span className="absolute top-3 left-3 bg-white/90 dark:bg-zinc-900/90 text-gray-700 dark:text-zinc-200 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                    {h.tipo}
                  </span>
                  <span className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    estaSeleccionado ? 'bg-brand-500 border-brand-500' : 'bg-white/80 border-gray-300'
                  }`}>
                    {estaSeleccionado && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1 gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base leading-tight">{h.nombre}</h3>
                  <Estrellas n={h.estrellas} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{h.destino || '—'}</p>
                    {h.capacidad > 0 && <p className="text-xs text-gray-400 dark:text-zinc-500">Hasta {h.capacidad} personas</p>}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed flex-1 line-clamp-3">{h.descripcion}</p>
                  {(h.amenities || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {h.amenities.slice(0, 4).map((a, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">{a}</span>
                      ))}
                      {h.amenities.length > 4 && <span className="text-[10px] text-gray-400 dark:text-zinc-500 px-1 py-0.5">+{h.amenities.length - 4}</span>}
                    </div>
                  )}
                  <div className="pt-3 mt-auto border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <div>
                      {h.precio_min > 0 ? (
                        <>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500">Desde</p>
                          <p className="font-bold text-base text-gray-900 dark:text-zinc-100">R$ {h.precio_min}<span className="text-xs font-normal text-gray-400">/noche</span></p>
                        </>
                      ) : <span />}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => abrirEditar(h)}
                        className="text-xs font-medium py-2 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => setABorrar(h)}
                        className="text-xs py-2 px-2.5 rounded-lg border border-red-100 dark:border-red-900 text-red-400 dark:text-red-500 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {editando !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-5 text-gray-900 dark:text-zinc-100">{editando === 'nuevo' ? 'Nuevo hospedaje' : 'Editar hospedaje'}</h2>

            {error && <p className="text-xs text-red-500 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-3 text-sm">
              {/* Imagen principal */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Foto principal</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImagen} className="hidden" />
                {form.imagen ? (
                  <div className="relative">
                    <img src={form.imagen} alt="preview" className="w-full h-32 object-cover rounded-lg" />
                    <button type="button" onClick={() => { setForm(p => ({ ...p, imagen: '' })); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">✕ Quitar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendoImg}
                    className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg py-6 text-gray-400 dark:text-zinc-500 text-sm hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-50">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Nombre *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Destino (ej: Porto de Galinhas, PE)</label>
                  <input type="text" value={form.destino} onChange={e => setForm(p => ({ ...p, destino: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Ubicación (para filtrar)</label>
                  <input type="text" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Dirección</label>
                <input type="text" value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Descripción</label>
                <textarea rows={4} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Amenities / servicios</label>
                <div className="space-y-2">
                  {form.amenities.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={a} onChange={e => setAmenity(i, e.target.value)} placeholder="Ej: Piscina, Wifi Gratuito..."
                        className="flex-1 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                      {form.amenities.length > 1 && (
                        <button type="button" onClick={() => quitarAmenity(i)} className="text-gray-300 dark:text-zinc-700 hover:text-red-400 px-1">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={agregarAmenity} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
                    + Agregar amenity
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Estrellas (0-5)</label>
                  <input type="number" min="0" max="5" value={form.estrellas} onChange={e => setForm(p => ({ ...p, estrellas: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Capacidad</label>
                  <input type="number" min="0" value={form.capacidad} onChange={e => setForm(p => ({ ...p, capacidad: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Precio desde (R$)</label>
                  <input type="number" min="0" value={form.precio_min} onChange={e => setForm(p => ({ ...p, precio_min: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">WhatsApp de contacto (opcional)</label>
                  <input type="text" value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Email de contacto (opcional)</label>
                  <input type="text" value={form.contacto} onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {aBorrar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-center font-bold text-base text-gray-900 dark:text-zinc-100 mb-1">¿Eliminar hospedaje?</h3>
            <p className="text-center text-sm text-gray-400 dark:text-zinc-500 mb-6">
              "{aBorrar.nombre}" se va a eliminar y no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setABorrar(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={eliminar} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
