<template>
  <aside
    v-if="workspace"
    class="workspace-sidebar"
  >
    <div class="workspace-sidebar__scroller">
      <div class="workspace-sidebar__body">
    <div class="workspace-sidebar__title-field">
      <h1
        class="workspace-sidebar__title"
        :aria-label="workspace.name"
      >
        {{ workspace.name }}
      </h1>
    </div>
    <div class="workspace-sidebar__description-field">
      <SidebarDescription
        :text="workspace.description"
        label="スペース説明"
      />
    </div>
    <section
      v-if="hasWorkspaceStatus"
      class="workspace-sidebar__field-section"
    >
      <h2 class="workspace-sidebar__related-heading">ステータス</h2>
      <div class="workspace-sidebar__status">
        <WorkspaceStatusSelect
          :status="workspace.status ?? null"
          :statuses="workspaceStatuses"
          readonly
        />
      </div>
    </section>
    <section
      v-if="workspaceLabels.length"
      class="workspace-sidebar__field-section"
    >
      <h2 class="workspace-sidebar__related-heading">ラベル</h2>
      <div class="workspace-sidebar__labels">
        <LabelStrip
          v-for="label in workspaceLabels"
          :key="label.id"
          :label="label"
          size="md"
        />
      </div>
    </section>
    <section
      v-if="workspaceAssignees.length"
      class="workspace-sidebar__field-section"
    >
      <h2 class="workspace-sidebar__related-heading">メンバー</h2>
      <div
        class="workspace-sidebar__assignees"
        aria-label="メンバー"
      >
        <MemberAvatar
          v-for="member in workspaceAssignees"
          :key="member.id"
          class="workspace-sidebar__assignee-avatar"
          :class="{
            'workspace-sidebar__assignee-avatar--active':
              memberDetailOpen && selectedMember?.id === member.id,
          }"
          :member="member"
          size="sm"
          interactive
          data-popover-trigger
          :title="memberDisplayName(member)"
          :aria-label="`${memberDisplayName(member)}の情報`"
          :aria-expanded="memberDetailOpen && selectedMember?.id === member.id"
          @click="openMemberDetail(member, $event)"
        />
      </div>
    </section>
    <section class="workspace-sidebar__field-section workspace-sidebar__documents-section">
      <div class="workspace-sidebar__documents-panel">
        <div class="workspace-sidebar__documents-toolbar">
          <h2 class="workspace-sidebar__documents-heading">資料</h2>
          <button
            type="button"
            class="workspace-sidebar__documents-add-btn"
            title="資料追加（D）"
            :disabled="documentAddPending"
            @click="void openDocumentAddModal()"
          >
            <NotebookPen
              :size="18"
              :stroke-width="2.25"
              aria-hidden="true"
            />
            資料追加
          </button>
        </div>
        <ul
          v-if="workspaceDocuments.length"
          class="workspace-sidebar__documents-list"
        >
          <li
            v-for="document in workspaceDocuments"
            :key="document.id"
            class="workspace-sidebar__documents-item"
          >
            <button
              type="button"
              class="workspace-sidebar__document-card"
              @pointerenter="prefetchDocumentDetail(document.id)"
              @focus="prefetchDocumentDetail(document.id)"
              @click="navigateToDocument(document.id)"
              @contextmenu.prevent="onDocumentCardContextMenu(document.id, $event)"
            >
              <span
                class="workspace-sidebar__document-icon"
                aria-hidden="true"
              >
                <FileText
                  :size="17"
                  :stroke-width="2"
                />
              </span>
              <span class="workspace-sidebar__document-body">
                <span class="workspace-sidebar__document-name">{{ document.name }}</span>
                <span
                  v-if="documentDescription(document)"
                  class="workspace-sidebar__document-desc"
                >{{ documentDescription(document) }}</span>
                <span
                  v-if="documentCategoryLabel(document)"
                  class="workspace-sidebar__document-category"
                >
                  <LabelStrip
                    :label="documentCategoryLabel(document)!"
                    :text-color="documentCategoryTextColor(document)"
                    size="sm"
                  />
                </span>
              </span>
              <div
                class="card-menu-wrap"
                :class="{ 'card-menu-wrap--open': openDocumentCardMenuId === document.id }"
                @click.stop
                @pointerdown.stop
                @mousedown.stop
              >
                <button
                  type="button"
                  class="card-menu-trigger"
                  data-popover-trigger
                  :aria-expanded="openDocumentCardMenuId === document.id"
                  aria-label="資料のメニュー"
                  @click="toggleDocumentCardMenu(document.id, $event)"
                >
                  <Ellipsis :size="20" :stroke-width="2.25" aria-hidden="true" />
                </button>
              </div>
            </button>
          </li>
        </ul>
        <div
          v-else
          class="workspace-sidebar__documents-empty"
        >
          <span
            class="workspace-sidebar__documents-empty-icon"
            aria-hidden="true"
          >
            <NotebookText
              :size="32"
              :stroke-width="1.75"
            />
          </span>
          <p class="workspace-sidebar__documents-empty-text">資料はありません</p>
        </div>
      </div>
    </section>
      </div>
    </div>
  </aside>
  <Teleport to="body">
    <DocumentFormModal
      ref="documentAddModalRef"
      v-model="documentAddModalOpen"
      :org-slug="orgSlug"
      :categories="documentFormCategories"
      :loading="documentAddPending"
      @submit="onDocumentAddSubmit"
    />
  </Teleport>
  <DocumentFormModal
    ref="documentDetailsModalRef"
    v-model="documentDetailsModalOpen"
    mode="details"
    title="資料詳細"
    :initial-values="documentDetailsInitialValues"
    :org-slug="orgSlug"
    :categories="documentCardFormCategories"
    :loading="documentMetaPending"
    @submit="onDocumentDetailsSubmit"
  />
  <ConfirmModal
    v-model="documentArchiveConfirmOpen"
    title="資料のアーカイブ確認"
    :message="archiveConfirmMessage"
    confirm-text="アーカイブ"
    variant="danger"
    :loading="archivePending"
    @confirm="confirmDocumentArchive"
  />
  <FloatingMenu
    :open="Boolean(openDocumentCardMenuId && documentCardMenuPosition)"
    density="compact"
    :style="documentCardMenuStyle"
    :items="documentCardMenuItems"
    @select="onDocumentCardMenuSelect"
    @close="closeDocumentCardMenu"
  />
  <Teleport to="body">
    <Transition name="popover-fade" @after-leave="onMemberDetailAfterLeave">
      <TaskMemberDetailPopover
        v-if="memberDetailOpen && selectedMember"
        ref="memberDetailPopoverRef"
        :style="memberDetailStyle"
        :show-remove="false"
        :display-name="memberDisplayName(selectedMember)"
        :email-line="memberEmailLine(selectedMember)"
        :initial="memberInitial(selectedMember)"
        :avatar-src="selectedMemberAvatarSrc"
        @close="closeMemberDetail"
        @avatar-error="onSelectedMemberAvatarError"
      />
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import {
  type OrgWorkspaceLabel,
} from '../../composables/workspace/useOrgWorkspaceIndexPageData'
import { useWorkspaceDetailMeta } from '../../composables/workspace/useWorkspaceDetailMeta'
import { useWorkspaceDocumentAdd } from '../../composables/document/useWorkspaceDocumentAdd'
import { useWorkspaceDocumentCardMenu } from '../../composables/document/useWorkspaceDocumentCardMenu'
import { workspaceDocumentPath } from '../../composables/workspace/useWorkspaceViewRoutes'
import { useOrgDocumentsPageData } from '../../composables/document/useOrgDocumentsPageData'
import { resolveAndSortLabels } from '../../composables/label/useLabelCategories'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { resolveStandardColors } from '../../utils/shared/colorPresetResolution'
import { memberDisplayName, memberInitial } from '../../composables/member/useMemberDisplay'
import { memberEmailLine, type TaskFormMember } from '../../composables/task/useTaskFormHelpers'
import { resolveDisplayAvatarUrl } from '../../composables/auth/userProfileUpdated'
import { resolveAvatarUrl } from '../../utils/member/resolveAvatarUrl'
import { useExclusivePopover } from '../../composables/ui/useExclusivePopover'
import {
  dismissPopoverFromOutsidePointer,
  isInsideFloatingPopover,
  isPopoverTriggerTarget,
} from '../../utils/ui/uiInteraction'
import {
  POPOVER_VIEWPORT_INSET,
  buildAnchoredPopoverStyle,
  computeAnchoredPopoverBelowLayout,
  popoverPositionVisibilityStyle,
  refineAnchoredPopoverWithFloatingUi,
  schedulePopoverOpenLayout,
} from '../../utils/ui/popoverScrollbar'
import LabelStrip from '../ui/LabelStrip.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import TaskMemberDetailPopover from '../task/popover/TaskMemberDetailPopover.vue'
import WorkspaceStatusSelect from './WorkspaceStatusSelect.vue'
import DocumentFormModal from '../modals/document/DocumentFormModal.vue'
import ConfirmModal from '../modals/shared/ConfirmModal.vue'
import FloatingMenu from '../ui/FloatingMenu.vue'
import { Ellipsis, FileText, NotebookPen, NotebookText } from 'lucide-vue-next'
import type { OrgWorkspaceDocumentItem } from '../../composables/workspace/useOrgWorkspaceIndexPageData'

