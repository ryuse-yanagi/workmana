/**
 * ボードリスト列のヒット判定・座標幾何（カード DnD / リスト列 DnD 共通）。
 */
export function useBoardListColumnGeometry () {
  function getBoardListColumns (): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>('.board-lists-sortable .list-column[data-list-key]'),
    )
  }

  function findListColumnByKey (listKey: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.list-column[data-list-key="${listKey}"]`)
  }

  /**
   * 隣接列の境界中点で列を決める（nearest / empty-insert による左右のちらつきを防ぐ）。
   * 列間ギャップも必ずどちらか一方の列に属する。
   */
  function getListKeyAtClientX (clientX: number): string | null {
    const columns = getBoardListColumns()
    if (!columns.length) {
      return null
    }
    for (let i = 0; i < columns.length - 1; i++) {
      const leftCol = columns[i]
      const rightCol = columns[i + 1]
      if (!leftCol || !rightCol) {
        continue
      }
      const leftRect = leftCol.getBoundingClientRect()
      const rightRect = rightCol.getBoundingClientRect()
      const boundary = (leftRect.right + rightRect.left) / 2
      if (clientX < boundary) {
        return leftCol.dataset.listKey ?? null
      }
    }
    const lastCol = columns[columns.length - 1]
    return lastCol?.dataset.listKey ?? null
  }

  /** 列の水平ヒット範囲（列幅＋隣接ギャップの半分） */
  function getListColumnHitBounds (
    columns: HTMLElement[],
    index: number,
  ): { left: number, right: number } | null {
    const col = columns[index]
    if (!col) {
      return null
    }
    const rect = col.getBoundingClientRect()
    let left = rect.left
    let right = rect.right
    const prev = columns[index - 1]
    if (prev) {
      const prevRect = prev.getBoundingClientRect()
      left = (prevRect.right + rect.left) / 2
    }
    const next = columns[index + 1]
    if (next) {
      const nextRect = next.getBoundingClientRect()
      right = (rect.right + nextRect.left) / 2
    }
    return { left, right }
  }

  return {
    getBoardListColumns,
    findListColumnByKey,
    getListKeyAtClientX,
    getListColumnHitBounds,
  }
}
