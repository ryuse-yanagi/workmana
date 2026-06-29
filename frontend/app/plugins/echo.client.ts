import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
type EchoInstance = InstanceType<typeof Echo>
const ECHO_SINGLETON_KEY = '__tmEchoInstance'
function disconnectEcho (instance: EchoInstance | null | undefined): void {
  if (!instance) {
    return
  }
  try {
    instance.disconnect()
  } catch {
    // ignore
  }
}
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { getToken } = useAuth()
  const globalRef = globalThis as typeof globalThis & { [ECHO_SINGLETON_KEY]?: EchoInstance }
  // HMR でプラグインが再実行されると Pusher が増殖して WS が大量に Finished になる
  disconnectEcho(globalRef[ECHO_SINGLETON_KEY])
  // laravel-echo は内部で `window.Pusher` を参照する
  // @ts-expect-error pusher-js を Echo に渡すため window へ載せる
  window.Pusher = Pusher
  const apiBaseUrl = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')
  const authEndpoint = `${apiBaseUrl}/broadcasting/auth`
  const scheme = String(config.public.reverbScheme || 'http')
  const wsHost = String(config.public.reverbHost || '127.0.0.1')
  const wsPort = Number(config.public.reverbPort || 8080)
  const useTls = scheme === 'https'
  let echo: EchoInstance
  try {
    echo = new Echo({
      broadcaster: 'reverb',
      key: String(config.public.reverbKey || 'local-key'),
      cluster: '',
      wsHost,
      wsPort,
      wssPort: wsPort,
      forceTLS: useTls,
      enabledTransports: useTls ? ['wss', 'ws'] : ['ws'],
      disableStats: true,
      channelAuthorization: {
        endpoint: authEndpoint,
        transport: 'ajax',
        headersProvider: () => {
          const headers: Record<string, string> = {}
          const token = getToken()
          if (token) {
            headers.Authorization = `Bearer ${token}`
          }
          return headers
        },
      },
    })
  } catch (error) {
    console.error('[echo] failed to initialize', error)
    return { provide: { echo: null as EchoInstance | null } }
  }
  globalRef[ECHO_SINGLETON_KEY] = echo
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      disconnectEcho(globalRef[ECHO_SINGLETON_KEY])
      delete globalRef[ECHO_SINGLETON_KEY]
    })
  }
  return {
    provide: { echo },
  }
})
