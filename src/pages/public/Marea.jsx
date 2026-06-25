import { useState } from 'react'

const DESTINOS = ['Porto de Galinhas', 'Maragogi', 'Maceió']
const DIAS_CORTOS_LABEL = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

function generarMarea(destino) {
  const hoy = new Date()
  const dias = []
  const seed = destino.length * 7
  for (let i = 0; i < 8; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() + i)
    const minBase = (seed + i * 48) % 60
    const hrBaja = 9 + (i % 4)
    const hrAlta = hrBaja + 6
    const minBaja = (minBase + i * 2) % 60
    const minAlta = (minBase + 18 + i * 2) % 60
    const alturaBaja = parseFloat((0.3 + i * 0.09 + Math.sin(i + seed * 0.1) * 0.06).toFixed(1))
    const alturaAlta = parseFloat((1.8 + Math.sin(i * 0.8 + seed * 0.05) * 0.3).toFixed(1))
    dias.push({
      fecha, diaN: fecha.getDate(),
      diaLabel: DIAS_CORTOS_LABEL[fecha.getDay()],
      bajahora: `${String(hrBaja).padStart(2,'0')}:${String(minBaja).padStart(2,'0')}`,
      bajaAltura: alturaBaja,
      altaHora: `${String(hrAlta > 23 ? hrAlta - 24 : hrAlta).padStart(2,'0')}:${String(minAlta).padStart(2,'0')}`,
      altaAltura: alturaAlta,
    })
  }
  return dias
}

function getEstado(a) {
  if (a <= 0.79) return { label: 'IDEAL',      bg: '#00b4c8', color: '#001a1f' }
  if (a <= 1.0)  return { label: 'ACEPTABLE',  bg: '#c49b2f', color: '#1a1000' }
  return               { label: 'NO IDEAL',    bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
}

const C = {
  bg: '#0b1e2d', teal: '#00b4c8', white: '#ffffff',
  muted: 'rgba(255,255,255,0.5)', rowBorder: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.08)',
}

export default function Marea() {
  const [destinoSel, setDestinoSel] = useState(DESTINOS[0])
  const mareas = generarMarea(destinoSel)
  const proximaIdeal = mareas.find(d => d.bajaAltura <= 0.7) || mareas[0]

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '64px 24px 0' }}>

        {/* Label */}
        <p style={{ fontFamily:"'Helvetica Neue',Arial,sans-serif", fontSize:'11px', fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:C.teal, marginBottom:'20px' }}>
          Tabla de Marea · Nordeste
        </p>

        {/* H1 */}
        <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontWeight:700, fontSize:'clamp(2.6rem,6vw,4.2rem)', lineHeight:1.05, letterSpacing:'-0.02em', color:C.white, marginBottom:'20px', maxWidth:'680px' }}>
          Elegí el día perfecto<br/>para las piscinas naturales
        </h1>

        {/* Subcopy */}
        <p style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:'15px', lineHeight:1.7, color:'rgba(255,255,255,0.65)', maxWidth:'520px', marginBottom:'40px' }}>
          Las piscinas naturales se forman únicamente con <strong style={{ color:C.white, fontWeight:600 }}>marea baja</strong> — por debajo de 0,7 metros. Consultá los horarios de cada destino y planificá tu excursión con anticipación.
        </p>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'32px', flexWrap:'wrap' }}>
          {DESTINOS.map(d => {
            const active = destinoSel === d
            return (
              <button key={d} onClick={() => setDestinoSel(d)} style={{
                padding:'10px 22px', borderRadius:'6px', fontSize:'12px', fontWeight:700, letterSpacing:'0.08em',
                textTransform:'uppercase', cursor:'pointer',
                border: active ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                background: active ? C.teal : 'transparent',
                color: active ? '#001a1f' : 'rgba(255,255,255,0.7)',
                transition:'all 0.18s',
              }}>{d}</button>
            )
          })}
        </div>

        {/* Card próxima ventana ideal */}
        <div style={{ background:'rgba(0,180,200,0.07)', border:'1px solid rgba(0,180,200,0.2)', borderRadius:'14px', padding:'24px 28px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
          <div>
            <p style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:C.teal, marginBottom:'10px' }}>
              Próxima ventana ideal · {destinoSel}
            </p>
            <p style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'clamp(1.8rem,4vw,2.6rem)', fontWeight:500, color:C.white, lineHeight:1 }}>
              {proximaIdeal.diaLabel.charAt(0)+proximaIdeal.diaLabel.slice(1).toLowerCase()} {proximaIdeal.diaN} · {proximaIdeal.bajahora} h
            </p>
          </div>
          <div style={{ display:'flex', gap:'40px' }}>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:C.muted, marginBottom:'8px' }}>Altura Mín.</p>
              <p style={{ fontFamily:"'Playfair Display',serif", fontSize:'2rem', fontWeight:600, color:C.teal, lineHeight:1 }}>
                {String(proximaIdeal.bajaAltura).replace('.',',')} m
              </p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:C.muted, marginBottom:'8px' }}>Duración</p>
              <p style={{ fontFamily:"'Playfair Display',serif", fontSize:'2rem', fontWeight:600, color:C.white, lineHeight:1 }}>~3h</p>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ borderRadius:'14px', overflow:'hidden', border:`1px solid ${C.cardBorder}` }}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1.4fr 1fr', padding:'14px 24px', borderBottom:`1px solid ${C.rowBorder}` }}>
            {['DÍA','MAREA BAJA','MAREA ALTA','ESTADO'].map((h,i) => (
              <p key={h} style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.muted, textAlign:i===3?'right':'left' }}>{h}</p>
            ))}
          </div>

          {/* Filas */}
          {mareas.map((d, idx) => {
            const estado = getEstado(d.bajaAltura)
            return (
              <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1.4fr 1fr', padding:'20px 24px', alignItems:'center', borderBottom: idx<mareas.length-1 ? `1px solid ${C.rowBorder}` : 'none', background: idx===0 ? 'rgba(0,180,200,0.04)' : 'transparent' }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', fontWeight:600, color:C.white, lineHeight:1 }}>{d.diaN}</span>
                  <span style={{ fontSize:'11px', fontWeight:700, letterSpacing:'0.06em', color:C.muted }}>{d.diaLabel}</span>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}>
                  <span style={{ fontSize:'1rem', fontWeight:600, color:C.white }}>{d.bajahora}</span>
                  <span style={{ fontSize:'0.82rem', fontWeight:700, color:C.teal }}>{String(d.bajaAltura).replace('.',',')} m</span>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}>
                  <span style={{ fontSize:'1rem', fontWeight:500, color:'rgba(255,255,255,0.6)' }}>{d.altaHora}</span>
                  <span style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.35)' }}>{String(d.altaAltura).replace('.',',')} m</span>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <span style={{ display:'inline-block', padding:'5px 14px', borderRadius:'999px', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', background:estado.bg, color:estado.color }}>{estado.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.25)', textAlign:'center', marginTop:'24px' }}>
          * Datos orientativos. Para excursiones acuáticas, consultá con tu guía local.
        </p>
      </div>
    </div>
  )
}
