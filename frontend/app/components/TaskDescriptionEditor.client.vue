<template>
  <div
    class="task-description-editor"
    :class="{
      'task-description-editor--editing': isEditing,
      'task-description-editor--focused': isFocused,
      'task-description-editor--hovered': isHovered,
      'task-description-editor--disabled': disabled,
      'task-description-editor--empty': isContentEmpty,
    }"
    @mouseenter="isHovered = true"
    @mouseleave="onMouseLeave"
  >
    <div
      v-if="editor && isEditing && (isHovered || isFocused || openMenu !== null)"
      class="task-description-editor__toolbar"
      role="toolbar"
      aria-label="備考の書式"
      @mousedown.prevent="onToolbarMouseDown"
    >
      <div class="task-description-editor__group">
        <div ref="headingMenuRef" class="task-description-editor__dropdown">
          <button
            type="button"
            class="task-description-editor__btn task-description-editor__btn--combo"
            :disabled="disabled"
            title="テキストスタイル"
            @mousedown.prevent
            @click="toggleMenu('heading')"
          >
            <component :is="headingIcon" :size="16" aria-hidden="true" />
            <ChevronDown :size="12" aria-hidden="true" class="task-description-editor__chevron" />
          </button>
        </div>

        <button
          type="button"
          class="task-description-editor__btn"
          :class="{ 'is-active': editor.isActive('bold') }"
          :disabled="disabled"
          title="太字 (Ctrl+B)"
          @mousedown.prevent
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Bold :size="TOOLBAR_ICON_SIZE" :stroke-width="TOOLBAR_ICON_STROKE" class="task-description-editor__toolbar-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="task-description-editor__btn"
          :class="{ 'is-active': editor.isActive('italic') }"
          :disabled="disabled"
          title="斜体 (Ctrl+I)"
          @mousedown.prevent
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Italic :size="TOOLBAR_ICON_SIZE" :stroke-width="TOOLBAR_ICON_STROKE" class="task-description-editor__toolbar-icon" aria-hidden="true" />
        </button>

        <div ref="moreMenuRef" class="task-description-editor__dropdown">
          <button
            type="button"
            class="task-description-editor__btn"
            :disabled="disabled"
            title="その他の書式"
            @mousedown.prevent
            @click="toggleMenu('more')"
          >
            <Ellipsis :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>

      <span class="task-description-editor__sep" aria-hidden="true" />

      <div class="task-description-editor__group">
        <div ref="listMenuRef" class="task-description-editor__dropdown">
          <button
            type="button"
            class="task-description-editor__btn task-description-editor__btn--combo"
            :class="{ 'is-active': editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList') }"
            :disabled="disabled"
            title="リスト"
            @mousedown.prevent
            @click="toggleMenu('list')"
          >
            <List :size="16" aria-hidden="true" />
            <ChevronDown :size="12" aria-hidden="true" class="task-description-editor__chevron" />
          </button>
        </div>
      </div>

      <span class="task-description-editor__sep" aria-hidden="true" />

      <div class="task-description-editor__group">
        <div ref="linkMenuRef" class="task-description-editor__dropdown">
          <button
            type="button"
            class="task-description-editor__btn task-description-editor__btn--link"
            :disabled="disabled"
            title="リンク"
            @mousedown.prevent
            @click="toggleMenu('link')"
          >
            <Link2 :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="task-description-editor__spacer" />

      <div class="task-description-editor__group task-description-editor__group--end">
        <span class="task-description-editor__md-badge" title="Markdown 対応">M↓</span>
        <div ref="helpMenuRef" class="task-description-editor__dropdown">
          <button
            type="button"
            class="task-description-editor__btn"
            :disabled="disabled"
            title="Markdown ショートカット"
            @mousedown.prevent
            @click="toggleMenu('help')"
          >
            <CircleQuestionMark :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <button
      v-if="!isEditing && isContentEmpty"
      type="button"
      class="task-description-editor__view-placeholder"
      :disabled="disabled"
      @click="activateEditing"
    >
      {{ placeholder }}
    </button>
    <div
      v-else
      class="task-description-editor__content"
      @click="onContentClick"
    >
      <EditorContent :editor="editor" class="task-description-editor__content-inner" />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="openMenu !== null && editor"
      ref="menuPanelRef"
      class="task-description-editor__menu-portal"
      :class="`task-description-editor__menu-portal--${openMenu}`"
      :style="menuPanelStyle"
      @mousedown="onMenuPanelMouseDown"
    >
      <template v-if="openMenu === 'heading'">
        <button
          v-for="item in headingOptions"
          :key="item.id"
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': item.active() }"
          @click="item.run(); closeMenus()"
        >
          <component :is="item.icon" :size="14" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </template>

      <template v-else-if="openMenu === 'more'">
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('strike') }"
          @click="editor.chain().focus().toggleStrike().run(); closeMenus()"
        >
          <Strikethrough :size="14" aria-hidden="true" />
          <span>取り消し線</span>
        </button>
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('underline') }"
          @click="editor.chain().focus().toggleUnderline().run(); closeMenus()"
        >
          <UnderlineIcon :size="14" aria-hidden="true" />
          <span>下線</span>
        </button>
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('code') }"
          @click="editor.chain().focus().toggleCode().run(); closeMenus()"
        >
          <Code :size="14" aria-hidden="true" />
          <span>インラインコード</span>
        </button>
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('blockquote') }"
          @click="editor.chain().focus().toggleBlockquote().run(); closeMenus()"
        >
          <TextQuote :size="14" aria-hidden="true" />
          <span>引用</span>
        </button>
        <button
          type="button"
          class="task-description-editor__menu-item"
          @click="editor.chain().focus().setHorizontalRule().run(); closeMenus()"
        >
          <SeparatorHorizontal :size="14" aria-hidden="true" />
          <span>区切り線</span>
        </button>
      </template>

      <template v-else-if="openMenu === 'list'">
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('bulletList') }"
          @click="editor.chain().focus().toggleBulletList().run(); closeMenus()"
        >
          <List :size="14" aria-hidden="true" />
          <span>箇条書き</span>
        </button>
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('orderedList') }"
          @click="editor.chain().focus().toggleOrderedList().run(); closeMenus()"
        >
          <ListOrdered :size="14" aria-hidden="true" />
          <span>番号付きリスト</span>
        </button>
        <button
          type="button"
          class="task-description-editor__menu-item"
          :class="{ 'is-active': editor.isActive('taskList') }"
          @click="editor.chain().focus().toggleTaskList().run(); closeMenus()"
        >
          <ListChecks :size="14" aria-hidden="true" />
          <span>チェックリスト</span>
        </button>
      </template>

      <template v-else-if="openMenu === 'help'">
        <p class="task-description-editor__help-title">Markdown ショートカット</p>
        <ul class="task-description-editor__help-list">
          <li><code>#</code> 見出し1 / <code>##</code> 見出し2</li>
          <li><code>**太字**</code> / <code>*斜体*</code></li>
          <li><code>-</code> または <code>*</code> 箇条書き</li>
          <li><code>1.</code> 番号付きリスト</li>
          <li><code>- [ ]</code> チェックリスト</li>
          <li><code>&gt;</code> 引用 / <code>---</code> 区切り線</li>
          <li><code>[表示名](URL)</code> リンク</li>
        </ul>
      </template>

      <form
        v-else-if="openMenu === 'link'"
        class="task-description-editor__link-form"
        @submit.prevent="insertLink"
      >
        <label class="task-description-editor__link-field">
          <span class="task-description-editor__link-label">
            リンク<span class="task-description-editor__link-required" aria-hidden="true">*</span>
          </span>
          <input
            ref="linkUrlInputRef"
            v-model.trim="linkUrlDraft"
            type="text"
            class="task-description-editor__link-input"
            placeholder="リンクを貼り付けてください"
            required
            inputmode="url"
            autocomplete="url"
          />
        </label>
        <label class="task-description-editor__link-field">
          <span class="task-description-editor__link-label">表示名（任意）</span>
          <input
            v-model.trim="linkTextDraft"
            type="text"
            class="task-description-editor__link-input"
            placeholder="表示名を入力してください"
          />
          <span class="task-description-editor__link-hint">リンクのタイトルや説明を入力できます</span>
        </label>
        <div class="task-description-editor__link-actions">
          <button type="button" class="task-description-editor__link-cancel" @click="closeMenus">
            キャンセル
          </button>
          <button
            type="submit"
            class="task-description-editor__link-submit"
            :disabled="!linkUrlDraft.trim()"
          >
            追加
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import UnderlineExtension from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { Markdown } from '@tiptap/markdown'
import {
  Bold,
  ChevronDown,
  CircleQuestionMark,
  Code,
  Ellipsis,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  SeparatorHorizontal,
  Strikethrough,
  TextQuote,
  Type,
  Underline as UnderlineIcon,
} from 'lucide-vue-next'

