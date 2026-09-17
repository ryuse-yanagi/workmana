import type { Component } from 'vue'
import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
} from 'lucide-vue-next'
import type { TaskAttachmentItem } from './taskAttachmentTypes'

export type AttachmentFileKind = 'image' | 'pdf' | 'sheet' | 'archive' | 'text' | 'file'

export function formatAttachmentSize (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentExtension (attachment: TaskAttachmentItem): string {
  const name = attachment.original_name || ''
  const idx = name.lastIndexOf('.')
  if (idx < 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

export function attachmentFileKind (attachment: TaskAttachmentItem): AttachmentFileKind {
  const mime = (attachment.mime_type || '').toLowerCase()
  const ext = attachmentExtension(attachment)
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) {
    return 'image'
  }
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (
    mime.includes('spreadsheet')
    || mime.includes('excel')
    || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  ) {
    return 'sheet'
  }
  if (
    mime.includes('zip')
    || mime.includes('compressed')
    || mime.includes('tar')
    || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return 'archive'
  }
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'log', 'doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return 'text'
  }
  return 'file'
}

export function attachmentFileIcon (attachment: TaskAttachmentItem): Component {
  switch (attachmentFileKind(attachment)) {
    case 'image':
      return FileImage
    case 'pdf':
    case 'text':
      return FileText
    case 'sheet':
      return FileSpreadsheet
    case 'archive':
      return FileArchive
    default:
      return File
  }
}

export function formatAttachmentDate (value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}
