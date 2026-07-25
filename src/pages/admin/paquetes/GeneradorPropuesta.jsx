import { useState, useEffect, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import { excursionesApi, clientesApi, propuestasApi } from '../../../lib/supabase.js'

async function loadImgDataUrl(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null)
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

function formatPrecio(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

async function generarPDF(cliente, items, total) {
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
  doc.text(`Propuesta de Paquete — ${cliente.nombre}`, margen, 26)
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(9)
  doc.text(`Generado el ${fecha}`, margen, 34)

  let y = 54

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (i > 0) { doc.addPage(); y = 20 }

    const imgData = await loadImgDataUrl(it.imagen)
    if (imgData) {
      doc.addImage(imgData, 'JPEG', margen, y, ancho, 72, undefined, 'FAST')
    } else {
      doc.setFillColor(226, 232, 240)
      doc.roundedRect(margen, y, ancho, 72, 3, 3, 'F')
    }
    y += 78

    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(it.nombre, margen, y)
    y += 8

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`📍 ${it.destino || ''}`, margen, y)
    y += 10

    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(`${formatPrecio(it.precio)} x ${it.cantidad}`, margen, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`= ${formatPrecio(it.precio * it.cantidad)}`, margen + 62, y)
    y += 10

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(margen, y, W - margen, y)
    y += 8

    if (it.descripcion) {
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setLineHeightFactor(1.5)
      const lines = doc.splitTextToSize(it.descripcion, ancho)
      doc.text(lines, margen, y)
      y += lines.length * 6 + 10
    }
  }

  doc.addPage()
  doc.setFillColor(240, 253, 244)
  doc.roundedRect(margen, 30, ancho, 24, 3, 3, 'F')
  doc.setTextColor(22, 163, 74)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`Total de la propuesta: ${formatPrecio(total)}`, margen + 6, 46)

  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Cliente: ${cliente.nombre}`, margen, 66)
  if (cliente.whatsapp) doc.text(`WhatsApp: +${cliente.whatsapp}`, margen, 73)

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

  doc.save(`Propuesta_${cliente.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export default function GeneradorPropuesta() {
  const [excursiones, setExcursiones] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqCliente, setBusqCliente] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cantidadPasajeros, setCantidadPasajeros] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [presupuestoLimite, setPresupuestoLimite] = useState('')
  const [seleccionados, setSeleccionados] = useState({})
  const [precios, setPrecios] = useState({})
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [{ data: ex }, { data: cl }] = await Promise.all([
        excursionesApi.getAll(),
        clientesApi.getAll(),
      ])
      setExcursiones((ex || []).filter(e => e.categoria === 'paquetes'))
      setClientes(cl || [])
      setLoading(false)
    }
    cargar()
  }, [])

  function buscarCliente(texto) {
    setBusqCliente(texto)
    setClienteSel(null)
    if (texto.length < 2) return setSugerencias([])
    const lower = texto.toLowerCase()
    setSugerencias(clientes.filter(c => c.nombre?.toLowerCase().includes(lower) || c.whatsapp?.includes(texto)).slice(0, 5))
  }

  function elegirCliente(c) {
    setClienteSel(c)
    setBusqCliente(c.nombre)
    setClienteWhatsapp(c.whatsapp || '')
    setSugerencias([])
  }

  function toggleItem(ex) {
    setSeleccionados(prev => {
      const next = { ...prev }
      if (next[ex.id]) delete next[ex.id]
      else next[ex.id] = 1
      return next
    })
    setPrecios(prev => ({ ...prev, [ex.id]: prev[ex.id] ?? ex.precio }))
  }

  const items = useMemo(() => {
    return Object.entries(seleccionados).map(([id, cantidad]) => {
      const ex = excursiones.find(e => e.id === id)
      if (!ex) return null
      return { ...ex, cantidad, precio: parseFloat(precios[id]) || 0 }
    }).filter(Boolean)
  }, [seleccionados, precios, excursiones])

  const total = items.reduce((sum, it) => sum + it.precio * it.cantidad, 0)

  async function generar() {
    if (!busqCliente.trim()) return setError('Ingresá el nombre del cliente.')
    if (items.length === 0) return setError('Seleccioná al menos un paquete.')
    setError('')
    setGenerando(true)
    setExito(false)
    try {
      const cliente = { nombre: busqCliente.trim(), whatsapp: clienteWhatsapp.trim() }
      await generarPDF(cliente, items, total)
      await propuestasApi.create({
        cliente_id: clienteSel?.id || null,
        cliente_nombre: cliente.nombre,
        cliente_whatsapp: cliente.whatsapp || null,
        cantidad_pasajeros: parseInt(cantidadPasajeros) || null,
        periodo: periodo.trim() || null,
        presupuesto_limite: parseFloat(presupuestoLimite) || null,
        items: items.map(it => ({ excursion_id: it.id, nombre: it.nombre, precio: it.precio, cantidad: it.cantidad })),
        total,
        moneda: 'BRL',
        estado: 'enviada',
      })
      setExito(true)
      setSeleccionados({})
      setPrecios({})
      setBusqCliente('')
      setClienteWhatsapp('')
      setClienteSel(null)
      setCantidadPasajeros('')
      setPeriodo('')
      setPresupuestoLimite('')
    } catch (e) {
      setError('Error al generar la propuesta: ' + (e.message || 'intentá de nuevo'))
    }
    setGenerando(false)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Generador de propuesta</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Armá una propuesta con uno o más paquetes y generá el PDF para enviar al cliente</p>
      </div>

      {/* Cliente */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Cliente</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative">
            <input
              type="text"
              value={busqCliente}
              onChange={e => buscarCliente(e.target.value)}
              placeholder="Buscar cliente existente o escribir nombre..."
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {sugerencias.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                {sugerencias.map(c => (
                  <button key={c.id} type="button" onClick={() => elegirCliente(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 dark:text-zinc-200">{c.nombre}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{c.whatsapp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="text"
            value={clienteWhatsapp}
            onChange={e => setClienteWhatsapp(e.target.value)}
            placeholder="WhatsApp (5581999999999)"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="number"
            min="1"
            value={cantidadPasajeros}
            onChange={e => setCantidadPasajeros(e.target.value)}
            placeholder="Cantidad de pasajeros"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            type="text"
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            placeholder="Período (Ej: 15 al 22 de agosto)"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <input
          type="number"
          value={presupuestoLimite}
          onChange={e => setPresupuestoLimite(e.target.value)}
          placeholder="Presupuesto límite (R$)"
          className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Paquetes */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Paquetes disponibles</h3>
        {excursiones.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">No hay excursiones con categoría "Paquetes aéreos" cargadas todavía.</p>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {excursiones.map(ex => {
              const activo = !!seleccionados[ex.id]
              return (
                <div key={ex.id}
                  className={`bg-white dark:bg-zinc-900 rounded-2xl border-2 overflow-hidden flex flex-col transition-all ${
                    activo ? 'border-brand-500 shadow-md shadow-brand-500/10' : 'border-transparent'
                  }`}
                  style={{ outline: activo ? undefined : '1px solid #e5e7eb' }}
                >
                  {ex.imagen && <img src={ex.imagen} alt={ex.nombre} className="w-full h-36 object-cover cursor-pointer" onClick={() => toggleItem(ex)} />}
                  <div className="p-4 flex flex-col gap-2">
                    <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-sm cursor-pointer" onClick={() => toggleItem(ex)}>{ex.nombre}</h4>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{ex.destino}</p>
                    <button
                      onClick={() => toggleItem(ex)}
                      className={`text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                        activo ? 'bg-brand-600 dark:bg-brand-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                      }`}
                    >
                      {activo ? '✓ Incluido en la propuesta' : '+ Agregar a la propuesta'}
                    </button>
                    {activo && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                        <div>
                          <label className="text-[10px] text-gray-400 dark:text-zinc-500 block">Precio (R$)</label>
                          <input type="number" value={precios[ex.id] ?? ex.precio}
                            onChange={e => setPrecios(p => ({ ...p, [ex.id]: e.target.value }))}
                            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 dark:text-zinc-500 block">Cantidad</label>
                          <input type="number" min="1" value={seleccionados[ex.id]}
                            onChange={e => setSeleccionados(s => ({ ...s, [ex.id]: parseInt(e.target.value) || 1 }))}
                            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Resumen y generar */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 sticky bottom-4 shadow-lg">
          {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}
          {exito && <p className="text-xs text-green-600 dark:text-green-400 mb-3 bg-green-50 dark:bg-green-950/40 px-3 py-2 rounded-lg">✓ Propuesta generada y descargada correctamente.</p>}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 dark:text-zinc-500">{items.length} paquete{items.length !== 1 ? 's' : ''} seleccionado{items.length !== 1 ? 's' : ''}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">Total: {formatPrecio(total)}</p>
            </div>
            <button
              onClick={generar}
              disabled={generando}
              className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              {generando ? 'Generando...' : '📄 Generar propuesta (PDF)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
