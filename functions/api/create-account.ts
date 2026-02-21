interface Env {
  APP_SHARED_SECRET: string
}

export const onRequestPost: PagesFunction<Env> = async context => {
  const {request, env} = context

  if (!env.APP_SHARED_SECRET) {
    return new Response(JSON.stringify({error: 'Server configuration error'}), {
      status: 500,
      headers: {'Content-Type': 'application/json'},
    })
  }

  const body = await request.text()

  const pdsResponse = await fetch(
    'https://self.surf/xrpc/com.atproto.server.createAccount',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': env.APP_SHARED_SECRET,
      },
      body,
    },
  )

  return new Response(pdsResponse.body, {
    status: pdsResponse.status,
    headers: {
      'Content-Type':
        pdsResponse.headers.get('Content-Type') || 'application/json',
    },
  })
}
