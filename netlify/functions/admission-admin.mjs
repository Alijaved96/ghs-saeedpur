import { getStore } from '@netlify/blobs'

const allowedStatuses = new Set(['Pending', 'Approved', 'Rejected'])

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function verifyIdentity(req) {
  const authorization = req.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null

  const origin = new URL(req.url).origin
  const response = await fetch(`${origin}/.netlify/identity/user`, {
    headers: { Authorization: authorization },
  })

  if (!response.ok) return null
  return response.json()
}

export default async (req) => {
  const user = await verifyIdentity(req)
  if (!user) return json({ error: 'Administrator login required.' }, 401)

  const store = getStore({ name: 'admission-applications', consistency: 'strong' })

  if (req.method === 'GET') {
    const { blobs } = await store.list()
    const applications = (await Promise.all(
      blobs.map(({ key }) => store.get(key, { type: 'json', consistency: 'strong' }))
    )).filter(Boolean)

    applications.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    return json({ applications, user: { email: user.email || null } })
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request data.' }, 400)
    }

    if (body.action !== 'update-status') return json({ error: 'Unsupported action.' }, 400)
    if (!body.id || !allowedStatuses.has(body.status)) return json({ error: 'Invalid application status.' }, 400)

    const application = await store.get(body.id, { type: 'json', consistency: 'strong' })
    if (!application) return json({ error: 'Application not found.' }, 404)

    application.status = body.status
    application.updated_at = new Date().toISOString()
    application.status_updated_by = user.email || user.id || 'Administrator'
    await store.setJSON(body.id, application)

    return json({ application })
  }

  return json({ error: 'Method not allowed.' }, 405)
}
