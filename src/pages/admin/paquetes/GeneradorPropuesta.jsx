import { useState, useEffect } from 'react'
import { excursionesApi, clientesApi, propuestasApi, subirImagen, hospedajesApi, importarHospedajesDeLink, extraerDatosVuelo } from '../../../lib/supabase.js'

const NAVY = '#0d2438'
const CREMA = '#efe9db'
const ANCHO = 794
const ALTO = 1123
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const VUELO_VACIO = {
  origen_ciudad: '', origen_codigo: '', destino_ciudad: '', destino_codigo: '',
  ida_fecha: '', ida_sale: '', ida_llega: '',
  vuelta_fecha: '', vuelta_sale: '', vuelta_llega: '',
  banner_destino: '', banner_link: '', banner_imagen: '',
}

const HOSPEDAJE_VACIO = {
  nombre: '', subtitulo: '', imagen: '', noches: '', precio: '', moneda: 'ARS',
  incluye: 'Aéreo + Hospedaje + Traslados', pension: '', descripcion: '',
  items_titulo: 'Servicios:', items: [''], nota: '', link_video: '',
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function formatearNumero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}

function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_LARGOS[m - 1]}`
}

const FUENTE_TITULOS = "'Bebas Neue', Arial, sans-serif"
const FUENTE_CUERPO = "'Helvetica Neue', Helvetica, Arial, sans-serif"

// Íconos en línea (sin emojis): mismo estilo lineal blanco usado en el resto del panel.
const ICONOS = {
  avion: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>`,
  maleta: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
  auto: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l1.6-5a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4L19 13"/><rect x="2" y="13" width="20" height="5" rx="1.5"/><circle cx="7" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>`,
  calendario: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  hotel: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>`,
}

// Arma el documento HTML completo que se abre en una ventana nueva para
// imprimir con el motor real del navegador (Ctrl+P → Guardar como PDF).
// ANCHO/ALTO (794×1123px) equivalen a A4 a 96dpi, así que las páginas
// armadas en htmlPaginaAereos/htmlPaginaHospedajes entran tal cual, sin
// tener que tocar ni un px de esos estilos.
function documentoCompleto(paginasHtml, tituloCliente) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Propuesta${tituloCliente ? ' - ' + escapeHtml(tituloCliente) : ''}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { margin: 0; padding: 0; background: #fff; }
  @page { size: ${ANCHO}px ${ALTO}px; margin: 0; }
  @media print {
    .pagina { break-after: page; }
    .pagina:last-child { break-after: auto; }
  }
</style>
</head>
<body>
  ${paginasHtml.map(html => `<div class="pagina">${html}</div>`).join('')}
</body>
</html>`
}

// Espera a que la ventana nueva termine de cargar (documento, fuentes e
// imágenes) antes de mandar a imprimir — si no, puede salir con la fuente
// de sistema o con fotos a medio cargar.
async function esperarCarga(ventana) {
  await new Promise((resolve) => {
    if (ventana.document.readyState === 'complete') resolve()
    else ventana.addEventListener('load', resolve, { once: true })
  })
  try { if (ventana.document.fonts?.ready) await ventana.document.fonts.ready } catch (_) {}
  const imgs = Array.from(ventana.document.images)
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res }))))
  await new Promise((res) => setTimeout(res, 300))
}