const TOOLBAR_ICON_SIZE = 16
const TOOLBAR_ICON_STROKE = 2.5

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  maxlength?: number
}>(), {
  placeholder: '備考を入力してください',
  disabled: false,
  maxlength: 10000,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  blur: []
}>()

const isFocused = ref(false)
const isEditing = ref(false)
const isHovered = ref(false)
type MenuId = 'heading' | 'list' | 'more' | 'help' | 'link'
const openMenu = ref<MenuId | null>(null)
const headingMenuRef = ref<HTMLElement | null>(null)
const listMenuRef = ref<HTMLElement | null>(null)
const moreMenuRef = ref<HTMLElement | null>(null)
const helpMenuRef = ref<HTMLElement | null>(null)
const linkMenuRef = ref<HTMLElement | null>(null)
const menuPanelRef = ref<HTMLElement | null>(null)
const menuPanelStyle = ref<Record<string, string>>({})
const linkUrlInputRef = ref<HTMLInputElement | null>(null)
const linkUrlDraft = ref('')
const linkTextDraft = ref('')
const syncingExternal = ref(false)

const isContentEmpty = computed(() => props.modelValue.trim() === '')

const editor = useEditor({
  content: props.modelValue,
  contentType: 'markdown',
  editable: false,
  extensions: [
    StarterKit.configure({
      horizontalRule: false,
    }),
    HorizontalRule,
    UnderlineExtension,
    Link.configure({
      openOnClick: true,
      autolink: true,
      defaultProtocol: 'https',
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Markdown,
  ],
  editorProps: {
    attributes: {
      class: 'task-description-editor__prose',
    },
    handleDOMEvents: {
      click: (_view, event) => openViewModeLink(event),
    },
  },
  onUpdate: ({ editor: ed }) => {
    if (syncingExternal.value) {
      return
    }
    let markdown = ed.getMarkdown()
    if (markdown.length > props.maxlength) {
      markdown = markdown.slice(0, props.maxlength)
      syncingExternal.value = true
      ed.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false })
      syncingExternal.value = false
    }
    emit('update:modelValue', markdown)
  },
  onFocus: () => {
    isFocused.value = true
  },
  onBlur: () => {
    isFocused.value = false
    if (openMenu.value !== null) {
      return
    }
    isEditing.value = false
    editor.value?.setEditable(false)
    closeMenus()
    emit('blur')
  },
})

