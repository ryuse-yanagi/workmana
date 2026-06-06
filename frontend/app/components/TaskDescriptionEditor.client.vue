<template>
  <div
    class="task-description-editor"
    :class="{
      'task-description-editor--focused': isFocused,
      'task-description-editor--disabled': disabled,
    }"
  >
    <div v-if="editor" class="task-description-editor__toolbar" role="toolbar" aria-label="備考の書式">
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
          <div v-if="openMenu === 'heading'" class="task-description-editor__menu">
            <button
              v-for="item in headingOptions"
              :key="item.id"
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': item.active() }"
              @mousedown.prevent
              @click="item.run(); closeMenus()"
            >
              <component :is="item.icon" :size="14" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </button>
          </div>
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
          <div v-if="openMenu === 'more'" class="task-description-editor__menu">
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('strike') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleStrike().run(); closeMenus()"
            >
              <Strikethrough :size="14" aria-hidden="true" />
              <span>取り消し線</span>
            </button>
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('underline') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleUnderline().run(); closeMenus()"
            >
              <UnderlineIcon :size="14" aria-hidden="true" />
              <span>下線</span>
            </button>
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('code') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleCode().run(); closeMenus()"
            >
              <Code :size="14" aria-hidden="true" />
              <span>インラインコード</span>
            </button>
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('blockquote') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleBlockquote().run(); closeMenus()"
            >
              <TextQuote :size="14" aria-hidden="true" />
              <span>引用</span>
            </button>
            <button
              type="button"
              class="task-description-editor__menu-item"
              @mousedown.prevent
              @click="editor.chain().focus().setHorizontalRule().run(); closeMenus()"
            >
              <SeparatorHorizontal :size="14" aria-hidden="true" />
              <span>区切り線</span>
            </button>
          </div>
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
          <div v-if="openMenu === 'list'" class="task-description-editor__menu">
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('bulletList') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleBulletList().run(); closeMenus()"
            >
              <List :size="14" aria-hidden="true" />
              <span>箇条書き</span>
            </button>
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('orderedList') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleOrderedList().run(); closeMenus()"
            >
              <ListOrdered :size="14" aria-hidden="true" />
              <span>番号付きリスト</span>
            </button>
            <button
              type="button"
              class="task-description-editor__menu-item"
              :class="{ 'is-active': editor.isActive('taskList') }"
              @mousedown.prevent
              @click="editor.chain().focus().toggleTaskList().run(); closeMenus()"
            >
              <ListChecks :size="14" aria-hidden="true" />
              <span>チェックリスト</span>
            </button>
          </div>
        </div>
      </div>

      <span class="task-description-editor__sep" aria-hidden="true" />

      <div class="task-description-editor__group">
        <button
          type="button"
          class="task-description-editor__btn"
          :class="{ 'is-active': editor.isActive('link') }"
          :disabled="disabled"
          title="リンク"
          @mousedown.prevent
          @click="toggleLink"
        >
          <Link2 :size="16" aria-hidden="true" />
        </button>
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
          <div v-if="openMenu === 'help'" class="task-description-editor__menu task-description-editor__menu--help">
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
          </div>
        </div>
      </div>
    </div>

    <EditorContent :editor="editor" class="task-description-editor__content" />
  </div>
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
  placeholder: '入力中に Markdown ショートカットも使えます。* でリスト、# で見出し、--- で区切り線。',
  disabled: false,
  maxlength: 10000,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  blur: []
}>()

const isFocused = ref(false)
const openMenu = ref<'heading' | 'list' | 'more' | 'help' | null>(null)
const headingMenuRef = ref<HTMLElement | null>(null)
const listMenuRef = ref<HTMLElement | null>(null)
const moreMenuRef = ref<HTMLElement | null>(null)
const helpMenuRef = ref<HTMLElement | null>(null)
const syncingExternal = ref(false)

const editor = useEditor({
  content: props.modelValue,
  contentType: 'markdown',
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      horizontalRule: false,
    }),
    HorizontalRule,
    UnderlineExtension,
    Link.configure({
      openOnClick: false,
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
})

watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled)
})

function toggleMenu (menu: typeof openMenu.value) {
  openMenu.value = openMenu.value === menu ? null : menu
}

function closeMenus () {
  openMenu.value = null
}

function toggleLink () {
  const ed = editor.value
  if (!ed) {
    return
  }
  if (ed.isActive('link')) {
    ed.chain().focus().unsetLink().run()
    return
  }
  const previous = ed.getAttributes('link').href as string | undefined
  const url = window.prompt('リンク URL を入力', previous ?? 'https://')
  if (url === null) {
    return
  }
  const trimmed = url.trim()
  if (trimmed === '') {
    ed.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  ed.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
}

function onDocumentClick (event: MouseEvent) {
  if (openMenu.value === null) {
    return
  }
  const target = event.target as Node
  const refs = [headingMenuRef, listMenuRef, moreMenuRef, helpMenuRef]
  if (refs.some(ref => ref.value?.contains(target))) {
    return
  }
  closeMenus()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  editor.value?.destroy()
})
</script>

<style lang="scss" scoped>
.task-description-editor {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  background: mixin.$white;
  overflow: hidden;
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

.task-description-editor__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  min-width: 9rem;
  padding: 0.25rem;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  background: mixin.$white;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);

  &--help {
    right: 0;
    left: auto;
    min-width: 15rem;
    padding: 0.65rem 0.75rem;
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

.task-description-editor__content {
  min-height: 6rem;
  max-height: 18rem;
  overflow-y: auto;
}

:deep(.task-description-editor__prose) {
  min-height: 6rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.94rem;
  line-height: 1.6;
  color: mixin.$text;
  outline: none;

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
</style>
