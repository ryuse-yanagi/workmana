export function useAuth () {
  const config = useRuntimeConfig()

  const tokenKey = 'id_token'
  const isClient = import.meta.client

  const cognitoDomain = computed(() => String(config.public.cognitoDomain || '').replace(/\/$/, ''))
  const cognitoClientId = computed(() => String(config.public.cognitoClientId || ''))
  const cognitoRedirectUri = computed(() => String(config.public.cognitoRedirectUri || ''))
  const cognitoLogoutRedirectUri = computed(() => String(config.public.cognitoLogoutRedirectUri || ''))

  const isConfigured = computed(() => {
    return !!(cognitoDomain.value && cognitoClientId.value && cognitoRedirectUri.value)
  })

  function getToken (): string {
    if (!isClient) {
      return ''
    }
    return localStorage.getItem(tokenKey)?.trim() ?? ''
  }

  function setToken (token: string) {
    if (!isClient) {
      return
    }
    localStorage.setItem(tokenKey, token.trim())
  }

  function clearToken () {
    if (!isClient) {
      return
    }
    localStorage.removeItem(tokenKey)
  }

  function buildLoginUrl (nextPath: string = '/org/acme'): string {
    if (!isConfigured.value) {
      throw new Error('Cognito 設定が不足しています（domain / clientId / redirectUri）')
    }
    const query = new URLSearchParams({
      client_id: cognitoClientId.value,
      response_type: 'token',
      scope: 'openid email profile',
      redirect_uri: cognitoRedirectUri.value,
      state: nextPath,
    })
    return `${cognitoDomain.value}/login?${query.toString()}`
  }

  function buildLogoutUrl (): string | null {
    if (!cognitoDomain.value || !cognitoClientId.value || !cognitoLogoutRedirectUri.value) {
      return null
    }
    const query = new URLSearchParams({
      client_id: cognitoClientId.value,
      logout_uri: cognitoLogoutRedirectUri.value,
    })
    return `${cognitoDomain.value}/logout?${query.toString()}`
  }

  function readIdTokenFromHash (): string {
    if (!isClient) {
      return ''
    }
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    return (params.get('id_token') || '').trim()
  }

  function readStateFromHash (): string {
    if (!isClient) {
      return ''
    }
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    return (params.get('state') || '').trim()
  }

  return {
    isConfigured,
    getToken,
    setToken,
    clearToken,
    buildLoginUrl,
    buildLogoutUrl,
    readIdTokenFromHash,
    readStateFromHash,
  }
}