const headingOptions = computed(() => {
  const ed = editor.value
  if (!ed) {
    return []
  }
  return [
    {
      id: 'paragraph',
      label: '通常テキスト',
      icon: Type,
      active: () => ed.isActive('paragraph'),
      run: () => ed.chain().focus().setParagraph().run(),
    },
    {
      id: 'h1',
      label: '見出し 1',
      icon: Heading1,
      active: () => ed.isActive('heading', { level: 1 }),
      run: () => ed.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      label: '見出し 2',
      icon: Heading2,
      active: () => ed.isActive('heading', { level: 2 }),
      run: () => ed.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      label: '見出し 3',
      icon: Heading3,
      active: () => ed.isActive('heading', { level: 3 }),
      run: () => ed.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ]
})

const headingIcon = computed(() => {
  const ed = editor.value
  if (!ed) {
    return Type
  }
  if (ed.isActive('heading', { level: 1 })) {
    return Heading1
  }
  if (ed.isActive('heading', { level: 2 })) {
    return Heading2
  }
  if (ed.isActive('heading', { level: 3 })) {
    return Heading3
  }
  return Type
})

watch(() => props.modelValue, (value) => {
  const ed = editor.value
  if (!ed || ed.isDestroyed) {
    return
  }
  const current = ed.getMarkdown()
  if (value === current) {
    return
  }
  syncingExternal.value = true
  ed.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  syncingExternal.value = false
  if (!isFocused.value) {
    isEditing.value = false
    ed.setEditable(false)
  }
})

watch(() => props.disabled, (disabled) => {
  if (disabled) {
    isEditing.value = false
    isHovered.value = false
    closeMenus()
  }
  editor.value?.setEditable(isEditing.value && !disabled)
})

function onToolbarMouseDown () {
  editor.value?.commands.focus()
}

function openViewModeLink (event: Event): boolean {
  if (isEditing.value) {
    return false
  }
  const anchor = (event.target as HTMLElement).closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false
  }
  const mouseEvent = event as MouseEvent
  if (mouseEvent.button !== 0 || mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey) {
    return false
  }
  event.preventDefault()
  window.open(anchor.href, '_blank', 'noopener,noreferrer')
  return true
}

