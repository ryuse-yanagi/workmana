declare module '#shared/color-presets.json' {
  const value: {
    gridColumns: number
    presets: string[]
    defaultPresetIndex: number
    standardPresetIndices: number[]
    ganttBarSequencePresetIndices: number[]
    standardSurfaceBackgrounds: string[]
    legacyPresets: string[]
    legacyStandardHex: string[]
  }
  export default value
}

declare module '#shared/field-length-limits.json' {
  const value: {
    USER_NAME: number
    EMAIL: number
    PASSWORD: number
    ORGANIZATION_NAME: number
    ORGANIZATION_SLUG: number
    TASK_TITLE: number
    LABEL_NAME: number
    LABEL_CATEGORY_NAME: number
    LIST_NAME: number
    WORKSPACE_NAME: number
    DOCUMENT_NAME: number
    DOCUMENT_BODY: number
    CHECKLIST_TITLE: number
    WORKSPACE_STATUS_NAME: number
    DOCUMENT_CATEGORY_NAME: number
    CHECKLIST_ITEM_TEXT: number
    TASK_DESCRIPTION: number
    REQUIRED_TEXT_MIN: number
    PASSWORD_MIN: number
    COMMENT_BODY: number
    DEFAULT_NAMED_ITEM_NAME: number
    MEMBER_GROUP_NAME: number
  }
  export default value
}

declare module '#shared/default-named-color-items.json' {
  type NamedColorItem = { name: string, color_index: number }
  const value: {
    maxItems: number
    boardLists: NamedColorItem[]
    workspaceStatuses: NamedColorItem[]
    documentCategories: NamedColorItem[]
  }
  export default value
}