const props = defineProps<{
  orgSlug: string
  workspaceId: string | number
}>()

const router = useRouter()
const config = useRuntimeConfig()
const { prefetchDocument } = useOrgDocumentsPageData()
const {
  workspace,
  workspaceStatuses,
  orgLabels,
  ensureLoaded,
} = useWorkspaceDetailMeta(() => props.orgSlug, () => props.workspaceId)
const {
  documentAddModalOpen,
  documentAddPending,
  documentAddModalRef,
  documentFormCategories,
  openDocumentAddModal,
  onDocumentAddSubmit,
} = useWorkspaceDocumentAdd(() => props.orgSlug, () => props.workspaceId)

const workspaceLabels = computed(() => {
  const labels = workspace.value?.labels
  if (!labels?.length) {
    return [] as OrgWorkspaceLabel[]
  }
  return resolveAndSortLabels(labels, orgLabels.value)
})

const workspaceAssignees = computed(() => workspace.value?.assignees ?? [])
const workspaceDocuments = computed(() => workspace.value?.documents ?? [])
const hasWorkspaceStatus = computed(() => Boolean(workspace.value?.status?.name?.trim()))

const MEMBER_DETAIL_PANEL_WIDTH = 238
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120

const memberDetailOpen = ref(false)
const selectedMember = ref<TaskFormMember | null>(null)
const memberDetailAnchorEl = ref<HTMLElement | null>(null)
const memberDetailPopoverRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const memberDetailStyle = ref<Record<string, string>>(popoverPositionVisibilityStyle(false))
const selectedMemberAvatarFailed = ref(false)
let removeMemberDetailResizeListener: (() => void) | null = null