function activateEditing () {
  if (props.disabled || isEditing.value) {
    return
  }
  isEditing.value = true
  editor.value?.setEditable(true)
  nextTick(() => editor.value?.commands.focus('end'))
}

function onContentClick (event: MouseEvent) {
  if (openViewModeLink(event)) {
    return
  }
  if (!isEditing.value) {
    activateEditing()
  }
}

function onMouseLeave () {
  isHovered.value = false
}

function getMenuAnchor (menu: MenuId): HTMLElement | null {
  const refs: Record<MenuId, typeof headingMenuRef> = {
    heading: headingMenuRef,
    list: listMenuRef,
    more: moreMenuRef,
    help: helpMenuRef,
    link: linkMenuRef,
  }
  const container = refs[menu].value
  if (!container) {
    return null
  }
  return container.querySelector('button')
}

function updateMenuPosition () {
  const menu = openMenu.value
  if (!menu) {
    return
  }
  const anchor = getMenuAnchor(menu)
  const panel = menuPanelRef.value
  if (!anchor || !panel) {
    return
  }

  const gap = 4
  const pad = 8
  const anchorRect = anchor.getBoundingClientRect()
  const panelWidth = panel.offsetWidth || (menu === 'link' ? 18 : menu === 'help' ? 15 : 9) * 16
  let left = menu === 'help' ? anchorRect.right - panelWidth : anchorRect.left

  if (left + panelWidth > window.innerWidth - pad) {
    left = window.innerWidth - pad - panelWidth
  }
  if (left < pad) {
    left = pad
  }

  let top = anchorRect.bottom + gap
  const panelHeight = panel.offsetHeight || 120
  if (top + panelHeight > window.innerHeight - pad) {
    top = Math.max(pad, anchorRect.top - gap - panelHeight)
  }

  menuPanelStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    zIndex: '100',
  }
}

function initLinkForm () {
  linkUrlDraft.value = ''
  linkTextDraft.value = ''
}

function normalizeLinkUrl (raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }
  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

function insertLink () {
  const ed = editor.value
  if (!ed) {
    return
  }
  const href = normalizeLinkUrl(linkUrlDraft.value)
  if (!href) {
    return
  }

  const displayText = linkTextDraft.value.trim() || href
  const { from, to, empty } = ed.state.selection
  const selectedText = empty ? '' : ed.state.doc.textBetween(from, to, ' ')
  const linkMark = {
    type: 'link',
    attrs: {
      href,
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    },
  }

  if (!empty && selectedText && (!linkTextDraft.value.trim() || linkTextDraft.value.trim() === selectedText)) {
    ed.chain().focus().extendMarkRange('link').setLink({ href }).run()
  } else if (!empty && linkTextDraft.value.trim() && linkTextDraft.value.trim() !== selectedText) {
    ed.chain().focus().deleteSelection().insertContent({
      type: 'text',
      text: displayText,
      marks: [linkMark],
    }).run()
  } else if (!empty && selectedText) {
    ed.chain().focus().setLink({ href }).run()
  } else {
    ed.chain().focus().insertContent({
      type: 'text',
      text: displayText,
      marks: [linkMark],
    }).run()
  }

  closeMenus()
}

