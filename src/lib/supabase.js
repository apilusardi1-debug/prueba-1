import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Faltan variables de entorno de Supabase. Copiá .env.example a .env y completá los valores.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// ── Excursiones ────────────────────────────────────────────────────────────────
export const excursionesApi = {
  getAll: () => supabase.from('excursiones').select('*').order('nombre'),
  getById: (id) => supabase.from('excursiones').select('*').eq('id', id).single(),
  create: (data) => supabase.from('excursiones').insert(data).select().single(),
  update: (id, data) => supabase.from('excursiones').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('excursiones').delete().eq('id', id),
}

// ── Reservas ───────────────────────────────────────────────────────────────────
export const reservasApi = {
  getAll: () => supabase.from('reservas').select('*, excursiones(nombre)').order('fecha'),
  getByWhatsapp: (whatsapp) => supabase.from('reservas').select('*, excursiones(nombre, imagen)').eq('cliente_whatsapp', whatsapp),
  create: (data) => supabase.from('reservas').insert(data).select().single(),
  updateEstado: (id, estado) => supabase.from('reservas').update({ estado }).eq('id', id).select().single(),
}

// ── Leads ──────────────────────────────────────────────────────────────────────
export const leadsApi = {
  getAll: () => supabase.from('leads').select('*').order('created_at', { ascending: false }),
  create: (data) => supabase.from('leads').insert(data).select().single(),
  updateEstado: (id, estado, notas) => supabase.from('leads').update({ estado, notas }).eq('id', id).select().single(),
}

// ── Clientes ───────────────────────────────────────────────────────────────────
export const clientesApi = {
  getAll: () => supabase.from('clientes').select('*').order('nombre'),
  getByWhatsapp: (whatsapp) => supabase.from('clientes').select('*').eq('whatsapp', whatsapp).single(),
  upsert: (data) => supabase.from('clientes').upsert(data, { onConflict: 'whatsapp' }).select().single(),
  updateNotas: (id, notas) => supabase.from('clientes').update({ notas }).eq('id', id).select().single(),
}
