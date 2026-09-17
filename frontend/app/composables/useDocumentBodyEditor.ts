import type { MaybeRefOrGetter, Ref } from 'vue'
import { DOCUMENT_BODY_MAX_LENGTH } from '../constants/fieldLengthLimits'
import { useApi } from './useApi'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
} from './useOrgDocumentsPageData'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'

/** 旧・複数ページ保存分を単一本文へ戻すための区切り */
const LEGACY_DOCUMENT_PAGE_BREAK = '\n\n<!--wm-page-break-->\n\n'

function normalizeDocumentBodyText (body: string | null | undefined): string {
  if (body == null || body === '') {
    return ''
  }
  return body.split(LEGACY_DOCUMENT_PAGE_BREAK).join('\n\n')
}

/**
 * 資料本文の表示・編集・保存と未保存離脱ガード。
 */
export function useDocumentBodyEditor (options: {
  orgSlug: MaybeRefOrGetter<string>
  document: Ref<OrgDocument | null>
  onDocumentUpdated: (updated: OrgDocument) => void
}) {
  const { api } = useApi()
  const { upsertDocumentCached } = useOrgDocumentsPageData()

  const bodySaving = ref(false)
  const bodyEditing = ref(false)
  const bodyDraft = ref('')
  const bodySaveError = ref<string | null>(null)
  const bodyInputRef = ref<HTMLTextAreaElement | null>(null)
  const bodyScrollerRef = ref<HTMLElement | null>(null)

  const bodyCharCountNearLimit = computed(() => (
    bodyDraft.value.length >= Math.floor(DOCUMENT_BODY_MAX_LENGTH * 0.9)
  ))
  const bodyCharCountLabel = computed(() => {
    const current = bodyDraft.value.length.toLocaleString('ja-JP')
    const max = DOCUMENT_BODY_MAX_LENGTH.toLocaleString('ja-JP')
    return `${current} / ${max}`
  })

  const displayBodyText = computed(() => {
    if (bodyEditing.value) {
      return bodyDraft.value
    }
    return normalizeDocumentBodyText(options.document.value?.body)
  })
  const hasBodyContent = computed(() => displayBodyText.value.trim() !== '')

  async function startBodyEdit () {
    if (!options.document.value || bodySaving.value) {
      return
    }
    bodyEditing.value = true
    bodyDraft.value = normalizeDocumentBodyText(options.document.value.body)
    bodySaveError.value = null
    await nextTick()
    const scroller = resolveBodyScroller()
    const lockedScrollTop = scroller?.scrollTop ?? 0
    const unlock = lockBodyScroller(scroller, lockedScrollTop)
    adjustBodyHeight()
    restoreBodyScroller(scroller, lockedScrollTop)
    const input = bodyInputRef.value
    if (input) {
      input.focus({ preventScroll: true })
      const caret = input.value.length
      input.setSelectionRange(caret, caret)
    }
    requestAnimationFrame(() => {
      restoreBodyScroller(scroller, lockedScrollTop)
      unlock()
    })
  }

  function onBodyInput () {
    adjustBodyHeight()
    requestAnimationFrame(() => {
      ensureBodyCaretVisible()
    })
  }

  function resolveBodyScroller (): HTMLElement | null {
    return bodyScrollerRef.value
  }

  function restoreBodyScroller (scroller: HTMLElement | null, scrollTop: number) {
    if (!scroller) {
      return
    }
    scroller.scrollTop = scrollTop
  }

  function lockBodyScroller (scroller: HTMLElement | null, scrollTop: number): () => void {
    if (!scroller) {
      return () => {}
    }
    const onScroll = () => {
      scroller.scrollTop = scrollTop
    }
    scroller.addEventListener('scroll', onScroll)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      scroller.scrollTop = scrollTop
    }
  }

  /** textarea 内キャレットの top / height（コンテンツ左上基準）を測る */
  function measureTextareaCaretOffset (textarea: HTMLTextAreaElement): { top: number; height: number } {
    const style = getComputedStyle(textarea)
    const mirror = document.createElement('div')
    const marker = document.createElement('span')
    mirror.setAttribute('aria-hidden', 'true')
    Object.assign(mirror.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      boxSizing: style.boxSizing,
      width: `${textarea.clientWidth}px`,
      padding: style.padding,
      border: style.border,
      font: style.font,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      lineHeight: style.lineHeight,
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflowWrap: style.overflowWrap,
      tabSize: style.tabSize,
    })
    const value = textarea.value
    const caretIndex = textarea.selectionEnd
    mirror.textContent = value.slice(0, caretIndex)
    marker.textContent = value.slice(caretIndex, caretIndex + 1) || '.'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)
    const top = marker.offsetTop
    const height = marker.offsetHeight || Number.parseFloat(style.lineHeight) || 24
    mirror.remove()
    return { top, height }
  }

  /** 入力中の行がビューア内に見えるようスクロールする */
  function ensureBodyCaretVisible () {
    const el = bodyInputRef.value
    const scroller = resolveBodyScroller()
    if (!el || !scroller) {
      return
    }
    const { top: caretOffsetTop, height: caretHeight } = measureTextareaCaretOffset(el)
    const scrollerRect = scroller.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const caretTop = scroller.scrollTop + (elRect.top - scrollerRect.top) + caretOffsetTop
    const caretBottom = caretTop + caretHeight
    const marginTop = 24
    // 入力行の下に、フッター・余白・白い枠の下端＋キャンバスの一部が見える余白を確保
    const page = el.closest('.document-viewer__page') as HTMLElement | null
    const footer = page?.querySelector('.document-viewer__page-footer') as HTMLElement | null
    const textareaPadBottom = Number.parseFloat(getComputedStyle(el).paddingBottom || '0')
    const footerMarginTop = footer
      ? Number.parseFloat(getComputedStyle(footer).marginTop || '0')
      : 0
    const framePeek = 28
    const marginBottom = textareaPadBottom
      + (footer?.offsetHeight ?? 0)
      + footerMarginTop
      + framePeek
    const viewTop = scroller.scrollTop + marginTop
    const viewBottom = scroller.scrollTop + scroller.clientHeight - marginBottom
    if (caretBottom > viewBottom) {
      scroller.scrollTop += caretBottom - viewBottom
    } else if (caretTop < viewTop) {
      scroller.scrollTop = Math.max(0, scroller.scrollTop - (viewTop - caretTop))
    }
  }

  function adjustBodyHeight () {
    const el = bodyInputRef.value
    if (!el) {
      return
    }
    const scroller = resolveBodyScroller()
    const lockedScrollTop = scroller?.scrollTop ?? 0
    const page = el.closest('.document-viewer__page') as HTMLElement | null

    // いったん縮めて本文実高さを測る
    el.style.flex = 'none'
    el.style.height = '1px'
    const contentHeight = el.scrollHeight

    // ビューアに収まる高さ（これ以上だとスクロールバーが出る）
    let fitHeight = contentHeight
    if (scroller && page) {
      const scrollerBody = scroller.querySelector('.document-viewer__scroller-body') as HTMLElement | null
      const padSource = scrollerBody ?? scroller
      const padStyle = getComputedStyle(padSource)
      const pageStyle = getComputedStyle(page)
      const scrollerPadY = Number.parseFloat(padStyle.paddingTop || '0')
        + Number.parseFloat(padStyle.paddingBottom || '0')
      const pagePadY = Number.parseFloat(pageStyle.paddingTop || '0')
        + Number.parseFloat(pageStyle.paddingBottom || '0')
      const pageBorderY = Number.parseFloat(pageStyle.borderTopWidth || '0')
        + Number.parseFloat(pageStyle.borderBottomWidth || '0')
      const heading = page.querySelector('.document-viewer__heading') as HTMLElement | null
      const footer = page.querySelector('.document-viewer__page-footer') as HTMLElement | null
      const headingMarginBottom = heading
        ? Number.parseFloat(getComputedStyle(heading).marginBottom || '0')
        : 0
      const footerMarginTop = footer
        ? Number.parseFloat(getComputedStyle(footer).marginTop || '0')
        : 0
      const chromeY = (heading?.offsetHeight ?? 0)
        + headingMarginBottom
        + (footer?.offsetHeight ?? 0)
        + footerMarginTop
      fitHeight = Math.max(
        0,
        Math.floor(
          scroller.clientHeight - scrollerPadY - pagePadY - pageBorderY - chromeY,
        ),
      )
    }

    el.style.height = `${Math.max(contentHeight, fitHeight)}px`
    restoreBodyScroller(scroller, lockedScrollTop)
  }

  function cancelBodyEdit () {
    if (bodySaving.value) {
      return
    }
    bodyEditing.value = false
    bodyDraft.value = ''
    bodySaveError.value = null
  }

  /** 画面離脱時など: 未保存の本文編集を破棄して表示モードへ戻す */
  function discardBodyEditOnLeave () {
    if (!bodyEditing.value) {
      bodyDraft.value = ''
      bodySaveError.value = null
      return
    }
    bodyEditing.value = false
    bodyDraft.value = ''
    bodySaveError.value = null
  }

  const bodyHasUnsavedChanges = computed(() => {
    if (!bodyEditing.value || !options.document.value) {
      return false
    }
    if (bodySaving.value) {
      return true
    }
    const normalized = bodyDraft.value.trim() === '' ? null : bodyDraft.value
    const previous = normalizeDocumentBodyText(options.document.value.body)
    const previousNormalized = previous.trim() === '' ? null : previous
    return (normalized ?? '') !== (previousNormalized ?? '')
  })

  async function confirmBodyEdit (): Promise<boolean> {
    if (!options.document.value || bodySaving.value || !bodyEditing.value) {
      return false
    }
    const normalized = bodyDraft.value.trim() === '' ? null : bodyDraft.value
    const previous = normalizeDocumentBodyText(options.document.value.body)
    const previousNormalized = previous.trim() === '' ? null : previous
    if ((normalized ?? '') === (previousNormalized ?? '')) {
      cancelBodyEdit()
      return true
    }
    bodySaving.value = true
    bodySaveError.value = null
    try {
      const slug = toValue(options.orgSlug)
      const updated = await api<OrgDocument>(
        `/orgs/${slug}/documents/${options.document.value.id}`,
        { method: 'PATCH', body: { body: normalized } },
      )
      options.onDocumentUpdated(updated)
      upsertDocumentCached(slug, updated)
      bodyEditing.value = false
      bodyDraft.value = ''
      return true
    } catch (e: unknown) {
      bodySaveError.value = e instanceof Error ? e.message : '資料本文の更新に失敗しました'
      return false
    } finally {
      bodySaving.value = false
    }
  }

  const {
    leaveModalOpen,
    leaveDiscarding,
    confirmDiscardAndLeave,
  } = useUnsavedChangesGuard({
    isDirty: () => bodyHasUnsavedChanges.value,
    onDiscard: () => {
      discardBodyEditOnLeave()
    },
  })

  return {
    DOCUMENT_BODY_MAX_LENGTH,
    bodySaving,
    bodyEditing,
    bodyDraft,
    bodySaveError,
    bodyInputRef,
    bodyScrollerRef,
    bodyCharCountNearLimit,
    bodyCharCountLabel,
    displayBodyText,
    hasBodyContent,
    bodyHasUnsavedChanges,
    startBodyEdit,
    cancelBodyEdit,
    confirmBodyEdit,
    onBodyInput,
    adjustBodyHeight,
    discardBodyEditOnLeave,
    leaveModalOpen,
    leaveDiscarding,
    confirmDiscardAndLeave,
  }
}