function onMenuPanelMouseDown (event: MouseEvent) {
  if (openMenu.value === 'link') {
    return
  }
  event.preventDefault()
  editor.value?.commands.focus()
}

function toggleMenu (menu: MenuId) {
  if (openMenu.value === menu) {
    closeMenus()
    return
  }
  if (menu === 'link') {
    initLinkForm()
  }
  openMenu.value = menu
  nextTick(() => {
    updateMenuPosition()
    requestAnimationFrame(() => updateMenuPosition())
    if (menu === 'link') {
      linkUrlInputRef.value?.focus()
    }
  })
}

function closeMenus () {
  const shouldRefocus = isEditing.value
  openMenu.value = null
  menuPanelStyle.value = {}
  linkUrlDraft.value = ''
  linkTextDraft.value = ''
  if (shouldRefocus) {
    nextTick(() => editor.value?.commands.focus())
  }
}

function onDocumentClick (event: MouseEvent) {
  if (openMenu.value === null) {
    return
  }
  const target = event.target as Node
  const anchorRefs = [headingMenuRef, listMenuRef, moreMenuRef, helpMenuRef, linkMenuRef]
  if (anchorRefs.some(ref => ref.value?.contains(target))) {
    return
  }
  if (menuPanelRef.value?.contains(target)) {
    return
  }
  closeMenus()
}

function onWindowRelayout () {
  if (openMenu.value === null) {
    return
  }
  updateMenuPosition()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
  window.addEventListener('resize', onWindowRelayout)
  window.addEventListener('scroll', onWindowRelayout, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  window.removeEventListener('resize', onWindowRelayout)
  window.removeEventListener('scroll', onWindowRelayout, true)
  editor.value?.destroy()
})
</script>

<style lang="scss" scoped>
.task-description-editor {
  @include mixin.input-border-default;
  border-radius: 8px;
  background: mixin.$white;
  overflow: visible;
  transition: border-color 0.15s ease;

  &--focused {
    border-color: mixin.$focus;
  }

  &--disabled {
    opacity: 0.65;
    pointer-events: none;
  }
}

.task-description-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.45rem;
  border-bottom: 1px solid mixin.$border-light;
  background: #f8fafc;
  flex-wrap: wrap;
}

.task-description-editor__group {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;

  &--end {
    gap: 0.35rem;
  }
}

.task-description-editor__sep {
  width: 1px;
  height: 1.25rem;
  background: mixin.$border;
  margin: 0 0.2rem;
  flex-shrink: 0;
}

.task-description-editor__spacer {
  flex: 1;
  min-width: 0.5rem;
}

.task-description-editor__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.35rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: mixin.$text-sub;
  font-size: 0.82rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: mixin.$surface-muted;
    color: mixin.$text;
  }

  &.is-active {
    background: #dbeafe;
    color: mixin.$main;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &--combo {
    min-width: 2.35rem;
    padding-inline: 0.3rem;
  }

  &--link:hover:not(:disabled) {
    background: #dbeafe;
    color: mixin.$main;
  }
}

.task-description-editor__toolbar-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.task-description-editor__chevron {
  opacity: 0.65;
  flex-shrink: 0;
}

.task-description-editor__dropdown {
  position: relative;
}

.task-description-editor__menu-portal {
  box-sizing: border-box;
  min-width: 9rem;
  padding: 0.25rem;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  background: mixin.$white;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);

  &--help {
    min-width: 15rem;
    padding: 0.65rem 0.75rem;
  }

  &--link {
    width: min(18rem, calc(100vw - 1rem));
    padding: 0.75rem;
  }
}

.task-description-editor__link-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-description-editor__link-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.task-description-editor__link-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: mixin.$text-sub;
}

.task-description-editor__link-required {
  color: mixin.$danger;
  margin-left: 0.1rem;
}