const selectedMemberAvatarSrc = computed(() => {
  const member = selectedMember.value
  if (!member || selectedMemberAvatarFailed.value) {
    return null
  }
  return resolveAvatarUrl(
    resolveDisplayAvatarUrl(member),
    String(config.public.apiBaseUrl || '/api'),
  )
})

function closeMemberDetail () {
  memberDetailOpen.value = false
}

function onMemberDetailAfterLeave () {
  if (memberDetailOpen.value) {
    return
  }
  selectedMember.value = null
  memberDetailAnchorEl.value = null
  selectedMemberAvatarFailed.value = false
  memberDetailStyle.value = popoverPositionVisibilityStyle(false)
}

function onSelectedMemberAvatarError () {
  selectedMemberAvatarFailed.value = true
}

async function positionMemberDetail (visible = true) {
  const anchor = memberDetailAnchorEl.value
  const popover = memberDetailPopoverRef.value?.rootRef ?? null
  if (!anchor || !popover) {
    return
  }
  let layout = computeAnchoredPopoverBelowLayout(
    anchor.getBoundingClientRect(),
    MEMBER_DETAIL_PANEL_WIDTH,
    popover,
    {
      pad: POPOVER_VIEWPORT_INSET,
      gap: POPOVER_ANCHOR_GAP,
      minHeight: POPOVER_MIN_HEIGHT,
    },
  )
  if (visible) {
    layout = await refineAnchoredPopoverWithFloatingUi(anchor, popover, layout, {
      pad: POPOVER_VIEWPORT_INSET,
      gap: POPOVER_ANCHOR_GAP,
    })
  }
  memberDetailStyle.value = buildAnchoredPopoverStyle(layout, {
    zIndex: 'var(--tm-z-floating)',
    visible,
  })
}

function updateMemberDetailPosition () {
  const wasVisible = memberDetailStyle.value.visibility === 'visible'
  if (!wasVisible) {
    memberDetailStyle.value = popoverPositionVisibilityStyle(false)
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionMemberDetail(false),
        () => positionMemberDetail(true),
      )
    })
    return
  }
  nextTick(() => {
    requestAnimationFrame(() => positionMemberDetail(true))
  })
}

function openMemberDetail (member: TaskFormMember, event: Event) {
  const anchor = event.currentTarget
  if (!(anchor instanceof HTMLElement)) {
    return
  }
  if (memberDetailOpen.value && selectedMember.value?.id === member.id) {
    closeMemberDetail()
    return
  }
  selectedMember.value = member
  selectedMemberAvatarFailed.value = false
  memberDetailAnchorEl.value = anchor
  memberDetailOpen.value = true
  updateMemberDetailPosition()
}

