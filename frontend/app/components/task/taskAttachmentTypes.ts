export type TaskAttachmentItem = {
  id: number
  task_id: number
  original_name: string
  mime_type: string | null
  size_bytes: number
  uploaded_by: number
  created_at: string
}

export type TaskAttachmentsByTaskId = Record<string, TaskAttachmentItem[]>
