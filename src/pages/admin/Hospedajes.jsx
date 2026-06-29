import { useState, useMemo, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'

const HOTELES = [
  {
    id: 1,
    nombre: 'Vivá Porto de Galinhas',
    tipo: 'Resort',
    destino: 'Porto de Galinhas, PE',
    ubicacion: 'Porto de Galinhas',
    estrellas: 5,
    capacidad: 4,
    precioMin: 650,
    descripcion: 'Resort frente al mar con acceso directo a las piscinas naturales de Porto de Galinhas. Incluye desayuno, almuerzo y cena buffet. Piscinas, spa, animación nocturna y actividades acuáticas.',
    imagen: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80',
    contacto: 'reservas@viva.com.br',
    whatsapp: '558181000001',
  },
  {
    id: 2,
    nombre: 'Enotel Porto de Galinhas',
    tipo: 'Resort',
    destino: 'Porto de Galinhas, PE',
    ubicacion: 'Porto de Galinhas',
    estrellas: 5,
    capacidad: 2,
    precioMin: 900,
    descripcion: 'El resort más premiado de Porto de Galinhas. Arquitectura inspirada en el estilo colonial local, spa de lujo, piscinas temáticas y gastronomía de autor. Referencia en hospitalidad del Nordeste.',
    imagen: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&q=80',
    contacto: 'reservas@enotel.com.br',
    whatsapp: '558181000002',
  },
  {
    id: 3,
    nombre: 'Chalés de Maracaípe',
    tipo: 'Pousada',
    destino: 'Maracaípe, PE',
    ubicacion: 'Maracaípe',
    estrellas: 4,
    capacidad: 6,
    precioMin: 380,
    descripcion: 'Chalés independientes en un entorno natural único a orillas del río Maracaípe. Ambiente íntimo, piscina natural, kayak y acceso a pie a la playa de Maracaípe. Ideal para parejas y familias.',
    imagen: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80',
    contacto: 'reservas@chalesmaracaipe.com.br',
    whatsapp: '558181000003',
  },
]

const FILTROS = [
  { key: 'categorias',  label: 'Categoría',  opciones: ['Resort', 'Hotel', 'Pousada', 'Departamento'] },
  { key: 'ubicaciones', label: 'Ubicación',   opciones: Array.from(new Set(HOTELES.map(h => h.ubicacion))) },
  { key: 'capacidades', label: 'Personas',    opciones: ['1-2 personas', '3-4 personas', '5+ personas'] },
  { key: 'precios',     label: 'Precio',      opciones: ['Hasta R$500', 'R$500 – R$800', 'Más de R$800'] },
  { key: 'estrellas',   label: 'Estrellas',   opciones: ['★★★', '★★★★', '★★★★★'] },
]

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

  // ── Fondo header ──────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 42, 'F')

  // Título
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

    // ── Nueva página si no hay espacio ──────────────────────────────
    if (i > 0) {
      doc.addPage()
      y = 20
    }

    // ── Imagen ──────────────────────────────────────────────────────
    const imgData = await loadImgDataUrl(h.imagen)
    if (imgData) {
      doc.addImage(imgData, 'JPEG', margen, y, ancho, 72, undefined, 'FAST')
    } else {
      doc.setFillColor(226, 232, 240)
      doc.roundedRect(margen, y, ancho, 72, 3, 3, 'F')
    }
    y += 78

    // ── Tipo badge ──────────────────────────────────────────────────
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margen, y, 32, 7, 2, 2, 'F')
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(h.tipo.toUpperCase(), margen + 3, y + 5)
    y += 12

    // ── Nombre ──────────────────────────────────────────────────────
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(h.nombre, margen, y)
    y += 7

    // ── Estrellas ───────────────────────────────────────────────────
    doc.setTextColor(217, 119, 6)
    doc.setFontSize(11)
    doc.text('★'.repeat(h.estrellas) + '☆'.repeat(5 - h.estrellas), margen, y)
    y += 7

    // ── Ubicación y capacidad ───────────────────────────────────────
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`📍 ${h.destino}   ·   👥 Hasta ${h.capacidad} personas`, margen, y)
    y += 9

    // ── Precio ──────────────────────────────────────────────────────
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(`Desde R$ ${h.precioMin}`, margen, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('por noche', margen + 38, y)
    y += 10

    // ── Separador ───────────────────────────────────────────────────
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(margen, y, W - margen, y)
    y += 8

    // ── Descripción ─────────────────────────────────────────────────
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setLineHeightFactor(1.5)
    const lines = splitText(doc, h.descripcion, ancho)
    doc.text(lines, margen, y)
    y += lines.length * 6 + 10

    // ── Contacto ─────────────────────────────────────────────────────
    doc.setFillColor(240, 253, 244)
    doc.roundedRect(margen, y, ancho, 14, 3, 3, 'F')
    doc.setTextColor(22, 163, 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`WhatsApp: +${h.whatsapp}   ·   Email: ${h.contacto}`, margen + 5, y + 9)
    y += 20
  }

  // ── Footer en última página ───────────────────────────────────────
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

  const nombreArchivo = `Propuesta_Hospedaje_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nombreArchivo)
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
  return <span className="text-amber-400 text-sm tracking-tight">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

export default function Hospedajes() {
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState({ categorias: [], ubicaciones: [], capacidades: [], precios: [], estrellas: [] })
  const [seleccionados, setSeleccionados] = useState([])
  const [generando, setGenerando] = useState(false)

  function setFiltro(key, val) {
    setSeleccion(prev => ({ ...prev, [key]: val }))
  }

  const hayFiltros = busqueda || Object.values(seleccion).some(v => v.length > 0)

  function resetFiltros() {
    setBusqueda('')
    setSeleccion({ categorias: [], ubicaciones: [], capacidades: [], precios: [], estrellas: [] })
  }

  function toggleSeleccion(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const filtrados = useMemo(() => {
    return HOTELES.filter(h => {
      if (busqueda && !h.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !h.destino.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (seleccion.categorias.length && !seleccion.categorias.includes(h.tipo)) return false
      if (seleccion.ubicaciones.length && !seleccion.ubicaciones.includes(h.ubicacion)) return false
      if (seleccion.capacidades.length) {
        const ok = seleccion.capacidades.some(c => {
          if (c === '1-2 personas') return h.capacidad <= 2
          if (c === '3-4 personas') return h.capacidad >= 3 && h.capacidad <= 4
          if (c === '5+ personas') return h.capacidad >= 5
          return false
        })
        if (!ok) return false
      }
      if (seleccion.precios.length) {
        const ok = seleccion.precios.some(p => {
          if (p === 'Hasta R$500') return h.precioMin <= 500
          if (p === 'R$500 – R$800') return h.precioMin > 500 && h.precioMin <= 800
          if (p === 'Más de R$800') return h.precioMin > 800
          return false
        })
        if (!ok) return false
      }
      if (seleccion.estrellas.length) {
        if (!seleccion.estrellas.some(e => e.length === h.estrellas)) return false
      }
      return true
    })
  }, [busqueda, seleccion])

  async function exportar() {
    const hotelesExportar = HOTELES.filter(h => seleccionados.includes(h.id))
    if (!hotelesExportar.length) return
    setGenerando(true)
    try {
      await generarPDF(hotelesExportar)
    } finally {
      setGenerando(false)
    }
  }

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
        {FILTROS.map(f => (
          <DropdownFiltro key={f.key} label={f.label} opciones={f.opciones}
            seleccionados={seleccion[f.key]} onChange={val => setFiltro(f.key, val)} />
        ))}
        {hayFiltros && (
          <button onClick={resetFiltros} className="text-xs text-red-500 dark:text-red-400 hover:underline font-medium ml-1">Limpiar</button>
        )}
      </div>

      {/* Tip selección */}
      {seleccionados.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Seleccioná uno o más hospedajes para habilitar la exportación.
        </p>
      )}

      {/* Resultados */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">Ningún hospedaje coincide con los filtros.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtrados.map(h => {
            const estaSeleccionado = seleccionados.includes(h.id)
            return (
              <div
                key={h.id}
                onClick={() => toggleSeleccion(h.id)}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border-2 overflow-hidden flex flex-col cursor-pointer transition-all ${
                  estaSeleccionado
                    ? 'border-brand-500 shadow-md shadow-brand-500/10'
                    : 'border-transparent hover:border-gray-200 dark:hover:border-zinc-700'
                }`}
                style={{ outline: estaSeleccionado ? undefined : '1px solid #e5e7eb' }}
              >
                <div className="relative h-52 overflow-hidden">
                  <img src={h.imagen} alt={h.nombre} className="w-full h-full object-cover" />
                  <span className="absolute top-3 left-3 bg-white/90 dark:bg-zinc-900/90 text-gray-700 dark:text-zinc-200 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                    {h.tipo}
                  </span>
                  {/* Checkbox selección */}
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
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{h.destino}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">Hasta {h.capacidad} personas</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed flex-1">{h.descripcion}</p>
                  <div className="pt-3 mt-auto border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500">Desde</p>
                      <p className="font-bold text-base text-gray-900 dark:text-zinc-100">R$ {h.precioMin}<span className="text-xs font-normal text-gray-400">/noche</span></p>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <a href={`https://wa.me/${h.whatsapp}`} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors">
                        WhatsApp
                      </a>
                      <a href={`mailto:${h.contacto}`}
                        className="text-sm font-medium py-2 px-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 transition-colors">
                        Email
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
