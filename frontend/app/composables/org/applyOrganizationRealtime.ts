import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { normalizeSettingsLabelCategories } from '../../components/settings/labelCategoryNormalize'
import type {
  SettingsLabelCategory,
  SettingsOrgMember,
  SettingsPendingInvite,
} from '../../components/settings/types'
import type { AuthSession, AuthUser } from '../auth/useAuth'
import { dispatchUserProfileUpdated } from '../auth/userProfileUpdated'
import {
  applyDocumentArchived,
  applyDocumentCreated,
  applyDocumentPermanentlyDeleted,
  applyDocumentRestored,
  applyDocumentUpdated,
} from '../document/syncDocumentCaches'
import { remapCachedDocumentCategories } from '../document/useOrgDocumentsPageData'
import {
  flattenLabelCategories,
  normalizeLabelCategories,
  type LabelCategoryGroup,
  type LabelCategoryItem,
} from '../label/useLabelCategories'
import { dispatchWorkspaceMembersUpdated } from '../member/workspaceMembersUpdated'
import type { useArchivedNamedItemsCache } from '../archived/useArchivedNamedItemsCache'
import type { useOrgSettingsPageData } from '../settings/useOrgSettingsPageData'
import { invalidateOrgDerivedCaches, invalidateWorkspaceViewCaches } from '../settings/invalidateOrgDerivedCaches'
import { beginForcedAppNavigation, endForcedAppNavigation } from '../shared/useUnsavedChangesGuard'
import { getWorkspaceBoardCacheMap } from '../workspace/useWorkspaceBoardPageData'
import {
  getOrgWorkspaceIndexCacheMap,
  notifyOrgWorkspaceIndexCacheChanged,
  type OrgWorkspaceItem,
  type OrgWorkspaceStatus,
  type useOrgWorkspaceIndexPageData,
} from '../workspace/useOrgWorkspaceIndexPageData'
import { getWorkspaceWbsCacheMap } from '../wbs/useWorkspaceWbsPageData'
import { resolveLabelColors, resolveStandardColors } from '../../utils/shared/colorPresetResolution'

export const LABEL_CATALOG_UPDATED_EVENT = 'tm:label-catalog-updated'

export type LabelCatalogUpdatedDetail = {
  orgSlug: string
  kind: 'task' | 'workspace'
  categories: LabelCategoryGroup[]
}

export type OrganizationRealtimeContext = {
  orgSlug: string
  route: RouteLocationNormalizedLoaded
  sessionUserId: number | null
  organizations: NonNullable<AuthUser['organizations']>
  patchSessionUser: (partial: Partial<AuthUser>) => void
  fetchSession: (options?: { force?: boolean }) => Promise<AuthSession>
  resolvePostLoginPath: (user?: AuthUser | null) => Promise<string>
  index: ReturnType<typeof useOrgWorkspaceIndexPageData>
  settings: ReturnType<typeof useOrgSettingsPageData>
  archived: ReturnType<typeof useArchivedNamedItemsCache>
}

type NameDiff = {
  renames?: Array<{ from?: string; to?: string }>
  deleted?: string[]
}

type WorkspacePayload = OrgWorkspaceItem

function asRecord (value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  return value as Record<string, unknown>
}

