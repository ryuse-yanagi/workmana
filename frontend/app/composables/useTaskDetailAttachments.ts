import type { Ref } from 'vue'
import type { TaskAttachmentItem } from '../components/task/taskAttachmentTypes'
import { useTaskDetailSectionCollapse } from './useTaskDetailSectionCollapse'
import { useApi } from './useApi'

type AttachmentsBlockExpose = {
  closeMenu?: () => void
} | null

/**
 * タスク詳細の添付ファイル API / セクション状態。
 */
export function useTaskDetailAttachments (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  taskId: MaybeRefOrGetter<number | null>
  saving: Ref<boolean>
  attachmentsBlockRef: Ref<AttachmentsBlockExpose>
  onAttachmentsUpdated?: (payload: {
    taskId: number
    attachments: TaskAttachmentItem[]
  }) => void
}) {
  const { api } = useApi()
  const attachments = ref<TaskAttachmentItem[]>([])
  const attachmentsLoading = ref(false)
  const attachmentsError = ref<string | null>(null)
  const attachmentsSectionVisible = ref(false)
  const attachmentUploading = ref(false)
  const attachmentDeletingId = ref<number | null>(null)
  const attachmentDownloadingId = ref<number | null>(null)
  const attachmentFileInputRef = ref<HTMLInputElement | null>(null)

  const attachmentsCollapseTarget = computed(() => {
    const taskId = toValue(options.taskId)
    return taskId == null
      ? null
      : { type: 'attachments' as const, taskId }
  })
  const {
    collapsed: attachmentsCollapsed,
    toggleCollapsed: toggleAttachmentsCollapsed,
  } = useTaskDetailSectionCollapse(attachmentsCollapseTarget)

  const showAttachmentsSection = computed(() => (
    attachments.value.length > 0
    || attachmentUploading.value
    || Boolean(attachmentsError.value)
  ))

  function closeAttachmentMenu () {
    options.attachmentsBlockRef.value?.closeMenu?.()
  }

  function openAttachmentFilePicker () {
    if (options.saving.value || attachmentUploading.value || toValue(options.taskId) === null) {
      return
    }
    attachmentFileInputRef.value?.click()
  }

  function emitAttachmentsUpdated () {
    const taskId = toValue(options.taskId)
    if (taskId === null) {
      return
    }
    options.onAttachmentsUpdated?.({
      taskId,
      attachments: [...attachments.value],
    })
  }

  async function downloadAttachment (attachment: TaskAttachmentItem) {
    const taskId = toValue(options.taskId)
    if (taskId === null || attachmentDownloadingId.value !== null) {
      return
    }
    attachmentDownloadingId.value = attachment.id
    attachmentsError.value = null
    try {
      const blob = await api<Blob>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${taskId}/attachments/${attachment.id}/download`,
        { responseType: 'blob' },
      )
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = attachment.original_name || `attachment-${attachment.id}`
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e: unknown) {
      attachmentsError.value = e instanceof Error ? e.message : 'ダウンロードに失敗しました'
    } finally {
      if (attachmentDownloadingId.value === attachment.id) {
        attachmentDownloadingId.value = null
      }
    }
  }

  async function loadAttachments () {
    const taskId = toValue(options.taskId)
    if (taskId === null) {
      attachments.value = []
      return
    }
    attachmentsLoading.value = true
    attachmentsError.value = null
    try {
      const res = await api<{ data: TaskAttachmentItem[] }>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${taskId}/attachments`,
      )
      attachments.value = res.data ?? []
      if (attachments.value.length > 0) {
        attachmentsSectionVisible.value = true
      }
    } catch (e: unknown) {
      attachmentsError.value = e instanceof Error ? e.message : '添付ファイルの読み込みに失敗しました'
      attachments.value = []
    } finally {
      attachmentsLoading.value = false
    }
  }

  function applyInitialAttachments (items: TaskAttachmentItem[]) {
    attachments.value = [...items]
    attachmentsLoading.value = false
    attachmentsError.value = null
    attachmentsSectionVisible.value = attachments.value.length > 0
  }

  async function onAttachmentFileSelected (event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    const taskId = toValue(options.taskId)
    if (!file || taskId === null || attachmentUploading.value) {
      return
    }
    attachmentsSectionVisible.value = true
    attachmentUploading.value = true
    attachmentsError.value = null
    try {
      const body = new FormData()
      body.append('file', file)
      const created = await api<TaskAttachmentItem>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${taskId}/attachments`,
        { method: 'POST', body },
      )
      attachments.value = [created, ...attachments.value]
      emitAttachmentsUpdated()
    } catch (e: unknown) {
      attachmentsError.value = e instanceof Error ? e.message : 'アップロードに失敗しました'
    } finally {
      attachmentUploading.value = false
    }
  }

  async function deleteAttachment (attachmentId: number) {
    const taskId = toValue(options.taskId)
    if (taskId === null || attachmentDeletingId.value !== null) {
      return
    }
    attachmentDeletingId.value = attachmentId
    attachmentsError.value = null
    try {
      await api(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${taskId}/attachments/${attachmentId}`,
        { method: 'DELETE' },
      )
      attachments.value = attachments.value.filter(item => item.id !== attachmentId)
      if (attachments.value.length === 0) {
        attachmentsSectionVisible.value = false
        attachmentsError.value = null
      }
      emitAttachmentsUpdated()
    } catch (e: unknown) {
      attachmentsError.value = e instanceof Error ? e.message : '削除に失敗しました'
    } finally {
      attachmentDeletingId.value = null
    }
  }

  function resetAttachments () {
    attachments.value = []
    attachmentsLoading.value = false
    attachmentsError.value = null
    attachmentsSectionVisible.value = false
    attachmentUploading.value = false
    attachmentDeletingId.value = null
    attachmentDownloadingId.value = null
    closeAttachmentMenu()
  }

  return {
    attachments,
    attachmentsLoading,
    attachmentsError,
    attachmentsSectionVisible,
    attachmentsCollapsed,
    toggleAttachmentsCollapsed,
    attachmentsBlockRef: options.attachmentsBlockRef,
    attachmentUploading,
    attachmentDeletingId,
    attachmentDownloadingId,
    attachmentFileInputRef,
    showAttachmentsSection,
    closeAttachmentMenu,
    openAttachmentFilePicker,
    downloadAttachment,
    loadAttachments,
    applyInitialAttachments,
    onAttachmentFileSelected,
    deleteAttachment,
    resetAttachments,
  }
}
