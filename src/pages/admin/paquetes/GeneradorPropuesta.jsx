import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { excursionesApi, clientesApi, propuestasApi, subirImagen, hospedajesApi, habitacionesApi, extraerDatosVuelo, convertirImagenABase64 } from '../../../lib/supabase.js'
import { generarPaginaAereosPDF, agregarPaginaAereos } from '../../../lib/pdfPlantillaAereos.js'
import { agregarPaginaHospedajes, SITIO_URL } from '../../../lib/pdfPlantillaHospedajes.js'

const NAVY = '#0d2438'
const CREMA = '#efe9db'
const ANCHO = 794
const ALTO = 1123
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const VUELO_VACIO = {
  origen_ciudad: '', origen_codigo: '', destino_ciudad: '', destino_codigo: '',
  ida_fecha: '', ida_sale: '', ida_llega: '', ida_escala_ciudad: '', ida_escala_codigo: '', ida_escala_llega: '', ida_escala_sale: '',
  vuelta_fecha: '', vuelta_sale: '', vuelta_llega: '', vuelta_escala_ciudad: '', vuelta_escala_codigo: '', vuelta_escala_llega: '', vuelta_escala_sale: '',
  banner_destino: '', banner_link: 'https://przvftnhwwistmcbkeon.supabase.co/storage/v1/object/public/imagenes/documentos/catalogo-paseos-privados.pdf', banner_imagen: '',
  equipaje: { mochila: 1, carryOn: 1, valija23: 0, extra: 0, extraDescripcion: '' },
  traslado_ida: true, traslado_vuelta: true, traslado_activo: true,
  // Valor neto (lo que cuesta) y de venta (lo que se le cobra al cliente) del
  // vuelo — "venta_publica" decide si ese valor de venta se le muestra al
  // cliente o queda solo de uso interno. El neto nunca se exporta al PDF.
  costo_neto: '', venta: '', venta_publica: true,
  // Mismo criterio para el traslado (aeropuerto-hotel / hotel-aeropuerto) de
  // esta propuesta simple — en combinada el equivalente vive por destino
  // (destinos[].valor_agencia_traslado / valor_cliente_traslado).
  traslado_costo_neto: '', traslado_venta: '', traslado_venta_publica: true,
}

const EQUIPAJE_OPCIONES = [
  { clave: 'mochila', label: 'Mochila de mano' },
  { clave: 'carryOn', label: 'Carry on 10 kg' },
  { clave: 'valija23', label: 'Valija 23 kg' },
  { clave: 'extra', label: 'Equipaje extra' },
]

const SERVICIOS_HOSPEDAJE = ['Desayuno', 'Media Pensión', 'Pensión Completa', 'Servicio de Limpieza']

const HOSPEDAJE_VACIO = {
  id: null, nombre: '', subtitulo: '', imagen: '', noches: '', precio: '', moneda: 'ARS',
  incluye: 'Aéreo + Hospedaje + Traslados', pension: '', descripcion: '',
  items_titulo: 'Servicios:', items: [''], nota: '', link_video: '',
  habitacion_id: null, habitacion_imagen: '', personas: '',
  // Hasta 4 tipos de habitacion del MISMO hospedaje (no hospedajes distintos),
  // cada una con su propio precio — {id, nombre, imagen, video, precio}. Al
  // cerrar la propuesta se elige el hospedaje entero, no una habitacion
  // puntual: las que esten acá quedan todas como opciones de ese hospedaje.
  habitaciones: [],
  // Costo real (no el precio al cliente) — informacion interna para nosotros,
  // nunca se exporta al PDF.
  costo_interno: '',
  // Si el precio (valor de venta) de este hospedaje se le muestra al cliente
  // o queda de uso interno — por defecto público, que es como se comportaba
  // siempre (el precio se imprime en el PDF sin excepción, ver
  // pdfPlantillaHospedajes.js).
  precio_publico: true,
}

// valor_agencia_traslado/valor_cliente_traslado: valor neto (lo que paga la
// agencia) vs. de venta (lo que se le cobraria al cliente) del traslado de ESE
// destino — para ver el margen de ese trayecto puntual (cada destino puede
// tener un traslado distinto). valor_cliente_traslado_publica decide si ese
// valor de venta se le muestra al cliente. El neto nunca se exporta al PDF.
const DESTINO_VACIO = { salida: '', destino: '', valor_agencia_traslado: '', valor_cliente_traslado: '', valor_cliente_traslado_publica: true }
const DESTINOS_PRECARGADOS = ['Recife', 'Maragogi', 'Maceió', 'Porto de Galinhas', 'Pipa', 'Tamandaré']

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function formatearNumero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}

// Los campos de monto guardan solo dígitos en el estado (compatible con
// parseFloat/Number para el total y el guardado en BD); lo que se ve en el
// input tiene los puntos de miles/millones puestos en el momento de mostrar.
function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}
function formatearMiles(valor) {
  const digitos = soloDigitos(valor)
  return digitos ? Number(digitos).toLocaleString('es-AR') : ''
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
  palmera: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V13"/><path d="M12 13c0-4-3-5-6-5 1 3 3 5 6 5Z"/><path d="M12 13c0-4 3-5 6-5-1 3-3 5-6 5Z"/><path d="M12 13c0-5-2-8-2-8"/><path d="M12 13c0-5 2-8 2-8"/></svg>`,
}

async function cargarFuente() {
  if (!document.getElementById('font-bebas-neue')) {
    const style = document.createElement('style')
    style.id = 'font-bebas-neue'
    style.textContent = `
      @font-face {
        font-family: 'Bebas Neue';
        src: url('${window.location.origin}/fonts/BebasNeue-Regular.ttf') format('truetype');
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }
    `
    document.head.appendChild(style)
  }
  // Forzamos la carga y rasterizado de la fuente antes de que html2canvas dispare
  // la captura: sin esto, a veces cae a una fuente de reemplazo (fallback) por una
  // condición de carrera con la carga de la tipografía.
  try {
    await document.fonts.load('400 34px "Bebas Neue"')
    await document.fonts.ready
  } catch (_) {}
}