function asNumber (value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function renamedName (name: string | null | undefined, diff: NameDiff): string | null {
  if (!name) {
    return null
  }
  for (const rename of diff.renames ?? []) {
    if (rename.from && rename.to && rename.from === name) {
      return rename.to
    }
  }
  if ((diff.deleted ?? []).includes(name)) {
    return null
  }
  return name
}

function dispatchLabelCatalog (detail: LabelCatalogUpdatedDetail): void {
  if (!import.meta.client) {
    return
  }
  window.dispatchEvent(new CustomEvent(LABEL_CATALOG_UPDATED_EVENT, { detail }))
}

export function useOnLabelCatalogUpdated (
  handler: (detail: LabelCatalogUpdatedDetail) => void,
): void {
  function onEvent (event: Event) {
    const detail = (event as CustomEvent<LabelCatalogUpdatedDetail>).detail
    if (!detail?.orgSlug || (detail.kind !== 'task' && detail.kind !== 'workspace')) {
      return
    }
    handler(detail)
  }
  onMounted(() => {
    if (import.meta.client) {
      window.addEventListener(LABEL_CATALOG_UPDATED_EVENT, onEvent as EventListener)
    }
  })
  onBeforeUnmount(() => {
    if (import.meta.client) {
      window.removeEventListener(LABEL_CATALOG_UPDATED_EVENT, onEvent as EventListener)
    }
  })
}

function remapSelectedLabels<T extends { id: number; name?: string; color?: string; color_index?: number }>(
  labels: T[] | undefined,
  catalog: LabelCategoryItem[],
): T[] | undefined {
  if (!labels) {
    return labels
  }
  const byId = new Map(catalog.map(label => [label.id, label]))
  let changed = false
  const next: T[] = []
  for (const label of labels) {
    const catalogLabel = byId.get(label.id)
    if (!catalogLabel) {
      changed = true
      continue
    }
    if (
      label.name !== catalogLabel.name
      || label.color !== catalogLabel.color
      || label.color_index !== catalogLabel.color_index
    ) {
      changed = true
      next.push({
        ...label,
        name: catalogLabel.name,
        color: catalogLabel.color,
        color_index: catalogLabel.color_index,
      })
      continue
    }
    next.push(label)
  }
  return changed ? next : labels
}

function patchTaskLabelCaches (orgSlug: string, categories: LabelCategoryGroup[]): void {
  const labels = flattenLabelCategories(categories)
  const prefix = `${orgSlug}:`
  for (const [key, snapshot] of getWorkspaceBoardCacheMap()) {
    if (!key.startsWith(prefix)) {
      continue
    }
    snapshot.orgLabels = labels
    snapshot.orgLabelCategories = categories
    snapshot.tasks = snapshot.tasks.map((task) => {
      const nextLabels = remapSelectedLabels(task.labels, labels)
      return nextLabels === task.labels ? task : { ...task, labels: nextLabels }
    })
  }
  for (const [key, snapshot] of getWorkspaceWbsCacheMap()) {
    if (!key.startsWith(prefix)) {
      continue
    }
    snapshot.orgLabels = labels
    snapshot.orgLabelCategories = categories
    snapshot.tasks = snapshot.tasks.map((task) => {
      const nextLabels = remapSelectedLabels(task.labels, labels)
      return nextLabels === task.labels ? task : { ...task, labels: nextLabels }
    })
  }
}

function patchWorkspaceLabelCaches (
  orgSlug: string,
  categories: LabelCategoryGroup[],
): void {
  const labels = flattenLabelCategories(categories)
  const keySnapshot = getOrgWorkspaceIndexCacheMap().get(orgSlug)
  if (!keySnapshot) {
    return
  }
  keySnapshot.orgLabels = labels
  keySnapshot.orgLabelCategories = categories
  keySnapshot.workspaces = keySnapshot.workspaces.map((workspace) => {
    const nextLabels = remapSelectedLabels(workspace.labels, labels)
    return nextLabels === workspace.labels ? workspace : { ...workspace, labels: nextLabels }
  })
  notifyOrgWorkspaceIndexCacheChanged()
}

function applyLabelCatalog (
  ctx: OrganizationRealtimeContext,
  kind: 'task' | 'workspace',
  raw: unknown,
): void {
  if (!Array.isArray(raw)) {
    return
  }
  const categories = kind === 'workspace'
    ? normalizeLabelCategories(raw as LabelCategoryGroup[])
    : normalizeLabelCategories(raw as LabelCategoryGroup[])
  const settingsCategories = normalizeSettingsLabelCategories(raw as SettingsLabelCategory[])
  ctx.settings.patchLabelCategoriesCache(ctx.orgSlug, kind, settingsCategories)
  if (kind === 'task') {
    patchTaskLabelCaches(ctx.orgSlug, categories)
  } else {
    patchWorkspaceLabelCaches(ctx.orgSlug, categories)
  }
  dispatchLabelCatalog({
    orgSlug: ctx.orgSlug,
    kind,
    categories,
  })
}

function workspaceFromPayload (value: unknown): WorkspacePayload | null {
  const record = asRecord(value)
  const id = asNumber(record?.id)
  if (!record || id == null || typeof record.name !== 'string') {
    return null
  }
  return record as WorkspacePayload
}

function mergeWorkspace (existing: OrgWorkspaceItem | null, incoming: WorkspacePayload): OrgWorkspaceItem {
  if (!existing) {
    return {
      ...incoming,
      documents: incoming.documents ?? [],
      pinned: incoming.pinned ?? false,
      pinned_at: incoming.pinned_at ?? null,
    }
  }
  return {
    ...existing,
    ...incoming,
    pinned: existing.pinned,
    pinned_at: existing.pinned_at,
    documents: existing.documents,
  }
}

function leaveWorkspaceIfOpen (ctx: OrganizationRealtimeContext, workspaceId: number): void {
  const routeWorkspaceId = String(ctx.route.params.id ?? '')
  const routeSlug = String(ctx.route.params.slug ?? '')
  if (routeSlug !== ctx.orgSlug || routeWorkspaceId !== String(workspaceId)) {
    return
  }
  if (!ctx.route.path.includes('/workspaces/')) {
    return
  }
  void navigateTo(`/org/${ctx.orgSlug}/workspaces`)
}

function applyWorkspaceUpsert (ctx: OrganizationRealtimeContext, incoming: WorkspacePayload): void {
  const existing = ctx.index.getWorkspaceFromListCache(ctx.orgSlug, incoming.id)
  ctx.index.upsertCachedWorkspace(ctx.orgSlug, mergeWorkspace(existing, incoming))
}

function applyWorkspaceArchived (ctx: OrganizationRealtimeContext, workspace: WorkspacePayload): void {
  const existing = ctx.index.getWorkspaceFromListCache(ctx.orgSlug, workspace.id) ?? workspace
  ctx.archived.upsertCachedItem(
    { orgSlug: ctx.orgSlug, resource: 'workspaces' },
    {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description ?? existing.description ?? null,
      status: workspace.status ?? existing.status ?? null,
      labels: resolveLabelColors(workspace.labels?.length ? workspace.labels : (existing.labels ?? [])),
      archived_at: workspace.archived_at ?? new Date().toISOString(),
    },
  )
  ctx.index.removeCachedWorkspace(ctx.orgSlug, workspace.id)
  invalidateWorkspaceViewCaches(ctx.orgSlug, workspace.id)
  leaveWorkspaceIfOpen(ctx, workspace.id)
}

function applyWorkspaceUnarchived (ctx: OrganizationRealtimeContext, workspace: WorkspacePayload): void {
  ctx.archived.removeCachedItem({ orgSlug: ctx.orgSlug, resource: 'workspaces' }, workspace.id)
  applyWorkspaceUpsert(ctx, { ...workspace, archived_at: null })
}

function applySettings (
  ctx: OrganizationRealtimeContext,
  settings: Record<string, unknown>,
  statusDiff: NameDiff,
  categoryDiff: NameDiff,
): void {
  ctx.settings.patchOrgSettingsCache(ctx.orgSlug, settings as never)
  const statuses = resolveStandardColors(
    Array.isArray(settings.default_workspace_status_names)
      ? settings.default_workspace_status_names as OrgWorkspaceStatus[]
      : [],
  )
  const categories = resolveStandardColors(
    Array.isArray(settings.default_document_category_names)
      ? settings.default_document_category_names as Array<{ name: string; color_index: number }>
      : [],
  )
  const cached = getOrgWorkspaceIndexCacheMap().get(ctx.orgSlug)
  if (cached) {
    cached.workspaceStatuses = statuses
    cached.workspaces = cached.workspaces.map((workspace) => {
      const nextName = renamedName(workspace.status?.name, statusDiff)
      const match = nextName ? statuses.find(item => item.name === nextName) ?? null : null
      let documents = workspace.documents
      if (documents?.length) {
        documents = documents.map((document) => {
          const categoryName = renamedName(document.category?.name, categoryDiff)
          const category = categoryName
            ? categories.find(item => item.name === categoryName) ?? null
            : null
          return { ...document, category }
        })
      }
      return { ...workspace, status: match, documents }
    })
    notifyOrgWorkspaceIndexCacheChanged()
  }
  remapCachedDocumentCategories(ctx.orgSlug, categoryDiff, categories)
  if (typeof settings.name === 'string' || 'icon_url' in settings) {
    window.dispatchEvent(new CustomEvent('tm:org-updated', {
      detail: {
        slug: ctx.orgSlug,
        ...(typeof settings.name === 'string' ? { name: settings.name } : {}),
        ...('icon_url' in settings ? { icon_url: settings.icon_url ?? null } : {}),
      },
    }))
  }
}

function upsertSettingsMember (ctx: OrganizationRealtimeContext, member: SettingsOrgMember): void {
  const cached = ctx.settings.getCached(ctx.orgSlug)
  if (!cached?.members) {
    return
  }
  const members = cached.members.some(item => item.id === member.id)
    ? cached.members.map(item => item.id === member.id ? { ...item, ...member } : item)
    : [...cached.members, member]
  ctx.settings.patchMembersCache(ctx.orgSlug, members)
  const snapshot = getOrgWorkspaceIndexCacheMap().get(ctx.orgSlug)
  if (!snapshot) {
    return
  }
  const orgMember = {
    id: member.id,
    name: member.name,
    email: member.email,
    avatar_url: member.avatar_url ?? null,
  }
  snapshot.orgMembers = snapshot.orgMembers.some(item => item.id === member.id)
    ? snapshot.orgMembers.map(item => item.id === member.id ? { ...item, ...orgMember } : item)
    : [...snapshot.orgMembers, orgMember]
  notifyOrgWorkspaceIndexCacheChanged()
}

function applyMemberRemoved (ctx: OrganizationRealtimeContext, memberId: number): void {
  const cached = ctx.settings.getCached(ctx.orgSlug)
  if (cached?.members) {
    ctx.settings.patchMembersCache(
      ctx.orgSlug,
      cached.members.filter(member => member.id !== memberId),
    )
  }
  const affected = ctx.index.removeOrgMemberFromAllCachedWorkspaces(ctx.orgSlug, memberId)
  for (const workspaceId of affected) {
    dispatchWorkspaceMembersUpdated({
      orgSlug: ctx.orgSlug,
      workspaceId,
      members: ctx.index.getWorkspaceFromListCache(ctx.orgSlug, workspaceId)?.assignees ?? [],
      removedMemberIds: [memberId],
    })
  }
  if (ctx.sessionUserId !== memberId) {
    return
  }
  const organizations = ctx.organizations.filter(org => org.slug !== ctx.orgSlug)
  ctx.patchSessionUser({
    organizations,
    last_organization_id: organizations[0]?.id ?? null,
  })
  const next = organizations[0]
  void navigateTo(next ? `/org/${next.slug}/workspaces` : '/organizations/new')
}

function remainingOrganizationId (organizations: NonNullable<AuthUser['organizations']>): number | null {
  return organizations.reduce<number | null>((smallest, org) => {
    if (smallest == null || org.id < smallest) {
      return org.id
    }
    return smallest
  }, null)
}

/** 削除された組織を開いている画面を、残りの所属か組織作成へ移す。 */
async function applyOrganizationDeleted (
  ctx: OrganizationRealtimeContext,
  data: Record<string, unknown>,
): Promise<void> {
  const slug = typeof data.slug === 'string' ? data.slug.trim() : ''
  if (!slug || slug !== ctx.orgSlug.trim()) {
    return
  }

  ctx.settings.invalidateCached(slug)
  invalidateOrgDerivedCaches(slug)
  beginForcedAppNavigation()
  try {
    const fresh = await ctx.fetchSession({ force: true })
    let user = fresh.user ?? null
    if (user?.organizations?.some(org => org.slug === slug)) {
      const organizations = user.organizations.filter(org => org.slug !== slug)
      const lastStillValid = organizations.some(org => org.id === user?.last_organization_id)
      const lastOrganizationId = lastStillValid
        ? user.last_organization_id ?? null
        : remainingOrganizationId(organizations)
      user = {
        ...user,
        organizations,
        last_organization_id: lastOrganizationId,
      }
      ctx.patchSessionUser({
        organizations,
        last_organization_id: lastOrganizationId,
      })
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('tm:org-deleted', { detail: { slug } }))
    }
    const path = await ctx.resolvePostLoginPath(user)
    await navigateTo(path, { replace: true })
  } finally {
    endForcedAppNavigation()
  }
}

