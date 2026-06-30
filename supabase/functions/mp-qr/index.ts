import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const MP_USER_ID = Deno.env.get('MP_USER_ID')!
const EXTERNAL_STORE_ID = 'dreamstourstore01'
const EXTERNAL_POS_ID = 'dreamstourcaja01'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

async function mpFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res.json()
}

async function getOrCreatePos() {
  // 1. Buscar POS existente por external_id
  const list = await mpFetch(`/pos?external_id=${EXTERNAL_POS_ID}`)
  console.log('POS list total:', list?.paging?.total)

  if (list?.results?.length > 0) {
    const posId = list.results[0].id
    const pos = await mpFetch(`/pos/${posId}`)
    console.log('POS found:', posId)
    if (pos.qr?.image) return pos
  }

  // 2. Buscar store existente
  let storeId: string | null = null
  const storeList = await mpFetch(`/users/${MP_USER_ID}/stores/search?external_id=${EXTERNAL_STORE_ID}`)
  console.log('Store search:', JSON.stringify(storeList).slice(0, 200))

  if (storeList?.data?.id) {
    storeId = storeList.data.id
  } else {
    // Crear store
    const store = await mpFetch(`/users/${MP_USER_ID}/stores`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'DreamsTour',
        external_id: EXTERNAL_STORE_ID,
        location: {
          street_number: '1',
          street_name: 'Online',
          city_name: 'Salvador',
          state_name: 'Bahia',
          latitude: -12.97,
          longitude: -38.50,
          reference: 'DreamsTour',
        },
      }),
    })
    console.log('Store created:', store.id)
    storeId = store.id
  }

  if (!storeId) return null

  // 3. Crear POS
  const pos = await mpFetch('/pos', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Caja DreamsTour',
      fixed_amount: false,
      store_id: storeId,
      external_store_id: EXTERNAL_STORE_ID,
      external_id: EXTERNAL_POS_ID,
    }),
  })
  console.log('POS created:', pos.id, 'qr:', !!pos.qr?.image)
  return pos
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const pos = await getOrCreatePos()

    if (!pos?.qr?.image) {
      return new Response(JSON.stringify({ error: 'No se pudo generar el QR', details: pos }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      qr_image: pos.qr.image,
      qr_string: pos.qr_code,
      pos_id: pos.id,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('mp-qr error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
