import type { Ref } from 'vue'
import { useAuth } from '../auth/useAuth'
import { useOrganizationContext } from './useOrganizationContext'
import { useArchivedNamedItemsCache } from '../archived/useArchivedNamedItemsCache'
import { useOrgSettingsPageData } from '../settings/useOrgSettingsPageData'
import { useOrgWorkspaceIndexPageData } from '../workspace/useOrgWorkspaceIndexPageData'
import { applyOrganizationRealtime } from './applyOrganizationRealtime'

type EchoChannel = {
  listen: (event: string, cb: (payload: unknown) => void) => EchoChannel
}
type EchoClient = {
  private: (channel: string) => EchoChannel
  leave: (channel: string) => void
  connector?: {
    pusher?: {
      connection: {
        state: string
        bind: (event: string, cb: () => void) => void
        unbind: (event: string, cb?: () => void) => void
      }
    }
  }
}

/** 組織ページを開いているあいだ、組織チャンネルの変更を画面へ反映する。 */
export function useOrganizationRealtimeChannel (orgSlug: Ref<string>) {
  const route = useRoute()
  const { session, patchSessionUser, fetchSession } = useAuth()
  const { resolvePostLoginPath } = useOrganizationContext()
  const index = useOrgWorkspaceIndexPageData()
  const settings = useOrgSettingsPageData()
  const archived = useArchivedNamedItemsCache()
  let channelName: string | null = null
  let subscribed = false
  let subscribeGeneration = 0
  let connectedHandler: (() => void) | null = null
  let failedHandler: (() => void) | null = null

  function organizationId (): number | null {
    const slug = orgSlug.value.trim()
    if (!slug) {
      return null
    }
    const org = session.value?.user?.organizations?.find(item => item.slug === slug)
    return org?.id ?? null
  }

  function clearConnectionHandlers (echo: EchoClient | null | undefined) {
    const connection = echo?.connector?.pusher?.connection
    if (!connection) {
      connectedHandler = null
      failedHandler = null
      return
    }
    if (connectedHandler) {
      connection.unbind('connected', connectedHandler)
      connectedHandler = null
    }
    if (failedHandler) {
      connection.unbind('failed', failedHandler)
      failedHandler = null
    }
  }

  function subscribe () {
    if (!import.meta.client) {
      return
    }
    const id = organizationId()
    const echo = (useNuxtApp() as unknown as { $echo?: EchoClient | null }).$echo
    if (!echo || id == null) {
      return
    }
    const nextChannel = `organizations.${id}`
    if (channelName && channelName !== nextChannel) {
      echo.leave(channelName)
      subscribed = false
    }
    channelName = nextChannel
    const generation = ++subscribeGeneration
    clearConnectionHandlers(echo)
    const attach = () => {
      if (generation !== subscribeGeneration || subscribed) {
        return
      }
      echo.leave(nextChannel)
      subscribed = true
      echo.private(nextChannel).listen('.OrganizationChanged', (payload: unknown) => {
        applyOrganizationRealtime(payload, {
          orgSlug: orgSlug.value.trim(),
          route,
          sessionUserId: session.value?.user?.id ?? null,
          organizations: session.value?.user?.organizations ?? [],
          patchSessionUser,
          fetchSession,
          resolvePostLoginPath,
          index,
          settings,
          archived,
        })
      })
    }
    const onFailed = () => {
      if (generation !== subscribeGeneration) {
        return
      }
      subscribed = false
      echo.leave(nextChannel)
    }
    const connection = echo.connector?.pusher?.connection
    if (connection?.state === 'connected') {
      attach()
      return
    }
    connectedHandler = attach
    failedHandler = onFailed
    connection?.bind('connected', attach)
    connection?.bind('failed', onFailed)
  }

  function unsubscribe () {
    if (!import.meta.client) {
      return
    }
    subscribeGeneration += 1
    const echo = (useNuxtApp() as unknown as { $echo?: EchoClient | null }).$echo
    clearConnectionHandlers(echo)
    if (channelName) {
      echo?.leave(channelName)
    }
    channelName = null
    subscribed = false
  }

  watch(
    () => [orgSlug.value, organizationId()] as const,
    () => {
      unsubscribe()
      subscribe()
    },
  )
  onMounted(() => {
    subscribe()
  })
  onBeforeUnmount(() => {
    unsubscribe()
  })
}
