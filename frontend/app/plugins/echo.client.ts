import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { getToken } = useAuth()

  // laravel-echo は内部で `window.Pusher` を参照する
  // @ts-expect-error pusher-js を Echo に渡すため window へ載せる
  window.Pusher = Pusher

  const apiBaseUrl = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')
  const scheme = String(config.public.reverbScheme || 'http')

  const authHeaders: Record<string, string> = {}
  const token = getToken()
  if (token) {
    authHeaders.Authorization = `Bearer ${token}`
  }

  const echo = new Echo({
    broadcaster: 'reverb',
    key: config.public.reverbKey,
    wsHost: config.public.reverbHost,
    wsPort: config.public.reverbPort,
    wssPort: config.public.reverbPort,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${apiBaseUrl}/broadcasting/auth`,
    auth: {
      headers: authHeaders,
    },
  })

  return {
    provide: { echo },
  }
})