function applyMemberUpserted (ctx: OrganizationRealtimeContext, member: SettingsOrgMember): void {
  upsertSettingsMember(ctx, member)
  if (ctx.sessionUserId !== member.id || !member.role) {
    return
  }
  ctx.patchSessionUser({
    organizations: ctx.organizations.map(org => (
      org.slug === ctx.orgSlug ? { ...org, role: member.role ?? org.role } : org
    )),
  })
}

function upsertInvite (ctx: OrganizationRealtimeContext, invite: SettingsPendingInvite): void {
  const cached = ctx.settings.getCached(ctx.orgSlug)
  if (!cached) {
    return
  }
  const pendingInvites = cached.pendingInvites.some(item => item.id === invite.id)
    ? cached.pendingInvites.map(item => item.id === invite.id ? { ...item, ...invite } : item)
    : [invite, ...cached.pendingInvites]
  ctx.settings.patchMembersCache(ctx.orgSlug, cached.members, pendingInvites)
}

function removeInvite (ctx: OrganizationRealtimeContext, inviteId: number): void {
  const cached = ctx.settings.getCached(ctx.orgSlug)
  if (!cached) {
    return
  }
  ctx.settings.patchMembersCache(
    ctx.orgSlug,
    cached.members,
    cached.pendingInvites.filter(invite => invite.id !== inviteId),
  )
}

