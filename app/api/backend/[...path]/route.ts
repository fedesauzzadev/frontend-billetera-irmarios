import { NextRequest, NextResponse } from 'next/server'

const backendUrl = process.env.BASE_URL_2 || process.env.BASE_URL

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!backendUrl) {
    return NextResponse.json({ message: 'Falta configurar BASE_URL_2.' }, { status: 500 })
  }

  const { path } = await context.params
  const target = `${backendUrl.replace(/\/$/, '')}/${path.join('/')}${request.nextUrl.search}`
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('origin')

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  const cache = upstream.headers.get('x-cache')
  const stale = upstream.headers.get('x-stale')
  if (contentType) responseHeaders.set('content-type', contentType)
  if (cache) responseHeaders.set('x-cache', cache)
  if (stale) responseHeaders.set('x-stale', stale)

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