function htmlPaginaAereos({ clienteNombre, cantidadPasajeros, vuelo }) {
  const bannerVisible = vuelo.banner_link && vuelo.banner_destino
  return `
  <div style="width:${ANCHO}px;height:${ALTO}px;background:${CREMA};font-family:${FUENTE_CUERPO};position:relative;box-sizing:border-box;">
    <div style="background:${NAVY};padding:36px 48px 30px;">
      <p style="font-family:${FUENTE_TITULOS};font-weight:400;color:#fff;font-size:34px;letter-spacing:1px;margin:0 0 22px;border-bottom:3px solid #fff;padding-bottom:10px;display:inline-block;">PAQUETE DE VIAJE</p>
      <p style="font-family:${FUENTE_TITULOS};color:#fff;font-size:15px;letter-spacing:2px;margin:0 0 4px;text-transform:uppercase;">Nombre del cliente:</p>
      <p style="color:#cfe3ee;font-size:16px;margin:0 0 16px;text-transform:uppercase;">${escapeHtml(clienteNombre)}</p>
      <p style="font-family:${FUENTE_TITULOS};color:#fff;font-size:15px;letter-spacing:2px;margin:0 0 4px;text-transform:uppercase;">Cotización personalizada para:</p>
      <p style="color:#cfe3ee;font-size:16px;margin:0;text-transform:uppercase;">${escapeHtml(cantidadPasajeros || '—')} ${Number(cantidadPasajeros) === 1 ? 'ADULTO' : 'ADULTOS'}</p>
    </div>

    <div style="padding:36px 48px;">
      <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:28px;margin:0 0 26px;">AÉREOS:</p>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:26px;">
        <div style="width:34px;height:34px;border-radius:50%;background:${NAVY};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${ICONOS.maleta(16)}
        </div>
        <div>
          <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:17px;margin:4px 0 8px;letter-spacing:0.5px;">EQUIPAJE INCLUIDO:</p>
          <p style="color:#333;font-size:13px;margin:0 0 4px;">- 1 mochila o bolso</p>
          <p style="color:#333;font-size:13px;margin:0 0 4px;">- 1 artículo personal</p>
          <p style="color:#333;font-size:13px;margin:0;">- 1 valija carry-on (en cabina)</p>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:30px;">
        <div style="width:34px;height:34px;border-radius:50%;background:${NAVY};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${ICONOS.auto(16)}
        </div>
        <div>
          <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:17px;margin:4px 0 8px;letter-spacing:0.5px;">TRASLADOS PRIVADOS INCLUIDOS:</p>
          <p style="color:#333;font-size:13px;margin:0 0 4px;">Aeropuerto / Hotel</p>
          <p style="color:#333;font-size:13px;margin:0;">In - Out</p>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:34px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="width:22px;height:22px;border-radius:50%;background:${NAVY};display:inline-flex;align-items:center;justify-content:center;">${ICONOS.calendario(12)}</span>
            <span style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:17px;">IDA:</span>
            <span style="color:#333;font-size:14px;">${fechaLarga(vuelo.ida_fecha)}</span>
          </div>
          <p style="font-size:13px;color:#333;margin:0 0 4px;"><b>SALE</b> de ${escapeHtml(vuelo.origen_ciudad)} (${escapeHtml(vuelo.origen_codigo)}) <b>${escapeHtml(vuelo.ida_sale)} HS</b></p>
          <p style="font-size:13px;color:#333;margin:0;"><b>LLEGA</b> a ${escapeHtml(vuelo.destino_ciudad)} (${escapeHtml(vuelo.destino_codigo)}) <b>${escapeHtml(vuelo.ida_llega)} HS</b></p>
          <div style="border-top:2px solid ${NAVY};margin-top:14px;width:90%;"></div>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="width:22px;height:22px;border-radius:50%;background:${NAVY};display:inline-flex;align-items:center;justify-content:center;">${ICONOS.calendario(12)}</span>
            <span style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:17px;">VUELTA:</span>
            <span style="color:#333;font-size:14px;">${fechaLarga(vuelo.vuelta_fecha)}</span>
          </div>
          <p style="font-size:13px;color:#333;margin:0 0 4px;"><b>SALE</b> de ${escapeHtml(vuelo.destino_ciudad)} (${escapeHtml(vuelo.destino_codigo)}) <b>${escapeHtml(vuelo.vuelta_sale)} HS</b></p>
          <p style="font-size:13px;color:#333;margin:0;"><b>LLEGA</b> a ${escapeHtml(vuelo.origen_ciudad)} (${escapeHtml(vuelo.origen_codigo)}) <b>${escapeHtml(vuelo.vuelta_llega)} HS</b></p>
          <div style="border-top:2px solid ${NAVY};margin-top:14px;width:90%;margin-left:auto;"></div>
        </div>
      </div>

      ${bannerVisible ? `
      <div style="background:${NAVY};border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <p style="font-family:${FUENTE_TITULOS};color:#fff;font-size:15px;margin:0;line-height:1.4;max-width:420px;">SI TE INTERESA VER LAS ACTIVIDADES Y PASEOS QUE OFRECEMOS EN ${escapeHtml(vuelo.banner_destino).toUpperCase()} HACÉ CLIC ACÁ ↗</p>
        ${vuelo.banner_imagen ? `<div style="width:70px;height:50px;border-radius:6px;overflow:hidden;flex-shrink:0;"><img src="${vuelo.banner_imagen}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>` : ''}
      </div>` : ''}
    </div>

    <div style="position:absolute;bottom:0;left:0;width:100%;background:${NAVY};padding:20px 0;text-align:center;">
      <img src="${window.location.origin}/logo-blanco.png" style="height:44px;opacity:0.95;" />
    </div>
  </div>`
}

