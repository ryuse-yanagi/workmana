import type { WbsTask } from '../composables/useWbsTaskGroups'

/** 編集モード中の並び替えスナップショット（Realtime / Actions / EditSession で共有） */
export type WbsReorderSnapshot = {
  tasks: WbsTask[]
  collapsedParentIds: Set<number>
}
