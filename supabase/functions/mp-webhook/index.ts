import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function metodoDesdeMP(paymentMethodId: string, paymentTypeId: string): string {
  if (paymentMethodId === 'pix') return 'qr'
  if (paymentTypeId === 'credit_card' || paymentTypeId === 'debit_card') return 'tarjeta'
  if (paymentTypeId === 'bank_transfer') return 'transferencia'
  return 'otro'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    console.log('MP webhook recibido:', JSON.stringify(body))

    // MP envía distintos tipos de notificaciones, solo procesamos payments
    if (body.type !== 'payment' || !body.data?.id) {
      return new Response('ignorado', { headers: CORS })
    }

    const paymentId = String(body.data.id)

    // Consultar los detalles completos del pago a la API de MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      const err = await mpRes.text()
      console.error('Error consultando MP:', err)
      return new Response('error mp api', { status: 500, headers: CORS })
    }

    const pago = await mpRes.json()
    console.log('Pago MP:', pago.id, pago.status, pago.transaction_amount)

    // Solo registrar pagos aprobados
    if (pago.status !== 'approved') {
      return new Response('pago no aprobado', { headers: CORS })
    }

    // Evitar duplicados: verificar si ya existe un movimiento con esta referencia
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: existente } = await supabase
      .from('movimientos_caja')
      .select('id')
      .eq('referencia_mp', paymentId)
      .maybeSingle()

    if (existente) {
      console.log('Pago ya registrado, ignorando:', paymentId)
      return new Response('ya registrado', { headers: CORS })
    }

    // Armar el nombre del pagador
    const pagador = pago.payer
    const nombrePagador = [pagador?.first_name, pagador?.last_name].filter(Boolean).join(' ')
      || pagador?.email
      || 'Cliente MP'

    // Insertar en movimientos_caja
    const { error } = await supabase.from('movimientos_caja').insert({
      fecha: (pago.date_approved || pago.date_created).split('T')[0],
      tipo: 'ingreso',
      categoria: 'reserva',
      concepto: pago.description || `Pago QR Mercado Pago`,
      monto: pago.transaction_amount,
      moneda: pago.currency_id || 'BRL',
      persona_nombre: nombrePagador,
      metodo: metodoDesdeMP(pago.payment_method_id, pago.payment_type_id),
      estado: 'confirmado',
      notas: `MP ID: ${paymentId} · ${pago.payment_method_id}`,
      referencia_mp: paymentId,
    })

    if (error) {
      console.error('Error insertando en Supabase:', error)
      return new Response('error db', { status: 500, headers: CORS })
    }

    console.log('Movimiento creado OK para pago:', paymentId)
    return new Response(JSON.stringify({ ok: true, paymentId }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (err) {
    console.error('mp-webhook error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
