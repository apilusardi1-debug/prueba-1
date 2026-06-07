import { useState, useEffect } from 'react'
import { useSiteConfig, CONFIG_DEFAULTS } from '../../context/SiteConfigContext.jsx'

const SECTION = {
  title: (t) => (
    <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208', marginBottom: 4 }}>{t}</h2>
  ),
  label: (t) => (
    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t}</label>
  ),
}

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {SECTION.label(label)}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', color: '#1C1208', resize: 'vertical', outline: 'none', background: 'white', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#b07420'}
          onBlur={e => e.target.style.borderColor = '#e8d09a'}
        />
      ) : type === 'color' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ width: 48, height: 40, border: '1.5px solid #e8d09a', borderRadius: 8, padding: 2, cursor: 'pointer', background: 'white' }}
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="#000000"
            style={{ flex: 1, border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', color: '#1C1208', outline: 'none', background: 'white' }}
            onFocus={e => e.target.style.borderColor = '#b07420'}
            onBlur={e => e.target.style.borderColor = '#e8d09a'}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', color: '#1C1208', outline: 'none', background: 'white', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#b07420'}
          onBlur={e => e.target.style.borderColor = '#e8d09a'}
        />
      )}
      {hint && <p style={{ fontSize: '0.72rem', color: '#999', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export default function SiteConfig() {
  const { config, saveConfig, loading } = useSiteConfig()
  const [form, setForm] = useState(config)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'error'

  // Sincroniza el form cuando carga la config de Supabase
  useEffect(() => {
    if (!loading) setForm(config)
  }, [loading])

  function set(key) {
    return (val) => setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    const result = await saveConfig(form)
    setSaving(false)
    setStatus(result.ok ? 'ok' : 'error')
    setTimeout(() => setStatus(null), 3000)
  }

  function handleReset() {
    setForm(CONFIG_DEFAULTS)
  }

  const card = { background: 'white', borderRadius: 16, border: '1px solid #e8d09a', padding: '24px 28px', marginBottom: 20 }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 6 }}>Panel interno</p>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.8rem', color: '#1C1208' }}>Configuración del sitio</h1>
        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>Los cambios se reflejan en el sitio público al instante.</p>
      </div>

      {/* 1. Hero */}
      <div style={card}>
        <div style={{ marginBottom: 4 }}>{SECTION.title('🖼️  Banner principal (Hero)')}</div>
        <p style={{ fontSize: '0.78rem', color: '#999', marginBottom: 20 }}>
          El título y subtítulo del banner se traducen automáticamente según el idioma del visitante. Podés cambiar la foto de fondo y el texto del botón.
        </p>
        <Field label="Texto del botón" value={form.hero_cta} onChange={set('hero_cta')} placeholder="Ver paquetes" />
        <Field
          label="URL de la imagen de fondo"
          value={form.hero_imagen}
          onChange={set('hero_imagen')}
          placeholder="https://images.unsplash.com/..."
          hint="Usá una URL de Unsplash o subí la imagen a un servicio como Cloudinary."
        />
        {form.hero_imagen && (
          <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', height: 120, position: 'relative' }}>
            <img src={form.hero_imagen} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center', padding: '0 16px' }}>Preview de imagen</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Colores */}
      <div style={card}>
        <div style={{ marginBottom: 20 }}>{SECTION.title('🎨  Paleta de colores')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field
            label="Color primario (botones, precios)"
            type="color"
            value={form.color_primario}
            onChange={set('color_primario')}
            hint="Dorado/bronce por defecto"
          />
          <Field
            label="Color acento (bordes, estrellas)"
            type="color"
            value={form.color_acento}
            onChange={set('color_acento')}
            hint="Dorado claro por defecto"
          />
        </div>
        {/* Preview de botones */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <span style={{ background: form.color_primario, color: 'white', padding: '8px 20px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700 }}>Ver paquetes →</span>
          <span style={{ border: `1.5px solid ${form.color_acento}`, color: form.color_primario, padding: '8px 20px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600 }}>Consultar</span>
        </div>
      </div>

      {/* 3. Contacto */}
      <div style={card}>
        <div style={{ marginBottom: 20 }}>{SECTION.title('📞  Contacto y redes')}</div>
        <Field
          label="Número de WhatsApp"
          value={form.whatsapp}
          onChange={set('whatsapp')}
          placeholder="5491100000000"
          hint="Sin + ni espacios. Ej: 5491155667788 (54 = Argentina, 11 = CABA)"
        />
        <Field
          label="URL de Instagram"
          value={form.instagram_url}
          onChange={set('instagram_url')}
          placeholder="https://instagram.com/dreamstour"
        />
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: '#1C1208', color: '#f9f3e3', fontWeight: 700, padding: '12px 28px', borderRadius: 12, border: 'none', fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'background 0.15s' }}
          onMouseEnter={e => { if (!saving) e.target.style.background = '#b07420' }}
          onMouseLeave={e => { e.target.style.background = '#1C1208' }}
        >
          {saving ? '⏳ Guardando...' : '💾 Guardar cambios'}
        </button>

        <button
          onClick={handleReset}
          style={{ background: 'white', color: '#888', fontWeight: 600, padding: '12px 20px', borderRadius: 12, border: '1.5px solid #e8d09a', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Restablecer defaults
        </button>

        {status === 'ok' && (
          <span style={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 600 }}>✓ Guardado correctamente</span>
        )}
        {status === 'error' && (
          <span style={{ color: '#c0392b', fontSize: '0.85rem', fontWeight: 600 }}>✕ Error — ¿Supabase conectado?</span>
        )}
      </div>

      {/* Nota Supabase */}
      <div style={{ marginTop: 28, background: '#fdf8ee', border: '1px solid #e8d09a', borderRadius: 12, padding: '14px 18px' }}>
        <p style={{ fontSize: '0.78rem', color: '#8a581e', lineHeight: 1.6 }}>
          <strong>⚠️  ¿Los cambios no persisten?</strong> Necesitás conectar Supabase. Corré el siguiente SQL en el <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#b07420', fontWeight: 600 }}>SQL Editor de Supabase</a>:<br />
          <code style={{ display: 'block', marginTop: 8, background: '#1C1208', color: '#f2e4c0', padding: '10px 14px', borderRadius: 8, fontSize: '0.75rem', whiteSpace: 'pre' }}>{`create table if not exists site_config (
  id integer primary key default 1,
  hero_titulo text,
  hero_subtitulo text,
  hero_cta text,
  hero_imagen text,
  color_primario text,
  color_acento text,
  whatsapp text,
  instagram_url text,
  updated_at timestamptz default now()
);
insert into site_config (id) values (1) on conflict do nothing;`}</code>
        </p>
      </div>
    </div>
  )
}