function handleMemberDetailOutsidePointerUp (event: MouseEvent) {
  if (!memberDetailOpen.value || event.button !== 0) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }
  if (isInsideFloatingPopover(target)) {
    return
  }
  if (memberDetailPopoverRef.value?.rootRef?.contains(target)) {
    return
  }
  if (isPopoverTriggerTarget(target)) {
    return
  }
  if (memberDetailAnchorEl.value?.contains(target)) {
    return
  }
  dismissPopoverFromOutsidePointer(target, closeMemberDetail)
}

function onMemberDetailEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !memberDetailOpen.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  closeMemberDetail()
}

function bindMemberDetailListeners () {
  document.addEventListener('keydown', onMemberDetailEscape)
  document.addEventListener('mouseup', handleMemberDetailOutsidePointerUp, true)
  const onResize = () => updateMemberDetailPosition()
  window.addEventListener('resize', onResize)
  removeMemberDetailResizeListener = () => window.removeEventListener('resize', onResize)
}

function unbindMemberDetailListeners () {
  document.removeEventListener('keydown', onMemberDetailEscape)
  document.removeEventListener('mouseup', handleMemberDetailOutsidePointerUp, true)
  removeMemberDetailResizeListener?.()
  removeMemberDetailResizeListener = null
}

useExclusivePopover(memberDetailOpen, closeMemberDetail)

watch(memberDetailOpen, (open, wasOpen) => {
  if (open && !wasOpen) {
    bindMemberDetailListeners()
  }
  if (!open && wasOpen) {
    unbindMemberDetailListeners()
  }
})

onBeforeUnmount(() => {
  unbindMemberDetailListeners()
})

const {
  openDocumentCardMenuId,
  documentCardMenuPosition,
  documentCardMenuStyle,
  documentCardMenuItems,
  documentDetailsModalOpen,
  documentArchiveConfirmOpen,
  documentMetaPending,
  archivePending,
  documentFormCategories: documentCardFormCategories,
  documentDetailsModalRef,
  documentDetailsInitialValues,
  archiveConfirmMessage,
  toggleDocumentCardMenu,
  onDocumentCardContextMenu,
  closeDocumentCardMenu,
  onDocumentCardMenuSelect,
  onDocumentDetailsSubmit,
  confirmDocumentArchive,
} = useWorkspaceDocumentCardMenu(
  () => props.orgSlug,
  () => props.workspaceId,
  { documents: workspaceDocuments },
)

function prefetchDocumentDetail (documentId: number): void {
  if (!import.meta.client) {
    return
  }
  const path = workspaceDocumentPath(props.orgSlug, props.workspaceId, documentId)
  void preloadRouteComponents(path).catch(() => {})
  void prefetchDocument(props.orgSlug, documentId).catch(() => {})
}

/** 遷移前に資料本文とページを先読みする */
function navigateToDocument (documentId: number): void {
  prefetchDocumentDetail(documentId)
  void router.push(workspaceDocumentPath(props.orgSlug, props.workspaceId, documentId))
}

/** 説明の先頭行だけをサイドバーに出す */
function documentDescription (document: OrgWorkspaceDocumentItem): string | null {
  const firstLine = document.description?.split(/\r?\n/)[0]?.trim()
  return firstLine || null
}

function documentCategory (document: OrgWorkspaceDocumentItem) {
  return document.category ?? null
}

function documentCategoryLabel (document: OrgWorkspaceDocumentItem) {
  const category = documentCategory(document)
  if (!category?.name?.trim()) {
    return null
  }
  const resolved = resolveStandardColors([category])[0] ?? category
  if (!resolved.color) {
    return null
  }
  return {
    name: resolved.name ?? category.name,
    color: standardColorSurfaceBackground(resolved.color),
  }
}

function documentCategoryTextColor (document: OrgWorkspaceDocumentItem): string | undefined {
  const category = document.category
  if (!category?.name?.trim()) {
    return undefined
  }
  const resolved = resolveStandardColors([category])[0] ?? category
  if (!resolved.color) {
    return undefined
  }
  return standardColorEmphasisText(resolved.color)
}

defineExpose({
  documentAddModalOpen,
  openDocumentAddModal,
})

watch(
  () => [props.orgSlug, props.workspaceId] as const,
  () => {
    closeMemberDetail()
    void ensureLoaded()
  },
  { immediate: true },
)
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceDetailSidebar.scss"></style>
