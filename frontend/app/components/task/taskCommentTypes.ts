export type TaskCommentAuthor = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
export type TaskCommentReaction = {
  emoji: string
  count: number
  reacted_by_me: boolean
  users: TaskCommentAuthor[]
}
export type TaskDetailComment = {
  id: number
  author_id: number
  author: TaskCommentAuthor | null
  body: string
  created_at: string
  updated_at: string
  edited: boolean
  reactions: TaskCommentReaction[]
}
export type TaskCommentsByTaskId = Record<string, TaskDetailComment[]>