function htmlPaginaHospedajes(grupo) {
  return `
  <div style="width:${ANCHO}px;height:${ALTO}px;background:${CREMA};font-family:${FUENTE_CUERPO};position:relative;box-sizing:border-box;">
    <div style="background:${NAVY};padding:28px 48px;display:flex;align-items:center;gap:14px;">
      ${ICONOS.hotel(22)}
      <p style="font-family:${FUENTE_TITULOS};color:#fff;font-size:30px;margin:0;letter-spacing:1px;">HOSPEDAJES</p>
    </div>
    <div style="padding:32px 48px;">
      ${grupo.map((h, idx) => `
        <div style="${idx > 0 ? `border-top:1.5px solid #0d243880;margin-top:26px;padding-top:26px;` : ''}">
          <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:23px;margin:0 0 2px;">${escapeHtml(h.nombre).toUpperCase()}</p>
          <p style="font-family:${FUENTE_CUERPO};color:#888;font-size:12px;letter-spacing:1px;margin:0 0 14px;text-transform:uppercase;">${escapeHtml(h.subtitulo)}</p>
          <div style="display:flex;gap:22px;flex-direction:${idx % 2 === 0 ? 'row' : 'row-reverse'};">
            <div style="flex:1;">
              ${h.imagen ? `<div style="border-radius:10px;overflow:hidden;margin-bottom:8px;"><img src="${h.imagen}" style="width:100%;height:150px;object-fit:cover;display:block;" /></div>` : ''}
              ${h.link_video ? `<p style="font-family:${FUENTE_CUERPO};color:#0a8a5f;font-size:11px;font-weight:700;margin:0;">CLIC ACÁ PARA VER VIDEOS ↗</p>` : ''}
            </div>
            <div style="flex:1;font-family:${FUENTE_CUERPO};">
              <p style="color:${NAVY};font-size:12px;font-weight:700;margin:0 0 2px;">${escapeHtml(h.noches)} NOCHES:</p>
              <p style="color:${NAVY};font-size:16px;font-weight:700;margin:0 0 4px;">${escapeHtml(h.moneda)}$ ${formatearNumero(h.precio)}</p>
              <p style="color:#333;font-size:11px;margin:0 0 2px;">${escapeHtml(h.incluye)}</p>
              <p style="color:#333;font-size:11px;font-weight:700;margin:0 0 10px;">${escapeHtml(h.pension)}</p>
              ${h.descripcion ? `<p style="color:#333;font-size:11px;font-weight:400;line-height:1.6;margin:0 0 10px;">${escapeHtml(h.descripcion)}</p>` : ''}
              ${h.items.filter(Boolean).length ? `
                <p style="color:${NAVY};font-size:11px;font-weight:700;margin:0 0 4px;">${escapeHtml(h.items_titulo)}</p>
                ${h.items.filter(Boolean).map(it => `<p style="color:#333;font-size:11px;font-weight:400;margin:0 0 2px;">- ${escapeHtml(it)}</p>`).join('')}
              ` : ''}
              ${h.nota ? `<p style="color:#888;font-size:10px;font-style:italic;margin:8px 0 0;">${escapeHtml(h.nota)}</p>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="position:absolute;bottom:0;left:0;width:100%;background:${NAVY};padding:20px 0;text-align:center;">
      <img src="${window.location.origin}/logo-blanco.png" style="height:44px;opacity:0.95;" />
    </div>
  </div>`
}

export default function GeneradorPropuesta() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqCliente, setBusqCliente] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cantidadPasajeros, setCantidadPasajeros] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [presupuestoLimite, setPresupuestoLimite] = useState('')
  const [vuelo, setVuelo] = useState(VUELO_VACIO)
  const [leyendoVuelo, setLeyendoVuelo] = useState(false)
  const [errorVuelo, setErrorVuelo] = useState('')
  const [hospedajes, setHospedajes] = useState([{ ...HOSPEDAJE_VACIO, items: [''] }])
  const [hospedajesDB, setHospedajesDB] = useState([])
  const [subiendoIdx, setSubiendoIdx] = useState(null)
  const [subiendoBanner, setSubiendoBanner] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [linkImportar, setLinkImportar] = useState('')
  const [importando, setImportando] = useState(false)
  const [errorImportar, setErrorImportar] = useState('')
  const [resultadosImportar, setResultadosImportar] = useState([])
  const [seleccionadosImportar, setSeleccionadosImportar] = useState(new Set())

  useEffect(() => {
    async function cargar() {
      const { data: cl } = await clientesApi.getAll()
      setClientes(cl || [])
      const { data: hs } = await hospedajesApi.getAll()
      setHospedajesDB(hs || [])
      setLoading(false)
    }
    cargar()
    excursionesApi.getAll()
  }, [])

  // Sugerencias de hospedajes ya cargados en el modulo Hospedajes, para
  // autocompletar nombre/foto/descripcion/amenities al armar la propuesta.
  function sugerenciasHospedaje(texto) {
    if (!texto || texto.trim().length < 2) return []
    const lower = texto.trim().toLowerCase()
    return hospedajesDB.filter(h => h.nombre.toLowerCase().includes(lower) && h.nombre.toLowerCase() !== lower).slice(0, 5)
  }

  function elegirHospedajeDB(idx, hDB) {
    setHospedajes(prev => prev.map((h, i) => i === idx ? {
      ...h,
      nombre: hDB.nombre,
      subtitulo: [hDB.tipo, hDB.destino].filter(Boolean).join(' · '),
      imagen: hDB.imagen || h.imagen,
      descripcion: hDB.descripcion || h.descripcion,
      items_titulo: (hDB.amenities || []).length ? 'Servicios:' : h.items_titulo,
      items: (hDB.amenities || []).length ? hDB.amenities : h.items,
    } : h))
  }

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

  function setVueloCampo(campo, valor) {
    setVuelo(v => ({ ...v, [campo]: valor }))
  }

  async function subirImagenBanner(archivo) {
    if (!archivo) return
    setSubiendoBanner(true)
    const { url } = await subirImagen(archivo)
    if (url) setVueloCampo('banner_imagen', url)
    setSubiendoBanner(false)
  }

  function archivoABase64(archivo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(archivo)
    })
  }

  async function leerImagenVuelo(archivo) {
    if (!archivo) return
    setErrorVuelo('')
    setLeyendoVuelo(true)
    try {
      const base64 = await archivoABase64(archivo)
      const { data, error } = await extraerDatosVuelo(base64, archivo.type || 'image/png')
      if (error || data?.error) {
        setErrorVuelo(data?.error || error?.message || 'No se pudo leer la imagen.')
      } else if (data?.vuelo) {
        setVuelo(v => {
          const next = { ...v }
          for (const campo of Object.keys(data.vuelo)) {
            if (data.vuelo[campo]) next[campo] = data.vuelo[campo]
          }
          return next
        })
      }
    } catch (_) {
      setErrorVuelo('No se pudo leer la imagen.')
    }
    setLeyendoVuelo(false)
  }

  function agregarHospedaje() {
    setHospedajes(prev => [...prev, { ...HOSPEDAJE_VACIO, items: [''] }])
  }

  function quitarHospedaje(idx) {
    setHospedajes(prev => prev.filter((_, i) => i !== idx))
  }

  async function importarLink() {
    setErrorImportar('')
    setResultadosImportar([])
    setImportando(true)
    const { data, error } = await importarHospedajesDeLink(linkImportar.trim())
    setImportando(false)
    if (error || data?.error) {
      setErrorImportar(data?.error || error?.message || 'No se pudo leer ese link.')
      return
    }
    const encontrados = data?.hospedajes || []
    setResultadosImportar(encontrados)
    setSeleccionadosImportar(new Set(encontrados.map(h => h.hotel_id)))
  }

  function toggleSeleccionImportar(hotelId) {
    setSeleccionadosImportar(prev => {
      const next = new Set(prev)
      next.has(hotelId) ? next.delete(hotelId) : next.add(hotelId)
      return next
    })
  }

  function agregarHospedajesImportados() {
    const elegidos = resultadosImportar.filter(r => seleccionadosImportar.has(r.hotel_id))
    if (!elegidos.length) return
    const nuevos = elegidos.map(r => ({
      ...HOSPEDAJE_VACIO,
      nombre: r.nombre || '',
      subtitulo: [r.tipo, r.destino].filter(Boolean).join(' · '),
      imagen: r.imagen || '',
      noches: r.noches || '',
      precio: r.precio || '',
      moneda: r.moneda || 'BRL',
      pension: r.pension || '',
      descripcion: r.descripcion || '',
      items_titulo: (r.amenities || []).length ? 'Servicios:' : 'Servicios:',
      items: (r.amenities || []).length ? r.amenities : [''],
    }))
    setHospedajes(prev => {
      // Si solo hay un hospedaje vacío sin cargar todavía, se reemplaza en vez de sumarse.
      const base = prev.length === 1 && !prev[0].nombre.trim() ? [] : prev
      return [...base, ...nuevos]
    })
    setResultadosImportar([])
    setLinkImportar('')
    setSeleccionadosImportar(new Set())
  }

  function setHospedajeCampo(idx, campo, valor) {
    setHospedajes(prev => prev.map((h, i) => i === idx ? { ...h, [campo]: valor } : h))
  }

  async function subirImagenHospedaje(idx, archivo) {
    if (!archivo) return
    setSubiendoIdx(idx)
    const { url } = await subirImagen(archivo)
    if (url) setHospedajeCampo(idx, 'imagen', url)
    setSubiendoIdx(null)
  }

  function setItemsHospedaje(idx, texto) {
    const items = texto.split(',').map(s => s.trim())
    setHospedajes(prev => prev.map((h, i) => i === idx ? { ...h, items } : h))
  }

  const total = hospedajes.reduce((sum, h) => sum + (parseFloat(h.precio) || 0), 0)

  function generar() {
    if (!busqCliente.trim()) return setError('Ingresá el nombre del cliente.')
    if (!hospedajes.some(h => h.nombre.trim())) return setError('Cargá al menos un hospedaje con nombre.')
    setError('')

    // window.open tiene que llamarse synchronously, en el mismo tick del
    // click, si no el navegador lo trata como pop-up y lo bloquea.
    const ventana = window.open('', '_blank')
    if (!ventana) {
      setError('El navegador bloqueó la ventana de impresión. Habilitá los pop-ups para este sitio e intentá de nuevo.')
      return
    }

    generarEnVentana(ventana)
  }

  async function generarEnVentana(ventana) {
    setGenerando(true)
    setExito(false)
    try {
      const cliente = { nombre: busqCliente.trim(), whatsapp: clienteWhatsapp.trim() }
      const hospedajesValidos = hospedajes.filter(h => h.nombre.trim())

      const paginas = [htmlPaginaAereos({ clienteNombre: cliente.nombre, cantidadPasajeros, vuelo })]
      for (let i = 0; i < hospedajesValidos.length; i += 2) {
        paginas.push(htmlPaginaHospedajes(hospedajesValidos.slice(i, i + 2)))
      }

      const blob = new Blob([documentoCompleto(paginas, cliente.nombre)], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      ventana.location = url

      await esperarCarga(ventana)
      ventana.focus()
      ventana.print()

      await propuestasApi.create({
        cliente_id: clienteSel?.id || null,
        cliente_nombre: cliente.nombre,
        cliente_whatsapp: cliente.whatsapp || null,
        cantidad_pasajeros: parseInt(cantidadPasajeros) || null,
        periodo: periodo.trim() || null,
        presupuesto_limite: parseFloat(presupuestoLimite) || null,
        vuelo,
        hospedajes_detalle: hospedajesValidos,
        items: [],
        total,
        moneda: hospedajesValidos[0]?.moneda === 'ARS' ? 'ARS' : (hospedajesValidos[0]?.moneda || 'BRL'),
        estado: 'enviada',
      })

      setExito(true)
      setBusqCliente('')
      setClienteWhatsapp('')
      setClienteSel(null)
      setCantidadPasajeros('')
      setPeriodo('')
      setPresupuestoLimite('')
      setVuelo(VUELO_VACIO)
      setHospedajes([{ ...HOSPEDAJE_VACIO, items: [''] }])
    } catch (e) {
      setError('Error al generar la propuesta: ' + (e.message || 'intentá de nuevo'))
      ventana.close()
    }
    setGenerando(false)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Generador de propuesta</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Cargá el vuelo y los hospedajes, y generá el PDF "Paquete de viaje" para enviar al cliente</p>
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

      {/* Vuelo */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Vuelo</h3>
          <label className="text-xs text-brand-600 dark:text-brand-400 cursor-pointer whitespace-nowrap">
            {leyendoVuelo ? 'Leyendo imagen...' : '+ Cargar desde imagen'}
            <input type="file" accept="image/*" className="hidden" disabled={leyendoVuelo}
              onChange={e => leerImagenVuelo(e.target.files[0])} />
          </label>
        </div>
        {errorVuelo && <p className="text-xs text-red-500 dark:text-red-400">{errorVuelo}</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={vuelo.origen_ciudad} onChange={e => setVueloCampo('origen_ciudad', e.target.value)} placeholder="Ciudad de origen (Ej: Ezeiza)"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <input value={vuelo.origen_codigo} onChange={e => setVueloCampo('origen_codigo', e.target.value.toUpperCase())} placeholder="Código origen (Ej: EZE)"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <input value={vuelo.destino_ciudad} onChange={e => setVueloCampo('destino_ciudad', e.target.value)} placeholder="Ciudad de destino (Ej: Recife)"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <input value={vuelo.destino_codigo} onChange={e => setVueloCampo('destino_codigo', e.target.value.toUpperCase())} placeholder="Código destino (Ej: REC)"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Fecha ida</label>
            <input type="date" value={vuelo.ida_fecha} onChange={e => setVueloCampo('ida_fecha', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Sale (ida)</label>
            <input type="time" value={vuelo.ida_sale} onChange={e => setVueloCampo('ida_sale', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Llega (ida)</label>
            <input type="time" value={vuelo.ida_llega} onChange={e => setVueloCampo('ida_llega', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Fecha vuelta</label>
            <input type="date" value={vuelo.vuelta_fecha} onChange={e => setVueloCampo('vuelta_fecha', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Sale (vuelta)</label>
            <input type="time" value={vuelo.vuelta_sale} onChange={e => setVueloCampo('vuelta_sale', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Llega (vuelta)</label>
            <input type="time" value={vuelo.vuelta_llega} onChange={e => setVueloCampo('vuelta_llega', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Banner "ver actividades" (opcional — si lo dejás vacío, no aparece en el PDF)</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={vuelo.banner_destino} onChange={e => setVueloCampo('banner_destino', e.target.value)} placeholder="Destino a mostrar (Ej: Porto)"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <input value={vuelo.banner_link} onChange={e => setVueloCampo('banner_link', e.target.value)} placeholder="Link de actividades"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <label className="mt-2 inline-block text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
            {subiendoBanner ? 'Subiendo...' : vuelo.banner_imagen ? '✓ Imagen del banner cargada — cambiar' : '+ Imagen del banner'}
            <input type="file" accept="image/*" className="hidden" onChange={e => subirImagenBanner(e.target.files[0])} />
          </label>
        </div>
      </div>

      {/* Hospedajes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Hospedajes</h3>
          <button onClick={agregarHospedaje} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
            + Agregar hospedaje
          </button>
        </div>

        {/* Importar desde link de cotización */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Pegar link de cotización (Niara)</p>
          <div className="flex gap-2">
            <input value={linkImportar} onChange={e => setLinkImportar(e.target.value)}
              placeholder="https://my-reservations.niara.tech/dreamstours/quotations/link/..."
              className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <button onClick={importarLink} disabled={importando || !linkImportar.trim()}
              className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0">
              {importando ? 'Leyendo...' : 'Importar'}
            </button>
          </div>
          {errorImportar && <p className="text-xs text-red-500 dark:text-red-400">{errorImportar}</p>}

          {resultadosImportar.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <p className="text-xs text-gray-500 dark:text-zinc-400">Encontramos {resultadosImportar.length} hospedaje{resultadosImportar.length !== 1 ? 's' : ''} en ese link — elegí cuáles agregar:</p>
              {resultadosImportar.map(r => (
                <label key={r.hotel_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer">
                  <input type="checkbox" checked={seleccionadosImportar.has(r.hotel_id)}
                    onChange={() => toggleSeleccionImportar(r.hotel_id)}
                    className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                  {r.imagen ? (
                    <img src={r.imagen} alt="" className="w-14 h-10 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex-shrink-0" />
                  )}
                  <span className="text-sm">
                    <span className="block font-medium text-gray-800 dark:text-zinc-200">{r.nombre}</span>
                    <span className="block text-xs text-gray-400 dark:text-zinc-500">{r.destino} · {r.noches ? `${r.noches} noches` : ''} {r.precio ? `· ${r.moneda} ${formatearNumero(r.precio)}` : ''}</span>
                  </span>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={agregarHospedajesImportados} disabled={seleccionadosImportar.size === 0}
                  className="text-xs font-semibold bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors">
                  Agregar seleccionados ({seleccionadosImportar.size})
                </button>
                <button onClick={() => { setResultadosImportar([]); setLinkImportar('') }}
                  className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 px-3 py-2">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {hospedajes.map((h, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Hospedaje {idx + 1}</p>
              {hospedajes.length > 1 && (
                <button onClick={() => quitarHospedaje(idx)} className="text-xs text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium">
                  ✕ Quitar
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative">
                <input value={h.nombre} onChange={e => setHospedajeCampo(idx, 'nombre', e.target.value)} placeholder="Nombre (Ej: Condominio Marulhos)"
                  autoComplete="off"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                {sugerenciasHospedaje(h.nombre).length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                    {sugerenciasHospedaje(h.nombre).map(hDB => (
                      <button key={hDB.id} type="button" onClick={() => elegirHospedajeDB(idx, hDB)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center gap-2.5">
                        {hDB.imagen ? (
                          <img src={hDB.imagen} alt="" className="w-10 h-8 object-cover rounded flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-8 rounded bg-gray-100 dark:bg-zinc-800 flex-shrink-0" />
                        )}
                        <span>
                          <span className="block font-medium text-gray-800 dark:text-zinc-200">{hDB.nombre}</span>
                          <span className="block text-xs text-gray-400 dark:text-zinc-500">{hDB.destino}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input value={h.subtitulo} onChange={e => setHospedajeCampo(idx, 'subtitulo', e.target.value)} placeholder="Subtítulo (Ej: Marulhos Resort - Frente al mar)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <div className="flex items-center gap-3">
              {h.imagen && <img src={h.imagen} alt="preview" className="w-16 h-12 object-cover rounded-lg" />}
              <label className="text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
                {subiendoIdx === idx ? 'Subiendo...' : h.imagen ? '✓ Imagen cargada — cambiar' : '+ Subir imagen'}
                <input type="file" accept="image/*" className="hidden" onChange={e => subirImagenHospedaje(idx, e.target.files[0])} />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <input type="number" value={h.noches} onChange={e => setHospedajeCampo(idx, 'noches', e.target.value)} placeholder="Noches"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input type="number" value={h.precio} onChange={e => setHospedajeCampo(idx, 'precio', e.target.value)} placeholder="Precio"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <select value={h.moneda} onChange={e => setHospedajeCampo(idx, 'moneda', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="ARS">ARS$</option>
                <option value="BRL">R$</option>
                <option value="USD">U$D</option>
              </select>
            </div>

            <input value={h.incluye} onChange={e => setHospedajeCampo(idx, 'incluye', e.target.value)} placeholder="Incluye (Ej: Aéreo + Hospedaje + Traslados)"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <input value={h.pension} onChange={e => setHospedajeCampo(idx, 'pension', e.target.value)} placeholder="Pensión (Ej: Media pensión incluida (desayuno y cena))"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <textarea value={h.descripcion} onChange={e => setHospedajeCampo(idx, 'descripcion', e.target.value)} rows={3} placeholder="Descripción"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />

            <input value={h.items_titulo} onChange={e => setHospedajeCampo(idx, 'items_titulo', e.target.value)} placeholder="Título de la lista (Ej: Servicios: / Monoambiente con:)"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <input value={h.items.join(', ')} onChange={e => setItemsHospedaje(idx, e.target.value)} placeholder="Ej: Piscina con vista al mar, Wifi gratis, Desayuno incluido"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />

            <div className="grid sm:grid-cols-2 gap-3">
              <input value={h.nota} onChange={e => setHospedajeCampo(idx, 'nota', e.target.value)} placeholder="Nota opcional (Ej: *No incluye limpieza)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input value={h.link_video} onChange={e => setHospedajeCampo(idx, 'link_video', e.target.value)} placeholder="Link de video (opcional)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Generar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 sticky bottom-4 shadow-lg">
        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}
        {exito && <p className="text-xs text-green-600 dark:text-green-400 mb-3 bg-green-50 dark:bg-green-950/40 px-3 py-2 rounded-lg">✓ Se abrió la vista de impresión — en el diálogo, elegí "Guardar como PDF" (destino), Márgenes: Ninguno, y desmarcá "Encabezados y pies de página".</p>}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{hospedajes.filter(h => h.nombre.trim()).length} hospedaje{hospedajes.filter(h => h.nombre.trim()).length !== 1 ? 's' : ''}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">Total: {formatearNumero(total)}</p>
          </div>
          <button
            onClick={generar}
            disabled={generando}
            className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {generando ? 'Abriendo...' : 'Generar propuesta (imprimir a PDF)'}
          </button>
        </div>
      </div>
    </div>
  )
}