async function renderPagina(html) {
  const cont = document.createElement('div')
  cont.style.position = 'fixed'
  cont.style.left = '-99999px'
  cont.style.top = '0'
  cont.style.width = `${ANCHO}px`
  cont.style.height = `${ALTO}px`
  cont.innerHTML = html
  document.body.appendChild(cont)

  // Sin esto, html2canvas saca la "foto" antes de que las imágenes remotas
  // (Supabase Storage, fotos importadas de Niara, etc.) terminen de cargar,
  // y esos huecos quedan en blanco en el PDF final.
  const imgs = Array.from(cont.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res }))))

  const canvas = await html2canvas(cont, { width: ANCHO, height: ALTO, scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  document.body.removeChild(cont)
  return canvas
}

function htmlPaginaAereos({ clienteNombre, cantidadPasajeros, vuelo }) {
  const bannerVisible = vuelo.banner_link && vuelo.banner_destino
  return `
  <div style="width:${ANCHO}px;height:${ALTO}px;background:${CREMA};font-family:${FUENTE_CUERPO};position:relative;box-sizing:border-box;">
    <div style="background:${NAVY};padding:18px 40px 15px 40px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div>
        <p style="font-family:${FUENTE_TITULOS};font-weight:400;color:#f0ece7;font-size:47px;line-height:1;letter-spacing:0;margin:0 0 10px;border-bottom:3px solid #f0ece7;padding-bottom:6px;display:inline-block;">PAQUETE DE VIAJE</p>
        <p style="font-family:${FUENTE_TITULOS};color:#f0ece7;font-size:27px;line-height:1.2;letter-spacing:1px;margin:0;text-transform:uppercase;">Nombre del cliente:</p>
        <p style="font-family:${FUENTE_TITULOS};color:#f0ece7;font-size:27px;line-height:1.2;margin:0 0 1px;text-transform:uppercase;">${escapeHtml(clienteNombre)}</p>
        <p style="font-family:${FUENTE_TITULOS};color:#f0ece7;font-size:27px;line-height:1.2;letter-spacing:1px;margin:0 0 1px;text-transform:uppercase;">Cotización personalizada para:</p>
        <p style="font-family:${FUENTE_TITULOS};color:#f0ece7;font-size:27px;line-height:1.2;margin:0;text-transform:uppercase;">${escapeHtml(cantidadPasajeros || '—')} ${Number(cantidadPasajeros) === 1 ? 'ADULTO' : 'ADULTOS'}</p>
      </div>
      <img src="${window.location.origin}/icono-sol-luna.png" style="width:120px;height:120px;object-fit:contain;flex-shrink:0;opacity:0.95;display:block;" />
    </div>

    <div style="padding:30px 40px;">
      <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:40px;line-height:1;margin:0 0 22px;display:flex;align-items:center;gap:10px;">${ICONOS.avion(32).replace(/stroke="white"/g, `stroke="${NAVY}"`)}AÉREOS:</p>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;">
        <div style="width:44px;height:44px;border-radius:50%;background:${NAVY};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${ICONOS.maleta(22)}
        </div>
        <div>
          <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:33px;line-height:1.15;margin:6px 0 6px;letter-spacing:0.5px;">EQUIPAJE INCLUIDO:</p>
          ${EQUIPAJE_OPCIONES.filter(op => vuelo.equipaje?.[op.clave]).map(op => {
            const extra = op.clave === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
            return `<p style="color:#072e40;font-size:27px;line-height:1.25;margin:0;">- ${op.label}${extra ? `: ${escapeHtml(vuelo.equipaje.extraDescripcion)}` : ''}</p>`
          }).join('')}
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:22px;">
        <div style="width:44px;height:44px;border-radius:50%;background:${NAVY};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${ICONOS.auto(22)}
        </div>
        <div>
          <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:33px;line-height:1.15;margin:6px 0 6px;letter-spacing:0.5px;">TRASLADOS PRIVADOS INCLUIDOS:</p>
          <p style="color:#072e40;font-size:27px;line-height:1.25;margin:0;">Aeropuerto / Hotel</p>
          <p style="color:#072e40;font-size:27px;line-height:1.25;margin:0;">In - Out</p>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:24px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="width:28px;height:28px;border-radius:50%;background:${NAVY};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${ICONOS.calendario(16)}</span>
            <span style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:33px;line-height:1;">IDA:</span>
            <span style="color:#072e40;font-size:33px;line-height:1;font-family:${FUENTE_TITULOS};">${fechaLarga(vuelo.ida_fecha)}</span>
          </div>
          <p style="font-size:27px;line-height:1.25;color:#072e40;margin:0;"><b>SALE</b> de ${escapeHtml(vuelo.origen_ciudad)} (${escapeHtml(vuelo.origen_codigo)}) <b>${escapeHtml(vuelo.ida_sale)} HS</b></p>
          <p style="font-size:27px;line-height:1.25;color:#072e40;margin:0;"><b>LLEGA</b> a ${escapeHtml(vuelo.destino_ciudad)} (${escapeHtml(vuelo.destino_codigo)}) <b>${escapeHtml(vuelo.ida_llega)} HS</b></p>
          <div style="display:flex;align-items:center;margin-top:14px;width:90%;"><div style="flex:1;border-top:2px solid ${NAVY};"></div><span style="color:${NAVY};font-size:16px;line-height:1;margin-left:4px;">→</span></div>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="width:28px;height:28px;border-radius:50%;background:${NAVY};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${ICONOS.calendario(16)}</span>
            <span style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:33px;line-height:1;">VUELTA:</span>
            <span style="color:#072e40;font-size:33px;line-height:1;font-family:${FUENTE_TITULOS};">${fechaLarga(vuelo.vuelta_fecha)}</span>
          </div>
          <p style="font-size:27px;line-height:1.25;color:#072e40;margin:0;"><b>SALE</b> de ${escapeHtml(vuelo.destino_ciudad)} (${escapeHtml(vuelo.destino_codigo)}) <b>${escapeHtml(vuelo.vuelta_sale)} HS</b></p>
          <p style="font-size:27px;line-height:1.25;color:#072e40;margin:0;"><b>LLEGA</b> a ${escapeHtml(vuelo.origen_ciudad)} (${escapeHtml(vuelo.origen_codigo)}) <b>${escapeHtml(vuelo.vuelta_llega)} HS</b></p>
          <div style="display:flex;align-items:center;margin-top:14px;width:90%;margin-left:auto;"><span style="color:${NAVY};font-size:16px;line-height:1;margin-right:4px;">←</span><div style="flex:1;border-top:2px solid ${NAVY};"></div></div>
        </div>
      </div>

      ${bannerVisible ? `
      <div style="background:${NAVY};border-radius:10px;padding:0;display:flex;align-items:stretch;justify-content:space-between;gap:16px;overflow:hidden;">
        <p style="font-family:${FUENTE_TITULOS};color:#fff;font-size:15px;margin:0;padding:16px 0 16px 18px;line-height:1.4;max-width:420px;align-self:center;">SI TE INTERESA VER LAS ACTIVIDADES Y PASEOS QUE OFRECEMOS EN ${escapeHtml(vuelo.banner_destino).toUpperCase()} HACE CLIC ACÁ ↗</p>
        ${vuelo.banner_imagen ? `<div style="width:190px;flex-shrink:0;"><img src="${vuelo.banner_imagen}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>` : ''}
      </div>` : ''}
    </div>

    <div style="position:absolute;bottom:0;left:0;width:100%;background:${NAVY};padding:20px 0;display:flex;align-items:center;justify-content:center;">
      <img src="${window.location.origin}/logo-blanco.png" style="height:44px;opacity:0.95;display:block;" />
    </div>
  </div>`
}

function htmlPaginaHospedajes(grupo) {
  return `
  <div style="width:${ANCHO}px;height:${ALTO}px;background:${CREMA};font-family:${FUENTE_CUERPO};position:relative;box-sizing:border-box;">
    <div style="background:${NAVY};padding:22px 48px;display:flex;align-items:center;gap:14px;">
      ${ICONOS.palmera(30)}
      <p style="font-family:${FUENTE_TITULOS};color:#f0ece7;font-size:40px;line-height:1;margin:0;letter-spacing:1px;">HOSPEDAJES</p>
    </div>
    <div style="padding:22px 48px;">
      ${grupo.map((h, idx) => `
        <div style="${idx > 0 ? `border-top:1.5px solid #0d243880;margin-top:16px;padding-top:16px;` : ''}">
          <div style="display:flex;justify-content:space-between;gap:22px;margin-bottom:10px;">
            <div style="flex:1;">
              <p style="font-family:${FUENTE_TITULOS};color:${NAVY};font-size:29px;line-height:1.05;margin:0 0 2px;">${escapeHtml(h.nombre).toUpperCase()}</p>
              <p style="font-family:${FUENTE_CUERPO};color:${NAVY};font-size:15px;letter-spacing:0.5px;margin:0;text-transform:uppercase;">${escapeHtml(h.subtitulo)}</p>
            </div>
            <div style="flex:1;font-family:${FUENTE_TITULOS};">
              <p style="color:${NAVY};font-size:15px;letter-spacing:0.5px;margin:0 0 2px;">${escapeHtml(h.noches)} NOCHES:</p>
              <p style="color:${NAVY};font-size:15px;letter-spacing:0.5px;margin:0 0 2px;">${escapeHtml(h.moneda)}$ ${formatearNumero(h.precio)}</p>
              <p style="color:${NAVY};font-size:15px;letter-spacing:0.5px;margin:0 0 2px;">${escapeHtml(h.incluye)}</p>
              <p style="color:${NAVY};font-size:15px;letter-spacing:0.5px;margin:0;">${escapeHtml(h.pension)}</p>
            </div>
          </div>
          <div style="display:flex;gap:22px;flex-direction:${idx % 2 === 0 ? 'row' : 'row-reverse'};">
            <div style="flex:1;">
              ${h.imagen ? `
                <div style="position:relative;border-radius:10px;overflow:hidden;">
                  <img src="${h.imagen}" style="width:100%;height:150px;object-fit:cover;display:block;" />
                  ${h.link_video ? `<div style="position:absolute;bottom:0;left:0;width:100%;background:${NAVY};padding:6px 10px;box-sizing:border-box;"><p style="font-family:${FUENTE_CUERPO};color:#c9e34f;font-size:13px;font-weight:700;margin:0;letter-spacing:0.3px;">CLIC ACÁ PARA VER VIDEOS ↗</p></div>` : ''}
                </div>
              ` : (h.link_video ? `<p style="font-family:${FUENTE_CUERPO};color:#0a8a5f;font-size:13px;font-weight:700;margin:0;">CLIC ACÁ PARA VER VIDEOS ↗</p>` : '')}
            </div>
            <div style="flex:1;font-family:${FUENTE_CUERPO};">
              ${h.descripcion ? `<p style="color:${NAVY};font-size:13px;font-weight:400;line-height:1.5;margin:0 0 8px;">${escapeHtml(h.descripcion)}</p>` : ''}
              ${h.items.filter(Boolean).length ? `
                <p style="color:${NAVY};font-size:13px;font-weight:700;margin:0 0 3px;">${escapeHtml(h.items_titulo)}</p>
                ${h.items.filter(Boolean).map(it => `<p style="color:${NAVY};font-size:13px;font-weight:400;margin:0 0 2px;">- ${escapeHtml(it)}</p>`).join('')}
              ` : ''}
              ${h.nota ? `<p style="color:#666;font-size:12px;font-style:italic;margin:6px 0 0;">${escapeHtml(h.nota)}</p>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="position:absolute;bottom:0;left:0;width:100%;background:${NAVY};padding:20px 0;display:flex;align-items:center;justify-content:center;">
      <img src="${window.location.origin}/logo-blanco.png" style="height:44px;opacity:0.95;display:block;" />
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
  const [cantidadAdultos, setCantidadAdultos] = useState('')
  const [cantidadMenores, setCantidadMenores] = useState('')
  const [edadesMenores, setEdadesMenores] = useState([])
  const [presupuestoLimite, setPresupuestoLimite] = useState('')
  // Propuesta simple: un solo destino, todo sigue como siempre. Combinada: se
  // suma la seccion Destinos, para viajes que combinan mas de una ciudad.
  const [tipoPropuesta, setTipoPropuesta] = useState('simple')
  const [destinos, setDestinos] = useState([{ ...DESTINO_VACIO }])
  // Se puede agregar mas de un vuelo en cualquiera de los dos tipos de
  // propuesta: en simple son opciones alternativas (igual que con hospedaje),
  // en combinada son tramos distintos del viaje. Lo que distingue a
  // "combinada" es que visita mas de un destino, no la cantidad de opciones.
  const [vuelos, setVuelos] = useState([{ ...VUELO_VACIO }])
  // "Cargar desde imagen" es una operacion a la vez — leyendoVueloIdx dice
  // cual tarjeta esta leyendo, para mostrarle el estado solo a esa.
  const [leyendoVueloIdx, setLeyendoVueloIdx] = useState(null)
  const [leyendoVuelo, setLeyendoVuelo] = useState(false)
  const [reintentandoVuelo, setReintentandoVuelo] = useState(false)
  const [errorVuelo, setErrorVuelo] = useState('')
  const [hospedajes, setHospedajes] = useState([{ ...HOSPEDAJE_VACIO, items: [''] }])
  const [hospedajesDB, setHospedajesDB] = useState([])
  // Filtro de localizacion por tarjeta de hospedaje (combinada) — clave el
  // indice de la tarjeta, valor el destino elegido ('' = todos).
  const [filtroDestinoPorIdx, setFiltroDestinoPorIdx] = useState({})
  // Tipos de habitacion disponibles por hospedaje del catalogo (se cargan solos
  // al elegirlo) — clave el id del hospedaje, no la posicion en la lista: al
  // elegir varias habitaciones del mismo hotel se clonan tarjetas y las
  // posiciones se corren, un mapa por indice quedaria desalineado.
  const [habitacionesPorHospedaje, setHabitacionesPorHospedaje] = useState({})
  const [subiendoIdx, setSubiendoIdx] = useState(null)
  const [subiendoBanner, setSubiendoBanner] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

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
  // autocompletar nombre/foto/descripcion/amenities al armar la propuesta. En
  // combinada, cada tarjeta puede filtrar por localizacion (Maragogi, Porto de
  // Galinhas, Pipa, etc.) — util cuando el combinado visita varios destinos y
  // hay que buscar el hospedaje de CADA uno sin que se mezclen los resultados.
  function sugerenciasHospedaje(idx, texto) {
    if (!texto || texto.trim().length < 2) return []
    const lower = texto.trim().toLowerCase()
    const destinoFiltro = filtroDestinoPorIdx[idx]
    return hospedajesDB
      .filter(h => h.nombre.toLowerCase().includes(lower) && h.nombre.toLowerCase() !== lower)
      .filter(h => !destinoFiltro || h.destino === destinoFiltro)
      .slice(0, 5)
  }

  function elegirHospedajeDB(idx, hDB) {
    setHospedajes(prev => prev.map((h, i) => i === idx ? {
      ...h,
      id: hDB.id,
      nombre: hDB.nombre,
      subtitulo: [hDB.tipo, hDB.destino].filter(Boolean).join(' · '),
      imagen: hDB.imagen || h.imagen,
      descripcion: hDB.descripcion || h.descripcion,
      items_titulo: (hDB.amenities || []).length ? 'Servicios:' : h.items_titulo,
      items: (hDB.amenities || []).length ? hDB.amenities : h.items,
      habitacion_id: null, habitacion_nombre: '', habitacion_imagen: '', habitaciones: [],
    } : h))
    if (!habitacionesPorHospedaje[hDB.id]) {
      habitacionesApi.getByHospedaje(hDB.id).then(({ data }) => {
        setHabitacionesPorHospedaje(prev => ({ ...prev, [hDB.id]: data || [] }))
      })
    }
  }

  // El admin elige hasta 4 tipos de habitacion del MISMO hospedaje (foto,
  // servicios, m², camas — ya cargados en el sitio; cada una con su propio
  // precio, cargado a mano) — quedan todas juntas en esa misma tarjeta, no
  // como si fueran hospedajes distintos. Al cerrar la propuesta se elige el
  // hospedaje entero (como ya funcionaba), con las habitaciones que tenga
  // adentro; no hace falta puntualizar una sola.
  const MAX_HABITACIONES = 4
  function alternarHabitacion(idx, hab) {
    setHospedajes(prev => prev.map((h, i) => {
      if (i !== idx) return h
      const yaElegida = h.habitaciones.some(hb => hb.id === hab.id)
      let habitaciones
      if (yaElegida) {
        habitaciones = h.habitaciones.filter(hb => hb.id !== hab.id)
      } else {
        if (h.habitaciones.length >= MAX_HABITACIONES) return h
        habitaciones = [...h.habitaciones, {
          id: hab.id, nombre: hab.nombre, imagen: hab.imagen || '', video: hab.video || '',
          descripcion: hab.descripcion || '', amenities: hab.amenities || [], precio: '',
        }]
      }
      const primera = habitaciones[0]
      // Descripcion/servicios generales de la tarjeta se completan solos con
      // la PRIMERA habitacion elegida (igual que antes, para el caso comun de
      // una sola) — al agregar la 2da a la 4ta no se pisan, no hay una unica
      // habitacion "dueña" de esos campos compartidos.
      const esPrimeraElegida = !yaElegida && h.habitaciones.length === 0
      return {
        ...h,
        habitaciones,
        // Los campos sueltos (compatibilidad con el PDF, que hoy solo muestra
        // una habitacion junto a la foto del hospedaje) siguen la primera de
        // la lista — si se saca esa, pasa a la que haya quedado primera.
        habitacion_id: primera?.id ?? null,
        habitacion_nombre: primera?.nombre ?? '',
        habitacion_imagen: primera?.imagen ?? '',
        descripcion: esPrimeraElegida ? (hab.descripcion || h.descripcion) : h.descripcion,
        items_titulo: esPrimeraElegida && (hab.amenities || []).length ? 'Servicios:' : h.items_titulo,
        items: esPrimeraElegida && (hab.amenities || []).length ? hab.amenities : h.items,
        link_video: primera?.video ? `${SITIO_URL}/hoteles/${h.id}?habitacion=${primera.id}&standalone=1` : h.link_video,
      }
    }))
  }

  function setPrecioHabitacion(idx, habId, precio) {
    setHospedajes(prev => prev.map((h, i) => i === idx ? {
      ...h,
      habitaciones: h.habitaciones.map(hb => hb.id === habId ? { ...hb, precio } : hb),
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

  function setVueloCampo(idx, campo, valor) {
    setVuelos(prev => prev.map((v, i) => i === idx ? { ...v, [campo]: valor } : v))
  }
  function alternarTrasladoVuelo(idx) {
    setVuelos(prev => prev.map((v, i) => {
      if (i !== idx) return v
      const activar = v.traslado_activo === false
      return { ...v, traslado_activo: activar, traslado_ida: activar, traslado_vuelta: activar }
    }))
  }
  function cambiarCantidadEquipaje(idx, clave, delta) {
    setVuelos(prev => prev.map((v, i) => i === idx ? { ...v, equipaje: { ...v.equipaje, [clave]: Math.max(0, (v.equipaje?.[clave] || 0) + delta) } } : v))
  }

  function agregarVuelo() {
    setVuelos(prev => [...prev, { ...VUELO_VACIO }])
  }
  function quitarVuelo(idx) {
    setVuelos(prev => prev.filter((_, i) => i !== idx))
  }

  function setEdadMenor(idx, valor) {
    setEdadesMenores(prev => {
      const next = [...prev]
      next[idx] = valor
      return next
    })
  }

  async function subirImagenBanner(idx, archivo) {
    if (!archivo) return
    setSubiendoBanner(true)
    const { url } = await subirImagen(archivo)
    if (url) setVueloCampo(idx, 'banner_imagen', url)
    setSubiendoBanner(false)
  }

  // Las capturas de itinerario (sobre todo de celular) llegan a varios MB y
  // resolución muy alta sin necesidad — es solo texto. Redimensionar acá antes
  // de mandarla acelera tanto la subida como la lectura de Gemini, que escala
  // con el tamaño/resolución de la imagen.
  function archivoAImagenComprimida(archivo, maxDim = 1280, calidad = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(archivo)
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const escala = maxDim / Math.max(width, height)
          width = Math.round(width * escala)
          height = Math.round(height * escala)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('No se pudo comprimir la imagen.'))
          const reader = new FileReader()
          reader.onload = () => resolve({ base64: reader.result.split(',')[1], mediaType: 'image/jpeg' })
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }, 'image/jpeg', calidad)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')) }
      img.src = url
    })
  }

  // El lector usa la capa gratuita de Gemini, que a veces devuelve un 429
  // (rate limit) o un 5xx pasajero (mucha demanda) — la Edge Function falla
  // rápido en ese caso (no reintenta internamente, se probó y terminaba
  // muriendo por falta de recursos). Reintentamos ACA, llamando de nuevo con
  // una invocación fresca cada vez, antes de rendirnos — la agencia no
  // debería tener que reintentar a mano para algo que se resuelve solo en
  // unos segundos.
  async function leerImagenVuelo(idx, archivo) {
    if (!archivo) return
    setErrorVuelo('')
    setReintentandoVuelo(false)
    setLeyendoVuelo(true)
    setLeyendoVueloIdx(idx)
    try {
      const { base64, mediaType } = await archivoAImagenComprimida(archivo)
      let data, error
      for (let intento = 0; intento < 8; intento++) {
        if (intento > 0) {
          setReintentandoVuelo(true)
          await new Promise(r => setTimeout(r, 10000))
        }
        ;({ data, error } = await extraerDatosVuelo(base64, mediaType))
        if (!data?.rateLimited) break
      }
      if (error || data?.error) {
        setErrorVuelo(data?.error || error?.message || 'No se pudo leer la imagen.')
      } else if (data?.vuelo) {
        setVuelos(prev => prev.map((v, i) => {
          if (i !== idx) return v
          const next = { ...v }
          for (const campo of Object.keys(data.vuelo)) {
            if (data.vuelo[campo]) next[campo] = data.vuelo[campo]
          }
          return next
        }))
      }
    } catch (_) {
      setErrorVuelo('No se pudo leer la imagen.')
    }
    setReintentandoVuelo(false)
    setLeyendoVuelo(false)
    setLeyendoVueloIdx(null)
  }

  function agregarHospedaje() {
    const totalPersonas = (parseInt(cantidadAdultos) || 0) + (parseInt(cantidadMenores) || 0)
    setHospedajes(prev => [...prev, { ...HOSPEDAJE_VACIO, items: [''], personas: totalPersonas ? String(totalPersonas) : '' }])
  }

  // "Cantidad de personas" de cada hospedaje se llena sola con el total de
  // Cliente (adultos + menores) — no se carga a mano, para no tener que
  // repetir el mismo numero en cada hospedaje y que se desincronice.
  useEffect(() => {
    const total = (parseInt(cantidadAdultos) || 0) + (parseInt(cantidadMenores) || 0)
    if (!total) return
    setHospedajes(prev => prev.map(h => ({ ...h, personas: String(total) })))
  }, [cantidadAdultos, cantidadMenores])

  function quitarHospedaje(idx) {
    setHospedajes(prev => prev.filter((_, i) => i !== idx))
    // El filtro de localizacion esta indexado por posicion de tarjeta — al
    // sacar una, hay que correr las claves de las que quedan despues.
    setFiltroDestinoPorIdx(prev => {
      const siguiente = {}
      Object.entries(prev).forEach(([key, val]) => {
        const i = Number(key)
        if (i < idx) siguiente[i] = val
        else if (i > idx) siguiente[i - 1] = val
      })
      return siguiente
    })
  }

  function agregarDestino() {
    setDestinos(prev => [...prev, { ...DESTINO_VACIO }])
  }

  function quitarDestino(idx) {
    setDestinos(prev => prev.filter((_, i) => i !== idx))
  }

  function setDestinoCampo(idx, campo, valor) {
    setDestinos(prev => prev.map((d, i) => i === idx ? { ...d, [campo]: valor } : d))
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

  // Cajitas clickeables para los servicios mas comunes — tildar/destildar suma o
  // saca ese texto de la misma lista de items que usa el campo libre de arriba.
  function alternarServicioHospedaje(idx, servicio) {
    setHospedajes(prev => prev.map((h, i) => {
      if (i !== idx) return h
      const actuales = h.items.filter(Boolean)
      const items = actuales.includes(servicio) ? actuales.filter(it => it !== servicio) : [...actuales, servicio]
      // "Pensión" ya no es un campo de texto libre aparte — sale sola de estas
      // mismas cajitas (Pensión Completa gana si están las dos tildadas).
      const pension = items.includes('Pensión Completa') ? 'Pensión Completa' : (items.includes('Media Pensión') ? 'Media Pensión' : '')
      return { ...h, items: items.length ? items : [''], pension }
    }))
  }

  // En propuesta simple los hospedajes cargados son OPCIONES alternativas para
  // una misma estadía (el cliente elige una al cerrar) — sumarlas daría un total
  // inflado. En combinada cada hospedaje es una etapa distinta del viaje, así
  // que sí se suman entre sí.
  const total = tipoPropuesta === 'combinada'
    ? hospedajes.reduce((sum, h) => sum + (parseFloat(h.precio) || 0), 0)
    : (parseFloat(hospedajes[0]?.precio) || 0)

  // html2canvas no puede leer los píxeles de imágenes de otros dominios sin
  // CORS habilitado (ej: fotos importadas de Niara) aunque carguen bien en
  // pantalla — por eso se pasan por el proxy server-side antes de renderizar,
  // que las devuelve como data URI (sin restricción de dominio para el canvas).
  async function imagenParaPdf(url) {
    if (!url || url.startsWith('data:')) return url
    try {
      const { data, error } = await convertirImagenABase64(url)
      if (error || data?.error || !data?.dataUri) return url
      return data.dataUri
    } catch (_) {
      return url
    }
  }

  async function generar() {
    if (!busqCliente.trim()) return setError('Ingresá el nombre del cliente.')
    if (!hospedajes.some(h => h.nombre.trim())) return setError('Cargá al menos un hospedaje con nombre.')
    setError('')
    setGenerando(true)
    setExito(false)
    try {
      await cargarFuente()
      const cliente = { nombre: busqCliente.trim(), whatsapp: clienteWhatsapp.trim() }

      // El primer vuelo se genera siempre (igual que antes, aunque haya quedado
      // vacío); los que se hayan agregado despues (opciones de vuelo en simple,
      // tramos distintos en combinada) solo entran si se les cargó al menos
      // origen o destino — evita paginas en blanco por una tarjeta que se
      // agregó y no se llegó a completar.
      const vuelosConDatos = vuelos.filter((v, i) => i === 0 || v.origen_ciudad?.trim() || v.destino_ciudad?.trim())
      const vuelosParaPdf = await Promise.all(
        vuelosConDatos.map(async v => ({ ...v, banner_imagen: await imagenParaPdf(v.banner_imagen) }))
      )
      // Un campo de edad por menor (en vez de una lista en texto libre) -- se unen
      // en un solo string para el PDF y el guardado, igual que antes.
      const edadesMenoresTexto = edadesMenores.slice(0, parseInt(cantidadMenores) || 0).filter(Boolean).join(', ')

      // Pagina(s) de Aereos: se generan sobre el PDF de referencia real (texto
      // vectorial, no una captura de pantalla) — la primera arma el documento
      // entero (como siempre), el resto se agrega al final, una pagina por
      // vuelo, mismo patron que las paginas de Hospedajes.
      const doc = await generarPaginaAereosPDF({ clienteNombre: cliente.nombre, cantidadAdultos, cantidadMenores, edadesMenores: edadesMenoresTexto, vuelo: vuelosParaPdf[0] })
      if (vuelosParaPdf.length > 1) {
        const plantillaAereosBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
        const plantillaAereosDoc = await PDFDocument.load(plantillaAereosBytes)
        const bebasAereosBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
        const bebasAereos = await doc.embedFont(bebasAereosBytes)
        for (let i = 1; i < vuelosParaPdf.length; i++) {
          await agregarPaginaAereos(doc, plantillaAereosDoc, bebasAereos, { clienteNombre: cliente.nombre, cantidadAdultos, cantidadMenores, edadesMenores: edadesMenoresTexto, vuelo: vuelosParaPdf[i] })
        }
      }

      const hospedajesValidos = hospedajes.filter(h => h.nombre.trim())
      const hospedajesParaPdf = await Promise.all(
        hospedajesValidos.map(async h => ({ ...h, imagen: await imagenParaPdf(h.imagen) }))
      )

      // Pagina de Hospedajes: misma tecnica que Aereos — plantilla real (2 hospedajes
      // por hoja, igual que el diseño original) con los datos tapados y reescritos.
      if (hospedajesParaPdf.length) {
        const plantillaHospBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
        const plantillaHospDoc = await PDFDocument.load(plantillaHospBytes)
        const bebasBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
        const bebasHosp = await doc.embedFont(bebasBytes)
        const helvHosp = await doc.embedFont(StandardFonts.Helvetica)
        for (let i = 0; i < hospedajesParaPdf.length; i += 4) {
          const grupo = hospedajesParaPdf.slice(i, i + 4)
          await agregarPaginaHospedajes(doc, plantillaHospDoc, bebasHosp, helvHosp, grupo)
        }
      }

      const pdfBytes = await doc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `Propuesta_${cliente.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(enlace)
      enlace.click()
      document.body.removeChild(enlace)
      URL.revokeObjectURL(url)

      await propuestasApi.create({
        cliente_id: clienteSel?.id || null,
        cliente_nombre: cliente.nombre,
        cliente_whatsapp: cliente.whatsapp || null,
        cantidad_pasajeros: (parseInt(cantidadAdultos) || 0) + (parseInt(cantidadMenores) || 0) || null,
        cantidad_adultos: parseInt(cantidadAdultos) || null,
        cantidad_menores: parseInt(cantidadMenores) || null,
        edades_menores: edadesMenoresTexto || null,
        presupuesto_limite: parseFloat(presupuestoLimite) || null,
        sena: 0,
        tipo_propuesta: tipoPropuesta,
        destinos_detalle: tipoPropuesta === 'combinada' ? destinos.filter(d => d.salida.trim() || d.destino.trim()) : null,
        // "vuelo" queda como el primero, para todo lo que ya lee ese campo
        // (modal de cierre, PDF de cierre) sin cambios. "vuelos" es el array
        // completo — en combinada puede haber mas de uno.
        vuelo: vuelosConDatos[0] || VUELO_VACIO,
        vuelos: vuelosConDatos,
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
      setCantidadAdultos('')
      setCantidadMenores('')
      setEdadesMenores([])
      setPresupuestoLimite('')
      setTipoPropuesta('simple')
      setDestinos([{ ...DESTINO_VACIO }])
      setVuelos([{ ...VUELO_VACIO }])
      setHospedajes([{ ...HOSPEDAJE_VACIO, items: [''] }])
    } catch (e) {
      setError('Error al generar la propuesta: ' + (e.message || 'intentá de nuevo'))
    }
    setGenerando(false)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  const destinosDisponibles = [...new Set(hospedajesDB.map(h => h.destino).filter(Boolean))].sort()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Generador de propuesta</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Cargá el vuelo y los hospedajes, y generá el PDF "Paquete de viaje" para enviar al cliente</p>
      </div>

      {/* Cliente */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Cliente</h3>
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
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="number"
            min="0"
            value={cantidadAdultos}
            onChange={e => setCantidadAdultos(e.target.value)}
            placeholder="Cantidad de adultos"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            type="number"
            min="0"
            value={cantidadMenores}
            onChange={e => setCantidadMenores(e.target.value)}
            placeholder="Cantidad de menores"
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        {parseInt(cantidadMenores) > 0 && (
          <div className="grid sm:grid-cols-4 gap-3">
            {Array.from({ length: parseInt(cantidadMenores) }).map((_, i) => (
              <input
                key={i}
                type="number"
                min="0"
                value={edadesMenores[i] || ''}
                onChange={e => setEdadMenor(i, e.target.value)}
                placeholder={`Edad menor ${i + 1}`}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            ))}
          </div>
        )}
        <input
          type="text"
          inputMode="numeric"
          value={formatearMiles(presupuestoLimite)}
          onChange={e => setPresupuestoLimite(soloDigitos(e.target.value))}
          placeholder="Presupuesto límite (R$)"
          className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Tipo de propuesta */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Tipo de propuesta</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTipoPropuesta('simple')}
            className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
              tipoPropuesta === 'simple'
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
            }`}>
            Propuesta simple
          </button>
          <button type="button" onClick={() => setTipoPropuesta('combinada')}
            className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
              tipoPropuesta === 'combinada'
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
            }`}>
            Propuesta combinada
          </button>
        </div>

        {tipoPropuesta === 'combinada' && (
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between pt-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Transfers</p>
              <button onClick={agregarDestino} type="button" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
                + Agregar transfer
              </button>
            </div>
            <datalist id="destinos-precargados">
              {DESTINOS_PRECARGADOS.map(d => <option key={d} value={d} />)}
            </datalist>
            {destinos.map((d, idx) => (
              <div key={idx} className="border border-gray-100 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Transfer {idx + 1}</p>
                  {destinos.length > 1 && (
                    <button onClick={() => quitarDestino(idx)} type="button" className="text-xs text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium">
                      ✕ Quitar
                    </button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={d.salida} onChange={e => setDestinoCampo(idx, 'salida', e.target.value)} placeholder="Salida (Ej: Recife)" list="destinos-precargados"
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  <input value={d.destino} onChange={e => setDestinoCampo(idx, 'destino', e.target.value)} placeholder="Destino (Ej: Maragogi)" list="destinos-precargados"
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1">Valor neto (costo) y de venta de este transfer — el neto es uso interno, nunca se exporta al PDF</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <input type="text" inputMode="numeric" value={formatearMiles(d.valor_agencia_traslado)} onChange={e => setDestinoCampo(idx, 'valor_agencia_traslado', soloDigitos(e.target.value))} placeholder="Valor neto"
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <input type="text" inputMode="numeric" value={formatearMiles(d.valor_cliente_traslado)} onChange={e => setDestinoCampo(idx, 'valor_cliente_traslado', soloDigitos(e.target.value))} placeholder="Valor de venta"
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 cursor-pointer">
                      <input type="checkbox" checked={!!d.valor_cliente_traslado_publica} onChange={() => setDestinoCampo(idx, 'valor_cliente_traslado_publica', !d.valor_cliente_traslado_publica)}
                        className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                      {d.valor_cliente_traslado_publica ? 'Pública' : 'Privada'}
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vuelo */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Vuelo</h3>
          <button onClick={agregarVuelo} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
            + Agregar vuelo
          </button>
        </div>
        {errorVuelo && <p className="text-xs text-red-500 dark:text-red-400">{errorVuelo}</p>}
        {vuelos.map((v, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Vuelo {idx + 1}</p>
              <div className="flex items-center gap-3">
                <label className="text-xs text-brand-600 dark:text-brand-400 cursor-pointer whitespace-nowrap">
                  {leyendoVuelo && leyendoVueloIdx === idx ? (reintentandoVuelo ? 'Reintentando...' : 'Leyendo imagen...') : '+ Cargar desde imagen'}
                  <input type="file" accept="image/*" className="hidden" disabled={leyendoVuelo}
                    onChange={e => leerImagenVuelo(idx, e.target.files[0])} />
                </label>
                {vuelos.length > 1 && (
                  <button onClick={() => quitarVuelo(idx)} type="button" className="text-xs text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium">
                    ✕ Quitar
                  </button>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={v.origen_ciudad} onChange={e => setVueloCampo(idx, 'origen_ciudad', e.target.value)} placeholder="Ciudad de origen (Ej: Ezeiza)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input value={v.origen_codigo} onChange={e => setVueloCampo(idx, 'origen_codigo', e.target.value.toUpperCase())} placeholder="Código origen (Ej: EZE)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input value={v.destino_ciudad} onChange={e => setVueloCampo(idx, 'destino_ciudad', e.target.value)} placeholder="Ciudad de destino (Ej: Recife)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input value={v.destino_codigo} onChange={e => setVueloCampo(idx, 'destino_codigo', e.target.value.toUpperCase())} placeholder="Código destino (Ej: REC)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Fecha ida</label>
                <input type="date" value={v.ida_fecha} onChange={e => setVueloCampo(idx, 'ida_fecha', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Sale (ida)</label>
                <input type="time" value={v.ida_sale} onChange={e => setVueloCampo(idx, 'ida_sale', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Llega (ida)</label>
                <input type="time" value={v.ida_llega} onChange={e => setVueloCampo(idx, 'ida_llega', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Escala (ida) — opcional, dejalo vacío si es directo</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={v.ida_escala_ciudad} onChange={e => setVueloCampo(idx, 'ida_escala_ciudad', e.target.value)} placeholder="Ciudad de escala (Ej: San Pablo)"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input value={v.ida_escala_codigo} onChange={e => setVueloCampo(idx, 'ida_escala_codigo', e.target.value.toUpperCase())} placeholder="Código de escala (Ej: GRU)"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Llega a la escala</label>
                  <input type="time" value={v.ida_escala_llega} onChange={e => setVueloCampo(idx, 'ida_escala_llega', e.target.value)}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Sale de la escala</label>
                  <input type="time" value={v.ida_escala_sale} onChange={e => setVueloCampo(idx, 'ida_escala_sale', e.target.value)}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Fecha vuelta</label>
                <input type="date" value={v.vuelta_fecha} onChange={e => setVueloCampo(idx, 'vuelta_fecha', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Sale (vuelta)</label>
                <input type="time" value={v.vuelta_sale} onChange={e => setVueloCampo(idx, 'vuelta_sale', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Llega (vuelta)</label>
                <input type="time" value={v.vuelta_llega} onChange={e => setVueloCampo(idx, 'vuelta_llega', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Escala (vuelta) — opcional, dejalo vacío si es directo</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={v.vuelta_escala_ciudad} onChange={e => setVueloCampo(idx, 'vuelta_escala_ciudad', e.target.value)} placeholder="Ciudad de escala (Ej: San Pablo)"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input value={v.vuelta_escala_codigo} onChange={e => setVueloCampo(idx, 'vuelta_escala_codigo', e.target.value.toUpperCase())} placeholder="Código de escala (Ej: GRU)"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Llega a la escala</label>
                  <input type="time" value={v.vuelta_escala_llega} onChange={e => setVueloCampo(idx, 'vuelta_escala_llega', e.target.value)}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 dark:text-zinc-500 block mb-1">Sale de la escala</label>
                  <input type="time" value={v.vuelta_escala_sale} onChange={e => setVueloCampo(idx, 'vuelta_escala_sale', e.target.value)}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Equipaje incluido</p>
              <div className="flex flex-wrap gap-3">
                {EQUIPAJE_OPCIONES.map(op => (
                  <div key={op.clave} className="flex items-center gap-2 border border-gray-200 dark:border-zinc-700 rounded-xl pl-3 pr-1.5 py-1.5">
                    <span className="text-sm text-gray-700 dark:text-zinc-300">{op.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100 w-4 text-center tabular-nums">{v.equipaje?.[op.clave] || 0}</span>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => cambiarCantidadEquipaje(idx, op.clave, 1)}
                        className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 leading-none p-0.5">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" onClick={() => cambiarCantidadEquipaje(idx, op.clave, -1)}
                        className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 leading-none p-0.5">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {(v.equipaje?.extra || 0) > 0 && (
                <input value={v.equipaje?.extraDescripcion || ''} onChange={e => setVuelos(prev => prev.map((vv, i) => i === idx ? { ...vv, equipaje: { ...vv.equipaje, extraDescripcion: e.target.value } } : vv))}
                  placeholder="Descripción del equipaje extra (Ej: 1 tabla de surf)"
                  className="mt-2 w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              )}
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1">Valor neto (costo) y de venta del vuelo — el neto es uso interno, nunca se exporta al PDF</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <input type="text" inputMode="numeric" value={formatearMiles(v.costo_neto)} onChange={e => setVueloCampo(idx, 'costo_neto', soloDigitos(e.target.value))} placeholder="Valor neto"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input type="text" inputMode="numeric" value={formatearMiles(v.venta)} onChange={e => setVueloCampo(idx, 'venta', soloDigitos(e.target.value))} placeholder="Valor de venta"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={!!v.venta_publica} onChange={() => setVueloCampo(idx, 'venta_publica', !v.venta_publica)}
                    className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                  {v.venta_publica ? 'Pública' : 'Privada'}
                </label>
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400 dark:text-zinc-500">Traslados privados</p>
                <button type="button" onClick={() => alternarTrasladoVuelo(idx)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${v.traslado_activo === false ? 'bg-gray-300 dark:bg-zinc-600' : 'bg-brand-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${v.traslado_activo === false ? 'translate-x-0.5' : 'translate-x-4'}`} />
                </button>
              </div>
              <div className={`transition-opacity ${v.traslado_activo === false ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={!!v.traslado_ida} disabled={v.traslado_activo === false} onChange={() => setVueloCampo(idx, 'traslado_ida', !v.traslado_ida)}
                      className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                    Traslado ida (aeropuerto → hotel)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={!!v.traslado_vuelta} disabled={v.traslado_activo === false} onChange={() => setVueloCampo(idx, 'traslado_vuelta', !v.traslado_vuelta)}
                      className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                    Traslado vuelta (hotel → aeropuerto)
                  </label>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1">Valor neto (costo) y de venta del traslado — el neto es uso interno, nunca se exporta al PDF</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <input type="text" inputMode="numeric" value={formatearMiles(v.traslado_costo_neto)} disabled={v.traslado_activo === false} onChange={e => setVueloCampo(idx, 'traslado_costo_neto', soloDigitos(e.target.value))} placeholder="Valor neto"
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-gray-100 dark:disabled:bg-zinc-900" />
                    <input type="text" inputMode="numeric" value={formatearMiles(v.traslado_venta)} disabled={v.traslado_activo === false} onChange={e => setVueloCampo(idx, 'traslado_venta', soloDigitos(e.target.value))} placeholder="Valor de venta"
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-gray-100 dark:disabled:bg-zinc-900" />
                    <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 cursor-pointer">
                      <input type="checkbox" checked={!!v.traslado_venta_publica} disabled={v.traslado_activo === false} onChange={() => setVueloCampo(idx, 'traslado_venta_publica', !v.traslado_venta_publica)}
                        className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                      {v.traslado_venta_publica ? 'Pública' : 'Privada'}
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Banner "ver actividades" (opcional — si lo dejás vacío, no aparece en el PDF)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={v.banner_destino} onChange={e => setVueloCampo(idx, 'banner_destino', e.target.value)} placeholder="Destino a mostrar (Ej: Porto)"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input value={v.banner_link} onChange={e => setVueloCampo(idx, 'banner_link', e.target.value)} placeholder="Link de actividades"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <label className="mt-2 inline-block text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
                {subiendoBanner ? 'Subiendo...' : v.banner_imagen ? '✓ Imagen del banner cargada — cambiar' : '+ Imagen del banner'}
                <input type="file" accept="image/*" className="hidden" onChange={e => subirImagenBanner(idx, e.target.files[0])} />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Hospedajes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Hospedajes</h3>
          <button onClick={agregarHospedaje} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
            + Agregar hospedaje
          </button>
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

            {tipoPropuesta === 'combinada' && (
              <div>
                <label className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 block">Filtrar búsqueda por localización</label>
                <select value={filtroDestinoPorIdx[idx] || ''} onChange={e => setFiltroDestinoPorIdx(prev => ({ ...prev, [idx]: e.target.value }))}
                  className="w-full sm:w-64 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">Todas las localizaciones</option>
                  {destinosDisponibles.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative">
                <input value={h.nombre} onChange={e => setHospedajeCampo(idx, 'nombre', e.target.value)} placeholder="Nombre (Ej: Condominio Marulhos)"
                  autoComplete="off"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                {sugerenciasHospedaje(idx, h.nombre).length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                    {sugerenciasHospedaje(idx, h.nombre).map(hDB => (
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

            {(habitacionesPorHospedaje[h.id] || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                  Tipo de habitación (foto y servicios ya cargados en el sitio) — hasta {MAX_HABITACIONES} opciones de este hospedaje, cada una con su precio
                  {' '}({h.habitaciones.length}/{MAX_HABITACIONES})
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {habitacionesPorHospedaje[h.id].map(hab => {
                    const elegida = h.habitaciones.find(hb => hb.id === hab.id)
                    const deshabilitada = !elegida && h.habitaciones.length >= MAX_HABITACIONES
                    return (
                      <div key={hab.id}
                        className={`flex flex-col gap-2 border rounded-xl p-2.5 transition-colors ${
                          elegida
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                            : deshabilitada
                              ? 'border-gray-100 dark:border-zinc-800 opacity-40'
                              : 'border-gray-200 dark:border-zinc-700 hover:border-brand-300'
                        }`}>
                        <button type="button" disabled={deshabilitada} onClick={() => alternarHabitacion(idx, hab)}
                          className="flex gap-2.5 text-left w-full disabled:cursor-not-allowed">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
                            {hab.imagen ? (
                              <img src={hab.imagen} alt="" className="w-full h-full object-cover" />
                            ) : hab.video ? (
                              <video src={`${hab.video}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{hab.nombre}</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500">
                              {[hab.superficie ? `${hab.superficie} m²` : null, hab.capacidad ? `hasta ${hab.capacidad}` : null, hab.camas || null].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          {elegida && <span className="text-brand-600 dark:text-brand-400 text-sm flex-shrink-0">✓</span>}
                        </button>
                        {elegida && (
                          <div onClick={e => e.stopPropagation()}>
                            <input type="text" inputMode="numeric" value={formatearMiles(elegida.precio)}
                              onChange={e => setPrecioHabitacion(idx, hab.id, soloDigitos(e.target.value))} placeholder="Precio de esta habitación"
                              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <input type="number" value={h.noches} onChange={e => setHospedajeCampo(idx, 'noches', e.target.value)} placeholder="Noches"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <p title="Se completa solo con la cantidad de adultos + menores del Cliente"
                className="w-full border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-700 dark:text-zinc-300 rounded-xl px-3 py-2.5 text-sm">
                {h.personas || 0} personas
              </p>
            </div>

            <div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1">Valor neto (costo) y de venta — el neto es uso interno, nunca se exporta al PDF</p>
              <div className="grid sm:grid-cols-4 gap-3">
                <input type="text" inputMode="numeric" value={formatearMiles(h.costo_interno)} onChange={e => setHospedajeCampo(idx, 'costo_interno', soloDigitos(e.target.value))} placeholder="Valor neto"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <input type="text" inputMode="numeric" value={formatearMiles(h.precio)} onChange={e => setHospedajeCampo(idx, 'precio', soloDigitos(e.target.value))} placeholder="Valor de venta"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <select value={h.moneda} onChange={e => setHospedajeCampo(idx, 'moneda', e.target.value)}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="ARS">ARS$</option>
                  <option value="BRL">R$</option>
                  <option value="USD">U$D</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={!!h.precio_publico} onChange={() => setHospedajeCampo(idx, 'precio_publico', !h.precio_publico)}
                    className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500" />
                  {h.precio_publico ? 'Pública' : 'Privada'}
                </label>
              </div>
            </div>

            <input value={h.incluye} onChange={e => setHospedajeCampo(idx, 'incluye', e.target.value)} placeholder="Incluye (Ej: Aéreo + Hospedaje + Traslados)"
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

            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Servicios</p>
              <div className="flex flex-wrap gap-2">
                {SERVICIOS_HOSPEDAJE.map(servicio => {
                  const activo = h.items.includes(servicio)
                  return (
                    <button key={servicio} type="button" onClick={() => alternarServicioHospedaje(idx, servicio)}
                      className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                        activo
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-brand-300'
                      }`}>
                      {servicio}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Generar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 sticky bottom-4 shadow-lg">
        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}
        {exito && <p className="text-xs text-green-600 dark:text-green-400 mb-3 bg-green-50 dark:bg-green-950/40 px-3 py-2 rounded-lg">✓ PDF descargado y propuesta guardada.</p>}
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
            {generando ? 'Generando PDF...' : 'Generar y descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