.task-description-editor__link-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  font: inherit;
  font-size: 0.86rem;
  color: mixin.$text;
  background: mixin.$white;

  &::placeholder {
    color: #94a3b8;
  }

  &:focus {
    @include mixin.input-focus-ring;
  }
}

.task-description-editor__link-hint {
  font-size: 0.74rem;
  color: mixin.$text-muted;
  line-height: 1.4;
}

.task-description-editor__link-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.task-description-editor__link-cancel {
  border: none;
  background: transparent;
  padding: 0.35rem 0.55rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: mixin.$text-sub;
  cursor: pointer;

  &:hover {
    color: mixin.$text;
  }
}

.task-description-editor__link-submit {
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.85rem;
  font-size: 0.84rem;
  font-weight: 700;
  color: mixin.$white;
  background: mixin.$main;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.task-description-editor__menu-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: mixin.$text;
  font-size: 0.84rem;
  text-align: left;
  cursor: pointer;

  span {
    flex: 1;
  }

  &:hover,
  &.is-active {
    background: mixin.$surface-muted;
  }

  &.is-active {
    color: mixin.$main;
    font-weight: 700;
  }
}

.task-description-editor__md-badge {
  font-size: 0.72rem;
  font-weight: 800;
  color: mixin.$text-muted;
  letter-spacing: 0.02em;
  user-select: none;
}

.task-description-editor__help-title {
  margin: 0 0 0.45rem;
  font-size: 0.78rem;
  font-weight: 800;
  color: mixin.$text;
}

.task-description-editor__help-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.76rem;
  color: mixin.$text-sub;
  line-height: 1.55;

  code {
    font-size: 0.74rem;
    background: mixin.$surface-muted;
    padding: 0.05rem 0.25rem;
    border-radius: 4px;
  }
}

.task-description-editor__view-placeholder {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
  box-sizing: border-box;
  min-height: 6rem;
  margin: 0;
  padding: 0.65rem 0.75rem;
  border: none;
  background: transparent;
  color: #94a3b8;
  font: inherit;
  font-size: 0.94rem;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
}

.task-description-editor__content {
  min-height: 6rem;
  max-height: 18rem;
  overflow-y: auto;
}

.task-description-editor--editing :deep(.task-description-editor__prose) {
  cursor: text;
}

:deep(.task-description-editor__prose) {
  min-height: 6rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.94rem;
  line-height: 1.6;
  color: mixin.$text;
  outline: none;
  cursor: pointer;

  p {
    margin: 0 0 0.55rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  h1,
  h2,
  h3 {
    margin: 0.75rem 0 0.45rem;
    line-height: 1.35;
    font-weight: 800;
  }

  h1 { font-size: 1.35rem; }
  h2 { font-size: 1.15rem; }
  h3 { font-size: 1rem; }

  ul,
  ol {
    margin: 0.35rem 0 0.65rem;
    padding-left: 1.35rem;
  }

  li {
    margin: 0.15rem 0;
  }

  ul[data-type='taskList'] {
    list-style: none;
    padding-left: 0.2rem;

    li {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;

      label {
        margin-top: 0.15rem;
      }

      div {
        flex: 1;
      }
    }
  }

  blockquote {
    margin: 0.5rem 0;
    padding-left: 0.75rem;
    border-left: 3px solid mixin.$border;
    color: mixin.$text-sub;
  }

  hr {
    border: none;
    border-top: 1px solid mixin.$border;
    margin: 0.75rem 0;
  }

  code {
    font-size: 0.88em;
    background: mixin.$surface-muted;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
  }

  pre {
    margin: 0.5rem 0;
    padding: 0.65rem 0.75rem;
    border-radius: 6px;
    background: #0f172a;
    color: #e2e8f0;
    overflow-x: auto;

    code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
  }

  a {
    color: mixin.$main;
    text-decoration: underline;
  }

  p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #94a3b8;
    pointer-events: none;
    height: 0;
  }
}

.task-description-editor:not(.task-description-editor--editing) :deep(.task-description-editor__prose p.is-editor-empty:first-child::before) {
  content: none;
}
</style>