export function applyOrganizationRealtime (
  payload: unknown,
  ctx: OrganizationRealtimeContext,
): void {
  const data = asRecord(payload)
  const type = typeof data?.type === 'string' ? data.type : ''
  if (!data || !ctx.orgSlug) {
    return
  }

  if (type === 'workspace.created' || type === 'workspace.updated') {
    const workspace = workspaceFromPayload(data.workspace)
    if (workspace) {
      applyWorkspaceUpsert(ctx, workspace)
    }
    return
  }
  if (type === 'workspace.archived') {
    const workspace = workspaceFromPayload(data.workspace)
    if (workspace) {
      applyWorkspaceArchived(ctx, workspace)
    }
    return
  }
  if (type === 'workspace.unarchived') {
    const workspace = workspaceFromPayload(data.workspace)
    if (workspace) {
      applyWorkspaceUnarchived(ctx, workspace)
    }
    return
  }
  if (type === 'workspace.deleted') {
    const id = asNumber(data.id)
    if (id == null) {
      return
    }
    ctx.archived.removeCachedItem({ orgSlug: ctx.orgSlug, resource: 'workspaces' }, id)
    ctx.index.removeCachedWorkspace(ctx.orgSlug, id)
    invalidateWorkspaceViewCaches(ctx.orgSlug, id)
    leaveWorkspaceIfOpen(ctx, id)
    return
  }
  if (type === 'workspace.pinned') {
    const userId = asNumber(data.user_id)
    const workspaceId = asNumber(data.workspace_id)
    if (userId == null || workspaceId == null || userId !== ctx.sessionUserId) {
      return
    }
    ctx.index.patchCachedWorkspace(ctx.orgSlug, workspaceId, workspace => ({
      ...workspace,
      pinned: data.pinned === true,
      pinned_at: typeof data.pinned_at === 'string' ? data.pinned_at : null,
    }))
    return
  }
  if (type === 'document.created') {
    const document = asRecord(data.document)
    if (document && asNumber(document.id) != null) {
      applyDocumentCreated(ctx.orgSlug, document as never)
    }
    return
  }
  if (type === 'document.updated') {
    const document = asRecord(data.document)
    if (document && asNumber(document.id) != null) {
      applyDocumentUpdated(ctx.orgSlug, document as never)
    }
    return
  }
  if (type === 'document.archived') {
    const document = asRecord(data.document)
    if (document && asNumber(document.id) != null) {
      applyDocumentArchived(ctx.orgSlug, document as never)
      const routeDocumentId = String(ctx.route.params.documentId ?? '')
      if (routeDocumentId === String(document.id)) {
        const workspaceId = String(ctx.route.params.id ?? document.workspace_id ?? '')
        beginForcedAppNavigation()
        void navigateTo(workspaceId
          ? `/org/${ctx.orgSlug}/workspaces/${workspaceId}`
          : `/org/${ctx.orgSlug}/workspaces`).finally(() => {
          endForcedAppNavigation()
        })
      }
    }
    return
  }
  if (type === 'document.restored') {
    const document = asRecord(data.document)
    if (document && asNumber(document.id) != null) {
      applyDocumentRestored(ctx.orgSlug, document as never)
    }
    return
  }
  if (type === 'document.deleted') {
    const id = asNumber(data.id)
    if (id == null) {
      return
    }
    applyDocumentPermanentlyDeleted(ctx.orgSlug, id, asNumber(data.workspace_id))
    if (String(ctx.route.params.documentId ?? '') === String(id)) {
      const workspaceId = String(ctx.route.params.id ?? data.workspace_id ?? '')
      void navigateTo(workspaceId
        ? `/org/${ctx.orgSlug}/workspaces/${workspaceId}`
        : `/org/${ctx.orgSlug}/workspaces`)
    }
    return
  }
  if (type === 'settings.updated') {
    const settings = asRecord(data.settings)
    if (settings) {
      applySettings(
        ctx,
        settings,
        (asRecord(data.status_diff) ?? {}) as NameDiff,
        (asRecord(data.category_diff) ?? {}) as NameDiff,
      )
    }
    return
  }
  if (type === 'icon.updated') {
    ctx.settings.patchOrgSettingsCache(ctx.orgSlug, { icon_url: data.icon_url ?? null } as never)
    window.dispatchEvent(new CustomEvent('tm:org-updated', {
      detail: { slug: ctx.orgSlug, icon_url: data.icon_url ?? null },
    }))
    return
  }
  if (type === 'member.upserted') {
    const member = asRecord(data.member)
    const id = asNumber(member?.id)
    if (member && id != null && typeof member.email === 'string') {
      applyMemberUpserted(ctx, {
        id,
        name: typeof member.name === 'string' ? member.name : '',
        email: member.email,
        role: typeof member.role === 'string' ? member.role : null,
        avatar_url: typeof member.avatar_url === 'string' ? member.avatar_url : null,
      })
    }
    return
  }
  if (type === 'member.removed') {
    const id = asNumber(data.id)
    if (id != null) {
      applyMemberRemoved(ctx, id)
    }
    return
  }
  if (type === 'invite.upserted') {
    const invite = asRecord(data.invite)
    const id = asNumber(invite?.id)
    if (invite && id != null && typeof invite.email === 'string') {
      upsertInvite(ctx, {
        id,
        email: invite.email,
        role: typeof invite.role === 'string' ? invite.role : null,
        expires_at: typeof invite.expires_at === 'string' ? invite.expires_at : '',
      })
    }
    return
  }
  if (type === 'invite.removed') {
    const id = asNumber(data.id)
    if (id != null) {
      removeInvite(ctx, id)
    }
    return
  }
  if (type === 'task_labels.updated' || type === 'workspace_labels.updated') {
    applyLabelCatalog(
      ctx,
      type === 'task_labels.updated' ? 'task' : 'workspace',
      data.categories,
    )
    return
  }
  if (type === 'organization.deleted') {
    void applyOrganizationDeleted(ctx, data)
    return
  }
  if (type === 'user.profile_updated') {
    const user = asRecord(data.user)
    const id = asNumber(user?.id)
    if (!user || id == null) {
      return
    }
    const detail = {
      id,
      ...(typeof user.name === 'string' ? { name: user.name } : {}),
      ...('avatar_url' in user ? { avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : null } : {}),
    }
    dispatchUserProfileUpdated(detail)
    const cached = ctx.settings.getCached(ctx.orgSlug)
    if (cached?.members) {
      ctx.settings.patchMembersCache(ctx.orgSlug, cached.members.map(member => (
        member.id === id
          ? {
              ...member,
              ...(detail.name !== undefined ? { name: detail.name } : {}),
              ...('avatar_url' in detail ? { avatar_url: detail.avatar_url ?? null } : {}),
            }
          : member
      )))
    }
    if (ctx.sessionUserId === id) {
      ctx.patchSessionUser({
        ...(detail.name !== undefined ? { name: detail.name } : {}),
        ...('avatar_url' in detail ? { avatar_url: detail.avatar_url ?? null } : {}),
      })
    }
  }
}
