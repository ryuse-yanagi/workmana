<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="overlayRef"
      class="modal-overlay"
      :class="{ 'modal-overlay--popover-open': !!activePopover }"
      role="presentation"
      @mousedown="onOverlayMouseDown"
    >
        <section
          ref="modalCardRef"
          class="modal-card"
          :class="{ 'modal-card--navigating': isNavigatingFade }"
          role="dialog"
          aria-modal="true"
          aria-label="タスク詳細"
        >
          <header class="modal-header">
            <h3>タスク詳細</h3>
            <button
              type="button"
              class="icon-close"
              :disabled="saving"
              @click="close"
            >✕</button>
          </header>
          <div v-if="loading" class="modal-body modal-body--state">
            <p class="state-message">読み込み中...</p>
          </div>
          <div v-else-if="loadError" class="modal-body modal-body--state">
            <p class="err">{{ loadError }}</p>
            <div class="actions">
              <button type="button" class="ghost-btn" @click="close">閉じる</button>
              <button type="button" class="primary-btn" @click="reload">再試行</button>
            </div>
          </div>
          <div v-else class="modal-split">
            <div ref="modalBodyRef" class="modal-pane modal-pane--detail">
            <section class="field-block title-block">
              <div class="title-block-meta">
                <button
                  v-if="showParentTaskControl"
                  type="button"
                  class="task-detail-parent-task"
                  :class="{ 'task-detail-parent-task--placeholder': !task?.parent_task_id }"
                  :disabled="saving || parentTaskSaving"
                  @click="openParentTaskPicker($event)"
                >
                  {{ parentTaskButtonLabel }}
                </button>
                <button
                  v-if="showListBadge"
                  type="button"
                  class="task-detail-list-badge"
                  :class="{ 'task-detail-list-badge--placeholder': !currentListOption }"
                  :style="listBadgeStyle"
                  :disabled="saving || listSaving"
                  :aria-label="`リスト: ${listBadgeLabel}`"
                  @click="openListPicker($event)"
                >
                  {{ listBadgeLabel }}
                </button>
              </div>
              <div class="title-input-wrap">
                <textarea
                  ref="titleTextareaRef"
                  v-model.trim="titleDraft"
                  :maxlength="TASK_TITLE_MAX_LENGTH"
                  class="title-input"
                  aria-label="タスク名"
                  :disabled="saving || titleSaving"
                  rows="1"
                  @input="adjustTitleTextareaHeight"
                  @compositionstart="titleComposing = true"
                  @compositionend="titleComposing = false"
                  @blur="onTitleBlur"
                  @keydown.enter.prevent="onTitleEnter"
                  @keydown.escape.prevent.stop="revertTitleDraft"
                />
                <span
                  v-if="showTitlePlaceholder"
                  class="title-input-placeholder"
                  aria-hidden="true"
                >タスク名</span>
              </div>
            </section>
            <div ref="actionButtonsRef" class="action-buttons">
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'start-date' }"
                :disabled="saving"
                @click="openDatePicker('start', $event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <CalendarDays :size="16" :stroke-width="2.25" />
                </span>
                開始日
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'due-date' }"
                :disabled="saving"
                @click="openDatePicker('due', $event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <CalendarCheck :size="16" :stroke-width="2.25" />
                </span>
                終了日
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'effort' }"
                :disabled="saving || effortSaving"
                @click="openEffortPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <Clock :size="16" :stroke-width="2.25" />
                </span>
                工数
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'members' }"
                :disabled="saving"
                @click="openMemberPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <UserPlus :size="16" :stroke-width="2.25" />
                </span>
                担当者
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'labels' }"
                :disabled="saving"
                @click="openLabelPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <Tags :size="16" :stroke-width="2.25" />
                </span>
                ラベル
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'checklist-create' }"
                :disabled="saving"
                @click="openChecklistPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <ListChecks :size="16" :stroke-width="2.25" />
                </span>
                チェックリスト
              </button>
            </div>
            <div
              v-if="(task?.start_date || task?.due_date) || showEffortDetailSection"
              class="detail-meta-row detail-meta-row--schedule"
            >
              <section v-if="task?.start_date" class="detail-item detail-item--date">
                <span class="detail-item-label">開始日</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :disabled="saving"
                  @click="openDatePicker('start', $event)"
                >
                  {{ formatDateDisplay(task.start_date) }}
                </button>
              </section>
              <section v-if="task?.due_date" class="detail-item detail-item--date">
                <span class="detail-item-label">終了日</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :disabled="saving"
                  @click="openDatePicker('due', $event)"
                >
                  {{ formatDateDisplay(task.due_date) }}
                </button>
              </section>
              <section
                v-if="showEffortDetailSection"
                ref="effortDetailAnchorRef"
                class="detail-item detail-item--effort"
              >
                <span class="detail-item-label">工数</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :class="{ 'detail-value-btn--editing': activePopover === 'effort' }"
                  :disabled="saving || effortSaving"
                  :aria-live="activePopover === 'effort' ? 'polite' : undefined"
                  @click="openEffortPicker($event)"
                >
                  {{ effortDetailDisplayText }}
                </button>
              </section>
            </div>
            <div
              v-if="(task?.assignees ?? []).length || (task?.labels ?? []).length"
              class="detail-meta-row detail-meta-row--people"
            >
              <section
                v-if="(task?.assignees ?? []).length"
                class="detail-item detail-item--members"
              >
                <span class="detail-item-label">担当者</span>
                <div class="member-avatar-list detail-chip-wrap">
                  <button
                    v-for="member in task?.assignees ?? []"
                    :key="member.id"
                    type="button"
                    class="member-avatar-btn"
                    :disabled="saving"
                    :aria-label="memberDisplayName(member)"
                    @click="openMemberDetail(member, $event)"
                  >
                    <img
                      v-if="member.avatar_url"
                      :src="member.avatar_url"
                      alt=""
                      class="member-avatar-btn-image"
                    />
                    <span v-else class="member-avatar-btn-initial">{{ memberInitial(member) }}</span>
                  </button>
                  <button
                    type="button"
                    class="member-avatar-btn member-avatar-btn--add"
                    :disabled="saving"
                    aria-label="担当者を追加"
                    @click="openMemberPicker($event)"
                  >
                    <span class="member-avatar-btn-plus" aria-hidden="true">+</span>
                  </button>
                </div>
              </section>
              <section
                v-if="(task?.labels ?? []).length"
                class="detail-item detail-item--labels"
              >
                <span class="detail-item-label">ラベル</span>
                <div class="label-chip-list detail-chip-wrap">
                  <button
                    v-for="label in task?.labels"
                    :key="label.id"
                    type="button"
                    class="label-chip"
                    :style="{
                      backgroundColor: label.color,
                      color: labelBarTextColor(label.color),
                    }"
                    :disabled="saving"
                    :aria-label="`ラベル: ${label.name}`"
                    @click="openLabelPicker($event)"
                  >
                    {{ label.name }}
                  </button>
                  <button
                    type="button"
                    class="label-chip-add"
                    :disabled="saving"
                    aria-label="ラベルを追加"
                    @click="openLabelPicker($event)"
                  >
                    <span class="label-chip-add-plus" aria-hidden="true">+</span>
                  </button>
                </div>
              </section>
            </div>
            <section class="field-block description-block">
              <div class="description-block__header">
                <span class="field-label">説明</span>
                <div
                  class="description-mode-tabs"
                  role="tablist"
                  aria-label="説明の表示形式"
                >
                  <button
                    type="button"
                    class="description-mode-tab"
                    :class="{ 'description-mode-tab--active': descriptionViewMode === 'preview' }"
                    role="tab"
                    :aria-selected="descriptionViewMode === 'preview'"
                    :disabled="saving || descriptionSaving"
                    @click="setDescriptionViewMode('preview')"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    class="description-mode-tab"
                    :class="{ 'description-mode-tab--active': descriptionViewMode === 'markdown' }"
                    role="tab"
                    :aria-selected="descriptionViewMode === 'markdown'"
                    :disabled="saving || descriptionSaving"
                    @click="setDescriptionViewMode('markdown')"
                  >
                    Markdown
                  </button>
                </div>
              </div>
              <textarea
                v-if="descriptionViewMode === 'markdown'"
                ref="descriptionTextareaRef"
                v-model="descriptionDraft"
                class="description-input"
                rows="1"
                :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
                aria-label="説明"
                :disabled="saving || descriptionSaving"
                spellcheck="false"
                @input="adjustDescriptionTextareaHeight"
                @blur="onDescriptionBlur"
              />
              <div
                v-else-if="renderedDescriptionHtml"
                class="description-preview"
                v-html="renderedDescriptionHtml"
              />
              <p
                v-else
                class="description-preview-empty"
              >説明がありません。</p>
            </section>
            <section v-if="taskId" class="field-block attachments-block">
              <div class="attachments-block__header">
                <span class="field-label">添付ファイル</span>
                <label class="attachments-upload">
                  <input
                    type="file"
                    class="attachments-upload__input"
                    :disabled="attachmentUploading || saving"
                    @change="onAttachmentFileSelected"
                  >
                  追加
                </label>
              </div>
              <p v-if="attachmentsLoading" class="attachments-state">読み込み中…</p>
              <p v-else-if="attachmentsError" class="attachments-state attachments-state--error">{{ attachmentsError }}</p>
              <p v-else-if="!attachments.length" class="attachments-state">添付ファイルはありません。</p>
              <ul v-else class="attachments-list">
                <li v-for="attachment in attachments" :key="attachment.id" class="attachments-item">
                  <a
                    :href="attachmentDownloadUrl(attachment.id)"
                    class="attachments-item__name"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ attachment.original_name }}
                  </a>
                  <span class="attachments-item__meta">{{ formatAttachmentSize(attachment.size_bytes) }}</span>
                  <button
                    type="button"
                    class="attachments-item__delete"
                    :disabled="attachmentDeletingId === attachment.id"
                    @click="deleteAttachment(attachment.id)"
                  >
                    削除
                  </button>
                </li>
              </ul>
            </section>
            <div
              v-if="checklists.length"
              ref="checklistBlockRef"
              class="task-checklist-wrap"
            >
              <TaskDetailChecklistBlock
                v-for="checklist in checklists"
                :key="checklist.id"
                :checklist="checklist"
                :show-add-form="checklistAddFormOpenId === checklist.id"
                @update="updateChecklist(checklist.id, $event)"
                @update:show-add-form="setChecklistAddFormOpen(checklist.id, $event)"
                @delete="deleteChecklist(checklist.id)"
              />
            </div>
            <TaskDetailHierarchyBlock
              v-if="showHierarchySection"
              :parent-task="hierarchyParent"
              :child-tasks="hierarchyChildTasks"
              :current-task-id="task?.id ?? null"
              :workspace-lists="workspaceLists"
              @select="onHierarchyTaskSelect"
            />
            <p v-if="saveError" class="err">{{ saveError }}</p>
            <Teleport to="body">
              <Transition name="popover-fade" @after-enter="updatePopoverPosition">
                <div
                  v-if="modelValue && activePopover"
                  :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
                  class="popover-layer popover-layer--portal"
                >
                <PopoverShell
                  v-if="activePopover === 'start-date' || activePopover === 'due-date'"
                  ref="popoverElRef"
                  shell-class="popover popover--date"
                  :style="popoverStyle"
                  :title="activePopover === 'start-date' ? '開始日' : '終了日'"
                  :aria-label="activePopover === 'start-date' ? '開始日' : '終了日'"
                  :close-disabled="saving"
                  @close="closePopover"
                >
                <div class="calendar">
                  <div class="calendar-nav">
                    <button
                      type="button"
                      class="calendar-nav-btn"
                      :disabled="saving"
                      aria-label="前の月"
                      @click="shiftCalendarMonth(-1)"
                    >‹</button>
                    <span class="calendar-month-label">{{ calendarMonthLabel }}</span>
                    <button
                      type="button"
                      class="calendar-nav-btn"
                      :disabled="saving"
                      aria-label="次の月"
                      @click="shiftCalendarMonth(1)"
                    >›</button>
                  </div>
                  <div class="calendar-weekdays">
                    <span v-for="day in weekdayLabels" :key="day" class="calendar-weekday">{{ day }}</span>
                  </div>
                  <div class="calendar-grid">
                    <button
                      v-for="cell in calendarCells"
                      :key="cell.key"
                      type="button"
                      class="calendar-day"
                      :class="{
                        'calendar-day--outside': !cell.inMonth,
                        'calendar-day--selected': cell.iso === pendingDate,
                        'calendar-day--today': cell.isToday,
                      }"
                      @click.stop="pickCalendarDay(cell.iso)"
                    >
                      {{ cell.day }}
                    </button>
                  </div>
                </div>
                <div class="popover-field-actions">
                  <button
                    type="button"
                    class="popover-field-clear-btn"
                    :disabled="saving || dateSaving || !canClearCalendarDate"
                    @click.stop="void clearCalendarDate()"
                  >
                    削除
                  </button>
                </div>
                <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'effort'"
                ref="popoverElRef"
                shell-class="popover popover--effort"
                :style="popoverStyle"
                title="工数"
                aria-label="工数"
                :close-disabled="saving || effortSaving"
                @close="void finalizeEffortPopover()"
              >
                <div class="effort-input-row">
                  <input
                    ref="effortInputRef"
                    :value="effortDraft"
                    type="number"
                    min="0"
                    step="0.01"
                    class="effort-input"
                    placeholder="工数を入力してください"
                    aria-label="工数"
                    :disabled="saving || effortSaving"
                    @input="updateEffortDraft(($event.target as HTMLInputElement).value)"
                    @keydown.enter.prevent="void finalizeEffortPopover()"
                    @keydown.escape.prevent="void finalizeEffortPopover()"
                    @click.stop
                  />
                  <span class="effort-unit-label">{{ effortUnitLabel() }}</span>
                </div>
                <div class="popover-field-actions">
                  <button
                    type="button"
                    class="popover-field-clear-btn"
                    :disabled="saving || effortSaving || !canClearEffort"
                    @click.stop="void clearEffort()"
                  >
                    削除
                  </button>
                </div>
                <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </PopoverShell>
              <div
                v-else-if="activePopover === 'member-detail' && selectedMember"
                ref="popoverElRef"
                class="popover popover--member-detail"
                :style="popoverStyle"
                role="dialog"
                :aria-label="`${memberDisplayName(selectedMember)}の詳細`"
                @click.stop
              >
                <div class="member-detail-card">
                  <header class="member-detail-header">
                    <button
                      type="button"
                      class="member-detail-close"
                      :disabled="saving"
                      aria-label="閉じる"
                      @click="closePopover"
                    >✕</button>
                    <div class="member-detail-profile">
                      <img
                        v-if="selectedMember.avatar_url"
                        :src="selectedMember.avatar_url"
                        alt=""
                        class="member-detail-avatar"
                      />
                      <span v-else class="member-detail-initial">{{ memberInitial(selectedMember) }}</span>
                      <div class="member-detail-text">
                        <p class="member-detail-name">{{ memberDisplayName(selectedMember) }}</p>
                        <p class="member-detail-email">{{ memberEmailLine(selectedMember) }}</p>
                      </div>
                    </div>
                  </header>
                  <div class="member-detail-body">
                    <button
                      type="button"
                      class="member-detail-remove"
                      :disabled="saving"
                      @click.stop="removeMemberFromTask(selectedMember)"
                    >
                      タスクから削除
                    </button>
                  </div>
                </div>
                <p v-if="popoverError" class="err member-detail-error">{{ popoverError }}</p>
              </div>
              <PopoverShell
                v-else-if="activePopover === 'members'"
                ref="popoverElRef"
                shell-class="popover popover--members"
                header-class="popover-header--labels"
                :style="popoverStyle"
                title="担当者"
                aria-label="担当者"
                :close-disabled="saving"
                @close="closePopover"
              >
                <input
                  v-model="memberSearchQuery"
                  type="search"
                  class="label-search-input"
                  placeholder="ユーザーを検索..."
                  :disabled="saving"
                  @click.stop
                />
                <div class="popover-scroll">
                  <template v-if="filteredAssignedMembers.length">
                    <p class="label-section-heading">担当者</p>
                    <ul class="label-picker-list">
                      <li v-for="member in filteredAssignedMembers" :key="`assigned-${member.id}`">
                        <button
                          type="button"
                          class="label-picker-row member-picker-row--workspace"
                          @click.stop="toggleMember(member)"
                        >
                          <span class="label-picker-bar member-picker-bar">
                            <MemberAvatar
                              :member="member"
                              size="xs"
                              class="member-picker-avatar"
                            />
                            <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
                          </span>
                          <Check
                            :size="16"
                            :stroke-width="2.75"
                            class="member-picker-check"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    </ul>
                  </template>
                  <template v-if="filteredUnassignedMembers.length">
                    <p class="label-section-heading">ユーザー</p>
                    <ul class="label-picker-list">
                      <li v-for="member in filteredUnassignedMembers" :key="`member-${member.id}`">
                        <button
                          type="button"
                          class="label-picker-row member-picker-row--workspace"
                          @click.stop="toggleMember(member)"
                        >
                          <span class="label-picker-bar member-picker-bar">
                            <MemberAvatar
                              :member="member"
                              size="xs"
                              class="member-picker-avatar"
                            />
                            <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
                          </span>
                        </button>
                      </li>
                    </ul>
                  </template>
                  <p v-if="!workspaceMembers.length" class="empty-text label-picker-empty">スペースユーザーがいません。</p>
                  <p
                    v-else-if="!filteredAssignedMembers.length && !filteredUnassignedMembers.length"
                    class="empty-text label-picker-empty"
                  >該当するユーザーがいません。</p>
                  <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </div>
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'parent-task'"
                ref="popoverElRef"
                shell-class="popover popover--parent-task"
                :style="popoverStyle"
                title="親タスク"
                aria-label="親タスク"
                :close-disabled="parentTaskSaving"
                @close="closePopover"
              >
                <ParentTaskPickerPanel
                  :loading="parentTasksLoading"
                  :parents="parentTasks"
                  :selected-parent-id="task?.parent_task_id ?? null"
                  :clear-disabled="parentTaskSaving"
                  :error="popoverError"
                  @select="selectParentTask($event)"
                  @clear="selectParentTask(null)"
                />
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'list'"
                ref="popoverElRef"
                shell-class="popover popover--list"
                :style="popoverStyle"
                title="リストを選択"
                aria-label="リストを選択"
                :close-disabled="listSaving"
                @close="closePopover"
              >
                <div class="popover-scroll">
                  <ul class="list-picker-list">
                    <li
                      v-for="list in workspaceLists"
                      :key="list.id"
                    >
                      <button
                        type="button"
                        class="list-picker-row"
                        :class="{ 'list-picker-row--selected': task?.list_id === list.id }"
                        :disabled="listSaving"
                        @click.stop="selectList(list.id)"
                      >
                        <span
                          class="list-picker-radio"
                          :class="{ 'list-picker-radio--checked': task?.list_id === list.id }"
                          aria-hidden="true"
                        />
                        <span class="list-picker-label">{{ list.name }}</span>
                      </button>
                    </li>
                  </ul>
                  <p v-if="!workspaceLists.length" class="empty-text list-picker-empty">
                    リストがありません。
                  </p>
                  <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </div>
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'labels'"
                ref="popoverElRef"
                shell-class="popover popover--labels"
                header-class="popover-header--labels"
                :style="popoverStyle"
                title="ラベル"
                aria-label="ラベル"
                :close-disabled="saving"
                @close="closePopover"
              >
                <input
                  v-model="labelSearchQuery"
                  type="search"
                  class="label-search-input"
                  placeholder="ラベルを検索..."
                  :disabled="saving"
                  @click.stop
                />
                <p class="label-section-heading">ラベル</p>
                <div class="popover-scroll">
                  <ul class="label-picker-list">
                    <li v-for="label in filteredOrgLabels" :key="label.id">
                      <button
                        type="button"
                        class="label-picker-row"
                        @click.stop="toggleLabel(label)"
                      >
                        <span
                          class="label-picker-checkbox"
                          :class="{ 'label-picker-checkbox--checked': isLabelSelected(label.id) }"
                          aria-hidden="true"
                        >
                          <span v-if="isLabelSelected(label.id)">✓</span>
                        </span>
                        <span
                          class="label-picker-bar"
                          :style="{
                            backgroundColor: label.color,
                            color: labelBarTextColor(label.color),
                          }"
                        >
                          {{ label.name }}
                        </span>
                      </button>
                    </li>
                  </ul>
                  <p v-if="!orgLabels.length" class="empty-text label-picker-empty">
                    ラベルは設定画面で作成できます。
                  </p>
                  <p v-else-if="!filteredOrgLabels.length" class="empty-text label-picker-empty">
                    該当するラベルがありません。
                  </p>
                  <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </div>
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'checklist-create'"
                ref="popoverElRef"
                shell-class="popover popover--checklist-create"
                :style="popoverStyle"
                title="チェックリスト"
                aria-label="チェックリスト"
                @close="closePopover"
              >
                <input
                  ref="checklistTitleInputRef"
                  v-model="checklistTitleDraft"
                  type="text"
                  class="checklist-create-input"
                  :maxlength="CHECKLIST_TITLE_MAX_LENGTH"
                  placeholder="タイトル"
                  aria-label="チェックリストのタイトル"
                  @keydown.enter.prevent="submitChecklistCreate"
                  @click.stop
                />
                <div class="checklist-create-actions">
                  <button
                    type="button"
                    class="checklist-create-submit"
                    @click.stop="submitChecklistCreate"
                  >
                    追加
                  </button>
                </div>
              </PopoverShell>
              </div>
              </Transition>
            </Teleport>
            </div>
            <TaskDetailChatPane
              :org-slug="orgSlug"
              :workspace-id="workspaceId"
              :task-id="taskId"
              :workspace-members="workspaceMembers"
              :initial-comments="initialComments"
              @comments-updated="emit('comments-updated', $event)"
            />
          </div>
        </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  ListChecks,
  Tags,
  UserPlus,
} from 'lucide-vue-next'
import ParentTaskPickerPanel from '../task/ParentTaskPickerPanel.vue'
import TaskDetailChecklistBlock, {
  type TaskChecklist,
} from '../task/TaskDetailChecklistBlock.vue'
import TaskDetailHierarchyBlock, {
  type TaskHierarchyChild,
  type TaskHierarchyParent,
} from '../task/TaskDetailHierarchyBlock.vue'
import { useApi } from '../../composables/useApi'
import {
  EFFORT_UNIT_LABEL,
  FIXED_EFFORT_UNIT,
  effortUnitLabel,
  formatEffortAmount,
  formatEffortDisplay,
  normalizeEffortValue,
  parseEffortDraft,
  resolveStoredEffortValue,
  sanitizeEffortDraftInput,
} from '../../composables/useTaskFormHelpers'
import { memberDisplayName, memberInitial } from '../../composables/useMemberDisplay'
import type { TaskDetailComment } from '../task/taskCommentTypes'
import { createOverlayBackdropClose, dismissPopoverFromOutsidePointer, getTopmostModalOverlay } from '../../utils/uiInteraction'
import {
  CHECKLIST_TITLE_MAX_LENGTH,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'
import {
  isTaskInHierarchy,
  resolveTaskHierarchyFromTasks,
  type TaskHierarchySource,
} from '../../composables/useTaskHierarchy'
import {
  resolveListColor,
  resolveListName,
  type WorkspaceListOption,
} from '../../composables/useTaskPopoverEditor'
import { resolveLabelColors } from '../../utils/colorPresetResolution'
import { renderMarkdownToSafeHtml } from '../../utils/renderMarkdown'
export type TaskDetailLabel = { id: number; name: string; color: string }
export type TaskDetailMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
export type TaskDetail = {
  id: number
  title: string
  description: string | null
  status: string
  list_id: number | null
  sort_order?: number
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  assignees: TaskDetailMember[]
  labels: TaskDetailLabel[]
  checklists?: TaskChecklist[]
  is_parent_task?: boolean
  parent_task_id?: number | null
  parent_task?: TaskHierarchyParent | null
  child_tasks?: TaskHierarchyChild[]
}
type ParentTaskOption = { id: number; title: string }
type PopoverType = 'start-date' | 'due-date' | 'effort' | 'members' | 'member-detail' | 'labels' | 'parent-task' | 'list' | 'checklist-create'
type DatePickerTarget = 'start' | 'due'
type CalendarCell = {
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}
export type TaskDetailRemotePatch = Pick<TaskDetail, 'id'> & Partial<Omit<TaskDetail, 'id'>>
const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  workspaceId: string
  taskId: number | null
  orgLabels: TaskDetailLabel[]
  workspaceMembers: TaskDetailMember[]
  workspaceLists?: WorkspaceListOption[]
  /** ボード画面で取得済みのタスク詳細（あれば読み込み画面を出さない） */
  initialTaskDetail?: TaskDetail | null
  /** ボード画面で取得済みの親タスク一覧 */
  initialParentTasks?: ParentTaskOption[] | null
  /** 親子関係の即時表示用（ボード上のタスク一覧） */
  hierarchyTasks?: TaskHierarchySource[] | null
  /** ボード画面で取得済みのコメント */
  initialComments?: TaskDetailComment[] | null
  /** 他クライアントからの TaskUpdated など（rev が変わるたびに適用） */
  remoteUpdate?: TaskDetailRemotePatch | null
  remoteUpdateRev?: number
}>(), {
  workspaceLists: () => [],
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: [TaskDetail]
  'comments-updated': [{ taskId: number; comments: TaskDetailComment[] }]
  navigate: [taskId: number]
}>()
const { api, apiBase } = useApi()
const TASK_DETAIL_NAVIGATE_FADE_MS = 180
const isNavigatingFade = ref(false)
const task = ref<TaskDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const dateSaving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const ignoreOverlayCloseUntil = ref(0)
/** モーダル内で押し始めた操作（文字選択ドラッグなど）では外側で離しても閉じない */
const activePopover = ref<PopoverType | null>(null)
const selectedMember = ref<TaskDetailMember | null>(null)
const popoverError = ref<string | null>(null)
const popoverStyle = ref<Record<string, string>>({})
const modalCardRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const modalBodyRef = ref<HTMLElement | null>(null)
const popoverElRef = ref<{ rootRef: HTMLElement | null } | HTMLElement | null>(null)
function resolvePopoverElement (): HTMLElement | null {
  const target = popoverElRef.value
  if (!target) {
    return null
  }
  if (target instanceof HTMLElement) {
    return target
  }
  return target.rootRef
}
const actionButtonsRef = ref<HTMLElement | null>(null)
const effortDetailAnchorRef = ref<HTMLElement | null>(null)
const popoverAnchorEl = ref<HTMLElement | null>(null)
const calendarCursor = ref(new Date())
const pendingDate = ref<string | null>(null)
const titleDraft = ref('')
const titleComposing = ref(false)
const titleSaving = ref(false)
const titleTextareaRef = ref<HTMLTextAreaElement | null>(null)
const descriptionTextareaRef = ref<HTMLTextAreaElement | null>(null)
const showTitlePlaceholder = computed(() => {
  if (titleComposing.value) return false
  return titleDraft.value.length === 0
})
const descriptionDraft = ref('')
const descriptionSaving = ref(false)
type DescriptionViewMode = 'preview' | 'markdown'
const descriptionViewMode = ref<DescriptionViewMode>('markdown')
const renderedDescriptionHtml = computed(() => (
  renderMarkdownToSafeHtml(descriptionDraft.value)
))
const labelSearchQuery = ref('')
const memberSearchQuery = ref('')
const checklistTitleDraft = ref('')
const checklistAddFormOpenId = ref<number | null>(null)
const checklistSaving = ref(false)
const checklists = ref<TaskChecklist[]>([])
const checklistBlockRef = ref<HTMLElement | null>(null)
const checklistTitleInputRef = ref<HTMLInputElement | null>(null)
type TaskAttachmentItem = {
  id: number
  task_id: number
  original_name: string
  mime_type: string | null
  size_bytes: number
  uploaded_by: number
  created_at: string
}
const attachments = ref<TaskAttachmentItem[]>([])
const attachmentsLoading = ref(false)
const attachmentsError = ref<string | null>(null)
const attachmentUploading = ref(false)
const attachmentDeletingId = ref<number | null>(null)
let checklistSaveTimer: ReturnType<typeof setTimeout> | null = null
let checklistSaveSeq = 0
let lastPersistedChecklists: TaskChecklist[] = []
function clearChecklistSaveTimer () {
  if (checklistSaveTimer) {
    clearTimeout(checklistSaveTimer)
    checklistSaveTimer = null
  }
}
const effortDraft = ref<string | number>('')
const effortSaving = ref(false)
const effortInputRef = ref<HTMLInputElement | null>(null)
const parentTasks = ref<ParentTaskOption[]>([])
const parentTasksLoading = ref(false)
const parentTaskSaving = ref(false)
const listSaving = ref(false)
const pickerMutationPending = ref(false)
const showParentTaskControl = computed(() => {
  return Boolean(task.value && !task.value.is_parent_task)
})
const currentListOption = computed((): WorkspaceListOption | null => {
  const listId = task.value?.list_id
  if (listId == null) return null
  return props.workspaceLists.find(list => list.id === listId) ?? null
})
const listBadgeLabel = computed(() => currentListOption.value?.name ?? 'リストを選択')
const showListBadge = computed(() => Boolean(task.value))
const listBadgeStyle = computed(() => {
  const color = resolveListColor(task.value?.list_id, props.workspaceLists)
  return color ? { color } : undefined
})
function toHierarchyTaskRef (detail: TaskDetail): TaskHierarchySource {
  return {
    id: detail.id,
    title: detail.title,
    is_parent_task: detail.is_parent_task,
    parent_task_id: detail.parent_task_id ?? null,
    due_date: detail.due_date,
    list_id: detail.list_id,
    list_name: resolveListName(detail.list_id, props.workspaceLists),
    list_color: resolveListColor(detail.list_id, props.workspaceLists),
  }
}
function enrichHierarchyParent (
  parent: { id: number; title: string } | null | undefined,
): TaskHierarchyParent | null {
  if (!parent) {
    return null
  }
  const source = hierarchyTaskSources.value.find(row => row.id === parent.id)
  const listId = source?.list_id ?? null
  return {
    id: parent.id,
    title: parent.title,
    list_id: listId,
    list_name: source?.list_name
      ?? resolveListName(listId, props.workspaceLists)
      ?? null,
    list_color: source?.list_color
      ?? resolveListColor(listId, props.workspaceLists)
      ?? null,
  }
}
function enrichHierarchyChild (child: TaskHierarchyChild): TaskHierarchyChild {
  const source = hierarchyTaskSources.value.find(row => row.id === child.id)
  const listId = child.list_id ?? source?.list_id ?? null
  return {
    ...child,
    list_id: listId,
    list_name: child.list_name
      ?? source?.list_name
      ?? resolveListName(listId, props.workspaceLists)
      ?? null,
    list_color: child.list_color
      ?? source?.list_color
      ?? resolveListColor(listId, props.workspaceLists)
      ?? null,
  }
}
const hierarchyTaskSources = computed((): TaskHierarchySource[] => {
  const base = props.hierarchyTasks ?? []
  const current = task.value
  if (!current) {
    return base
  }
  const currentSource = toHierarchyTaskRef(current)
  const index = base.findIndex(row => row.id === current.id)
  if (index < 0) {
    return [...base, currentSource]
  }
  const next = base.slice()
  next[index] = { ...base[index]!, ...currentSource }
  return next
})
const resolvedHierarchy = computed((): {
  parent_task: TaskHierarchyParent | null
  child_tasks: TaskHierarchyChild[]
} => {
  const current = task.value
  if (!current || !isTaskInHierarchy(current)) {
    return { parent_task: null, child_tasks: [] }
  }
  const resolveName = (listId: number | null) => resolveListName(listId, props.workspaceLists)
  if (hierarchyTaskSources.value.length > 0) {
    const resolved = resolveTaskHierarchyFromTasks(
      toHierarchyTaskRef(current),
      hierarchyTaskSources.value,
      resolveName,
    )
    if (resolved.parent_task) {
      return {
        parent_task: enrichHierarchyParent(resolved.parent_task),
        child_tasks: resolved.child_tasks.map(enrichHierarchyChild),
      }
    }
    if (current.parent_task_id != null) {
      const parent = parentTasks.value.find(item => item.id === current.parent_task_id)
      return {
        parent_task: enrichHierarchyParent(parent ?? null),
        child_tasks: resolved.child_tasks.map(enrichHierarchyChild),
      }
    }
    return {
      parent_task: null,
      child_tasks: resolved.child_tasks.map(enrichHierarchyChild),
    }
  }
  if (current.parent_task) {
    return {
      parent_task: enrichHierarchyParent(current.parent_task),
      child_tasks: (current.child_tasks ?? []).map(enrichHierarchyChild),
    }
  }
  if (current.is_parent_task) {
    return {
      parent_task: enrichHierarchyParent({
        id: current.id,
        title: current.title,
      }),
      child_tasks: (current.child_tasks ?? []).map(enrichHierarchyChild),
    }
  }
  if (current.parent_task_id != null) {
    const parent = parentTasks.value.find(item => item.id === current.parent_task_id)
    return {
      parent_task: enrichHierarchyParent(parent ?? null),
      child_tasks: (current.child_tasks ?? []).map(enrichHierarchyChild),
    }
  }
  return { parent_task: null, child_tasks: [] }
})
const hierarchyParent = computed((): TaskHierarchyParent | null => {
  return resolvedHierarchy.value.parent_task
})
const hierarchyChildTasks = computed((): TaskHierarchyChild[] => {
  return resolvedHierarchy.value.child_tasks
})
const showHierarchySection = computed(() => {
  return isTaskInHierarchy(task.value)
})
const parentTaskButtonLabel = computed(() => {
  if (!task.value?.parent_task_id) {
    return '親タスク'
  }
  const parent = parentTasks.value.find(item => item.id === task.value!.parent_task_id)
  return parent?.title ?? '親タスク'
})
const showEffortDetailSection = computed(() => {
  if (!task.value) return false
  if (activePopover.value === 'effort') {
    const parsed = parseEffortDraft(effortDraft.value)
    return parsed !== null && parsed !== 'invalid'
  }
  return resolveStoredEffortValueForTask(task.value) !== null
})
const effortDetailDisplayText = computed(() => {
  if (activePopover.value === 'effort') {
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === null || parsed === 'invalid') {
      return ''
    }
    return `${formatEffortAmount(parsed)} ${EFFORT_UNIT_LABEL}`
  }
  if (!task.value) {
    return ''
  }
  return formatEffortDisplayForTask(task.value)
})
const canClearCalendarDate = computed(() => !!pendingDate.value)
const canClearEffort = computed(() => {
  if (String(effortDraft.value ?? '').trim() !== '') {
    return true
  }
  if (!task.value) {
    return false
  }
  return resolveStoredEffortValueForTask(task.value) !== null
})
const filteredOrgLabels = computed(() => {
  const query = labelSearchQuery.value.trim().toLowerCase()
  if (!query) return props.orgLabels
  return props.orgLabels.filter(label => label.name.toLowerCase().includes(query))
})
function memberMatchesSearch (member: TaskDetailMember, query: string): boolean {
  if (!query) return true
  const name = memberDisplayName(member).toLowerCase()
  const email = (member.email ?? '').toLowerCase()
  return name.includes(query) || email.includes(query)
}
const filteredAssignedMembers = computed(() => {
  const query = memberSearchQuery.value.trim().toLowerCase()
  return (task.value?.assignees ?? []).filter(member => memberMatchesSearch(member, query))
})
const filteredUnassignedMembers = computed(() => {
  const query = memberSearchQuery.value.trim().toLowerCase()
  const assignedIds = new Set((task.value?.assignees ?? []).map(member => member.id))
  return props.workspaceMembers.filter(
    member => !assignedIds.has(member.id) && memberMatchesSearch(member, query),
  )
})
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']
const calendarMonthLabel = computed(() => {
  const y = calendarCursor.value.getFullYear()
  const m = calendarCursor.value.getMonth() + 1
  return `${y}年${m}月`
})
const calendarCells = computed((): CalendarCell[] => {
  const year = calendarCursor.value.getFullYear()
  const month = calendarCursor.value.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const todayIso = toDateInputValue(new Date())
  const cells: CalendarCell[] = []
  const gridStart = new Date(year, month, 1 - startOffset)
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    const iso = toDateInputValue(date)
    cells.push({
      key: `${iso}-${i}`,
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === todayIso,
    })
  }
  return cells
})
function formatLocalDate (date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function toDateInputValue (value: string | Date | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    return formatLocalDate(value)
  }
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed)
  }
  return trimmed.slice(0, 10)
}
function formatDateDisplay (iso: string | null | undefined): string {
  const value = toDateInputValue(iso)
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${y}/${m}/${d}`
}
function memberEmailLine (member: TaskDetailMember): string {
  const email = member.email?.trim()
  if (email) return email
  return `@user${member.id}`
}
function normalizeTaskDetail (detail: TaskDetail): TaskDetail {
  return {
    ...detail,
    labels: detail.labels ? resolveLabelColors(detail.labels) : [],
    assignees: detail.assignees ?? [],
    checklists: detail.checklists ?? [],
    parent_task: detail.parent_task ?? null,
    child_tasks: detail.child_tasks ?? [],
  }
}
function resetInteractionState () {
  saving.value = false
  dateSaving.value = false
  saveError.value = null
  dismissPopover()
  ignoreOverlayCloseUntil.value = 0
  popoverStyle.value = {}
  popoverAnchorEl.value = null
  calendarCursor.value = new Date()
  titleComposing.value = false
  titleSaving.value = false
  descriptionSaving.value = false
  labelSearchQuery.value = ''
  memberSearchQuery.value = ''
  effortDraft.value = ''
  effortSaving.value = false
  effortInputRef.value = null
  effortDetailAnchorRef.value = null
  parentTaskSaving.value = false
  listSaving.value = false
  pickerMutationPending.value = false
  checklistAddFormOpenId.value = null
  checklistSaving.value = false
  descriptionViewMode.value = 'markdown'
}
function applyLoadedTask (
  detail: TaskDetail,
  parentTasksList?: ParentTaskOption[] | null,
) {
  task.value = normalizeTaskDetail(detail)
  checklists.value = task.value.checklists ?? []
  lastPersistedChecklists = checklists.value
  titleDraft.value = task.value.title
  descriptionDraft.value = task.value.description ?? ''
  if (parentTasksList != null) {
    parentTasks.value = parentTasksList
    parentTasksLoading.value = false
  }
  loading.value = false
  loadError.value = null
  nextTick(() => {
    adjustTitleTextareaHeight()
    adjustDescriptionTextareaHeight()
  })
}
function resetState () {
  clearChecklistSaveTimer()
  task.value = null
  checklists.value = []
  lastPersistedChecklists = []
  loading.value = false
  saving.value = false
  dateSaving.value = false
  loadError.value = null
  saveError.value = null
  dismissPopover()
  ignoreOverlayCloseUntil.value = 0
  popoverStyle.value = {}
  popoverAnchorEl.value = null
  calendarCursor.value = new Date()
  titleDraft.value = ''
  titleComposing.value = false
  titleSaving.value = false
  titleTextareaRef.value = null
  descriptionTextareaRef.value = null
  descriptionDraft.value = ''
  descriptionSaving.value = false
  labelSearchQuery.value = ''
  memberSearchQuery.value = ''
  effortDraft.value = ''
  effortSaving.value = false
  effortInputRef.value = null
  effortDetailAnchorRef.value = null
  parentTasks.value = []
  parentTasksLoading.value = false
  parentTaskSaving.value = false
  listSaving.value = false
  pickerMutationPending.value = false
  checklistAddFormOpenId.value = null
  checklistSaving.value = false
  isNavigatingFade.value = false
  descriptionViewMode.value = 'markdown'
  attachments.value = []
  attachmentsLoading.value = false
  attachmentsError.value = null
  attachmentUploading.value = false
  attachmentDeletingId.value = null
}
function attachmentDownloadUrl (attachmentId: number): string {
  if (props.taskId === null) return '#'
  return `${apiBase}/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/attachments/${attachmentId}/download`
}
function formatAttachmentSize (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
async function loadAttachments () {
  if (props.taskId === null) {
    attachments.value = []
    return
  }
  attachmentsLoading.value = true
  attachmentsError.value = null
  try {
    const res = await api<{ data: TaskAttachmentItem[] }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/attachments`,
    )
    attachments.value = res.data ?? []
  } catch (e: unknown) {
    attachmentsError.value = e instanceof Error ? e.message : '添付ファイルの読み込みに失敗しました'
    attachments.value = []
  } finally {
    attachmentsLoading.value = false
  }
}
async function onAttachmentFileSelected (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || props.taskId === null || attachmentUploading.value) return
  attachmentUploading.value = true
  attachmentsError.value = null
  try {
    const body = new FormData()
    body.append('file', file)
    const created = await api<TaskAttachmentItem>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/attachments`,
      { method: 'POST', body },
    )
    attachments.value = [created, ...attachments.value]
  } catch (e: unknown) {
    attachmentsError.value = e instanceof Error ? e.message : 'アップロードに失敗しました'
  } finally {
    attachmentUploading.value = false
  }
}
async function deleteAttachment (attachmentId: number) {
  if (props.taskId === null || attachmentDeletingId.value !== null) return
  attachmentDeletingId.value = attachmentId
  attachmentsError.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/attachments/${attachmentId}`,
      { method: 'DELETE' },
    )
    attachments.value = attachments.value.filter(item => item.id !== attachmentId)
  } catch (e: unknown) {
    attachmentsError.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    attachmentDeletingId.value = null
  }
}
function resolveStoredEffortValueForTask (detail: TaskDetail): number | null {
  return resolveStoredEffortValue({
    effort_value: detail.effort_value ?? null,
    effort_hours: detail.effort_hours ?? null,
    effort_unit: detail.effort_unit ?? null,
  })
}
function effortValueToDraftFromTask (detail: TaskDetail): string {
  const value = resolveStoredEffortValueForTask(detail)
  if (value === null) {
    return ''
  }
  return formatEffortAmount(value)
}
function formatEffortDisplayForTask (detail: TaskDetail): string {
  return formatEffortDisplay({
    effort_value: detail.effort_value ?? null,
    effort_hours: detail.effort_hours ?? null,
    effort_unit: detail.effort_unit ?? null,
  })
}
function resolveEffortPopoverAnchor (event?: Event): HTMLElement | null {
  const clicked = event?.currentTarget
  const detailAnchor = effortDetailAnchorRef.value
  if (
    detailAnchor
    && clicked instanceof Node
    && detailAnchor.contains(clicked)
  ) {
    return getEffortDisplayButton() ?? detailAnchor
  }
  return capturePopoverAnchor(event)
}
function openEffortPicker (event?: Event) {
  if (!task.value || saving.value || effortSaving.value) return
  if (activePopover.value === 'effort') {
    void closePopover()
    return
  }
  popoverAnchorEl.value = resolveEffortPopoverAnchor(event)
  activePopover.value = 'effort'
  popoverError.value = null
  effortDraft.value = effortValueToDraftFromTask(task.value)
  updatePopoverPosition()
  nextTick(() => {
    effortInputRef.value?.focus()
    effortInputRef.value?.select()
  })
}
function updateEffortDraft (raw: string | number) {
  const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
  effortDraft.value = sanitized
  const inputEl = effortInputRef.value
  if (inputEl && inputEl.value !== sanitized) {
    inputEl.value = sanitized
  }
}
/** 入力ありなら保存してから閉じる。未入力なら保存せず閉じる。不正値なら開いたまま。 */
async function finalizeEffortPopover () {
  if (activePopover.value !== 'effort') return
  const parsed = parseEffortDraft(effortDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '工数は0以上の数値で入力してください'
    return
  }
  popoverError.value = null
  if (parsed !== null) {
    await saveEffort()
  }
  dismissPopover()
}
async function clearEffort () {
  if (activePopover.value !== 'effort' || effortSaving.value || saving.value) {
    return
  }
  effortDraft.value = ''
  const currentValue = task.value ? resolveStoredEffortValueForTask(task.value) : null
  if (currentValue === null) {
    dismissPopover()
    return
  }
  await saveEffort()
  dismissPopover()
}
function getEffortDisplayButton (): HTMLButtonElement | null {
  const section = effortDetailAnchorRef.value
  return section?.querySelector('.detail-value-btn') ?? null
}
function shouldIgnorePopoverOutsideClose (target: Node): boolean {
  const anchor = popoverAnchorEl.value
  if (!anchor?.contains(target)) {
    return false
  }
  // 工数: アンカーボタン（アクションバー or 詳細の値ボタン）再クリックはトグル用。
  // 詳細セクション内の余白・ラベルは外側クリックとして閉じる。
  if (activePopover.value === 'effort') {
    const detailAnchor = effortDetailAnchorRef.value
    if (detailAnchor?.contains(target)) {
      const displayButton = getEffortDisplayButton()
      return !!displayButton && displayButton.contains(target)
    }
    return true
  }
  return true
}
function handlePopoverOutsidePointerUp (event: MouseEvent) {
  if (!activePopover.value || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (resolvePopoverElement()?.contains(target)) return
  if (shouldIgnorePopoverOutsideClose(target)) return
  dismissPopoverFromOutsidePointer(target, closePopover)
}
async function saveEffort () {
  if (!task.value || effortSaving.value) return
  const parsed = parseEffortDraft(effortDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '工数は0以上の数値で入力してください'
    effortDraft.value = effortValueToDraftFromTask(task.value)
    return
  }
  const effortValue = parsed === null ? null : normalizeEffortValue(parsed)
  const effortUnit = effortValue === null ? null : FIXED_EFFORT_UNIT
  const currentValue = resolveStoredEffortValueForTask(task.value)
  if (effortValue === currentValue) {
    popoverError.value = null
    return
  }
  const previousValue = task.value.effort_value ?? null
  const previousHours = task.value.effort_hours ?? null
  const previousUnit = task.value.effort_unit ?? null
  task.value = {
    ...task.value,
    effort_value: effortValue,
    effort_hours: effortValue,
    effort_unit: effortUnit,
  }
  effortSaving.value = true
  popoverError.value = null
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { effort_value: effortValue, effort_unit: effortUnit } },
    )
    task.value = normalizeTaskDetail(updated)
    effortDraft.value = effortValueToDraftFromTask(task.value)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = {
      ...task.value,
      effort_value: previousValue,
      effort_hours: previousHours,
      effort_unit: previousUnit,
    }
    effortDraft.value = effortValueToDraftFromTask(task.value)
    saveError.value = e instanceof Error ? e.message : '工数の更新に失敗しました'
  } finally {
    effortSaving.value = false
  }
}
async function fetchParentTasks () {
  parentTasksLoading.value = true
  try {
    const res = await api<{ data: ParentTaskOption[] }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/parents`,
    )
    parentTasks.value = res.data
  } catch {
    parentTasks.value = []
  } finally {
    parentTasksLoading.value = false
  }
}
async function loadTask () {
  if (props.taskId === null) return
  loading.value = true
  loadError.value = null
  try {
    await fetchAndApplyTaskDetail()
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : '読み込みに失敗しました'
    loading.value = false
  }
}
async function fetchAndApplyTaskDetail () {
  if (props.taskId === null) return
  const detail = await api<TaskDetail>(
    `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}`,
  )
  if (props.taskId !== detail.id) return
  if (props.initialParentTasks == null) {
    await fetchParentTasks()
  }
  applyLoadedTask(detail, props.initialParentTasks)
}
async function refreshTaskDetailSilently () {
  if (props.taskId === null) return
  try {
    await fetchAndApplyTaskDetail()
  } catch {
    // ボードの初期表示を維持する
  }
}
async function reload () {
  await loadTask()
}
function applyRemoteTaskPatch (patch: TaskDetailRemotePatch) {
  if (!task.value || patch.id !== task.value.id) {
    return
  }
  if (loading.value || titleSaving.value || descriptionSaving.value || saving.value || dateSaving.value || effortSaving.value || parentTaskSaving.value || listSaving.value || checklistSaving.value || activePopover.value === 'effort') {
    return
  }
  const current = task.value
  const merged = normalizeTaskDetail({
    ...current,
    ...patch,
    labels: patch.labels ?? current.labels,
    assignees: patch.assignees ?? current.assignees,
  })
  const unchanged = (
    merged.title === current.title
    && (merged.description ?? null) === (current.description ?? null)
    && merged.status === current.status
    && merged.list_id === current.list_id
    && (merged.sort_order ?? null) === (current.sort_order ?? null)
    && (merged.start_date ?? null) === (current.start_date ?? null)
    && (merged.due_date ?? null) === (current.due_date ?? null)
    && (merged.effort_hours ?? null) === (current.effort_hours ?? null)
    && (merged.effort_value ?? null) === (current.effort_value ?? null)
    && (merged.effort_unit ?? null) === (current.effort_unit ?? null)
    && (merged.parent_task_id ?? null) === (current.parent_task_id ?? null)
    && Boolean(merged.is_parent_task) === Boolean(current.is_parent_task)
    && JSON.stringify(merged.labels) === JSON.stringify(current.labels)
    && JSON.stringify(merged.assignees) === JSON.stringify(current.assignees)
    && patch.checklists === undefined
  )
  if (unchanged) {
    return
  }
  const titleDirty = titleDraft.value.trim() !== (current.title ?? '').trim()
  const descDirty = descriptionDraft.value !== (current.description ?? '')
  task.value = merged
  if (patch.checklists !== undefined) {
    checklists.value = patch.checklists
  }
  if (!titleDirty) {
    titleDraft.value = task.value.title
  }
  if (!descDirty) {
    descriptionDraft.value = task.value.description ?? ''
    nextTick(() => adjustDescriptionTextareaHeight())
  }
}
watch(
  () => props.remoteUpdateRev,
  () => {
    const patch = props.remoteUpdate
    if (!patch || !props.modelValue) {
      return
    }
    applyRemoteTaskPatch(patch)
  },
)
watch(titleDraft, () => {
  nextTick(() => adjustTitleTextareaHeight())
})
watch(
  () => [props.modelValue, props.taskId] as const,
  async ([open, id], prev) => {
    const prevOpen = prev?.[0] ?? false
    const prevId = prev?.[1] ?? null
    if (!open) {
      if (prevOpen) resetState()
      return
    }
    if (id === null) return
    if (prevOpen && prevId === id) return
    const initial = props.initialTaskDetail
    if (initial && initial.id === id) {
      resetInteractionState()
      applyLoadedTask(initial, props.initialParentTasks)
      void refreshTaskDetailSilently()
      void loadAttachments()
      return
    }
    resetState()
    await loadTask()
    void loadAttachments()
  },
  { immediate: true },
)
function armOverlayCloseGuard (ms = 400) {
  ignoreOverlayCloseUntil.value = Date.now() + ms
}
function isOverlayCloseBlocked (): boolean {
  return Date.now() < ignoreOverlayCloseUntil.value
}
function close () {
  if (isOverlayCloseBlocked() || saving.value || titleSaving.value || descriptionSaving.value || effortSaving.value || parentTaskSaving.value) return
  if (activePopover.value) {
    void closePopover()
    return
  }
  emit('update:modelValue', false)
}
function onDocumentEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.modelValue) {
    return
  }
  if (getTopmostModalOverlay() !== overlayRef.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  void close()
}
watch(() => props.modelValue, (open) => {
  if (!import.meta.client) {
    return
  }
  if (open) {
    document.addEventListener('keydown', onDocumentEscape, true)
  } else {
    document.removeEventListener('keydown', onDocumentEscape, true)
  }
}, { immediate: true })
const {
  onOverlayMouseDown,
  resetOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: close,
  canClose: () => !isOverlayCloseBlocked()
    && !saving.value
    && !titleSaving.value
    && !descriptionSaving.value
    && !effortSaving.value
    && !parentTaskSaving.value,
})
function dismissPopover () {
  activePopover.value = null
  selectedMember.value = null
  popoverError.value = null
  pendingDate.value = null
  popoverStyle.value = {}
}
async function closePopover () {
  if (activePopover.value === 'effort') {
    await finalizeEffortPopover()
    return
  }
  dismissPopover()
}
async function onHierarchyTaskSelect (taskId: number) {
  if (!task.value || task.value.id === taskId || isNavigatingFade.value) {
    return
  }
  if (activePopover.value) {
    await closePopover()
  }
  isNavigatingFade.value = true
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, TASK_DETAIL_NAVIGATE_FADE_MS)
  })
  emit('navigate', taskId)
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isNavigatingFade.value = false
    })
  })
}
const POPOVER_VIEWPORT_PAD = 12
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
/** レイアウト前の幅推定（312px） */
const POPOVER_DEFAULT_WIDTH_PX = 312
let removePopoverResizeListener: (() => void) | null = null
/** await 後は event.currentTarget が null になるため、同期的に要素を保持する */
function capturePopoverAnchor (event?: Event): HTMLElement | null {
  const fromEvent = event?.currentTarget
  if (fromEvent instanceof HTMLElement) {
    return fromEvent
  }
  return actionButtonsRef.value
}
function updatePopoverPosition () {
  nextTick(() => {
    requestAnimationFrame(() => {
      positionPopover()
      if (!popoverElRef.value) {
        requestAnimationFrame(() => positionPopover())
      }
    })
  })
}
function positionPopover () {
  const anchor = popoverAnchorEl.value
  const popover = resolvePopoverElement()
  if (!anchor || !popover) return
  const pad = POPOVER_VIEWPORT_PAD
  const gap = POPOVER_ANCHOR_GAP
  const anchorRect = anchor.getBoundingClientRect()
  const measuredWidth = popover.offsetWidth || popover.getBoundingClientRect().width
  const popoverWidth = measuredWidth > 0 ? measuredWidth : POPOVER_DEFAULT_WIDTH_PX
  // ボタン左端に揃え、画面右端にはみ出すときだけ右端揃え（モーダル幅ではクランプしない）
  let left = anchorRect.left
  if (left + popoverWidth > window.innerWidth - pad) {
    left = anchorRect.right - popoverWidth
  }
  const spaceBelow = window.innerHeight - anchorRect.bottom - pad
  const spaceAbove = anchorRect.top - pad
  let top: number
  let maxHeight: number
  if (spaceBelow >= POPOVER_MIN_HEIGHT) {
    top = anchorRect.bottom + gap
    maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceBelow - gap))
  } else {
    maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceAbove - gap))
    top = Math.max(pad, anchorRect.top - gap - maxHeight)
  }
  popoverStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '75',
  }
}
function openDatePicker (target: DatePickerTarget, event?: Event) {
  if (!task.value) return
  const next: PopoverType = target === 'start' ? 'start-date' : 'due-date'
  if (activePopover.value === next) {
    closePopover()
    return
  }
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = next
  popoverError.value = null
  const existing = target === 'start' ? task.value.start_date : task.value.due_date
  pendingDate.value = toDateInputValue(existing) || null
  const base = pendingDate.value
    ? new Date(`${pendingDate.value}T12:00:00`)
    : new Date()
  calendarCursor.value = new Date(base.getFullYear(), base.getMonth(), 1)
  updatePopoverPosition()
}
function shiftCalendarMonth (delta: number) {
  const next = new Date(calendarCursor.value)
  next.setMonth(next.getMonth() + delta, 1)
  calendarCursor.value = next
}
async function pickCalendarDay (iso: string) {
  if (!task.value || !activePopover.value || dateSaving.value) return
  const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
  const current = field === 'start_date' ? task.value.start_date : task.value.due_date
  pendingDate.value = iso
  if (toDateInputValue(current) === iso) return
  const previousDate = current
  patchTaskDateField(field, iso)
  saveError.value = null
  popoverError.value = null
  dateSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { [field]: iso } },
    )
    task.value = normalizeTaskDetail(updated)
    const saved = field === 'start_date' ? task.value.start_date : task.value.due_date
    pendingDate.value = toDateInputValue(saved) || iso
    emit('updated', task.value)
  } catch (e: unknown) {
    patchTaskDateField(field, previousDate)
    pendingDate.value = toDateInputValue(previousDate) || null
    popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
  } finally {
    dateSaving.value = false
  }
}
async function clearCalendarDate () {
  if (!task.value || !activePopover.value || dateSaving.value || saving.value) return
  if (activePopover.value !== 'start-date' && activePopover.value !== 'due-date') {
    return
  }
  const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
  const current = field === 'start_date' ? task.value.start_date : task.value.due_date
  pendingDate.value = null
  if (!current) {
    return
  }
  const previousDate = current
  patchTaskDateField(field, null)
  saveError.value = null
  popoverError.value = null
  dateSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { [field]: null } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    patchTaskDateField(field, previousDate)
    pendingDate.value = toDateInputValue(previousDate) || null
    popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
  } finally {
    dateSaving.value = false
  }
}
function patchTaskDateField (field: 'start_date' | 'due_date', value: string | null) {
  if (!task.value) return
  task.value = { ...task.value, [field]: value }
}
function openMemberPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'members') {
    closePopover()
    return
  }
  selectedMember.value = null
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'members'
  popoverError.value = null
  updatePopoverPosition()
}
function openMemberDetail (member: TaskDetailMember, event: Event) {
  if (!task.value) return
  if (activePopover.value === 'member-detail' && selectedMember.value?.id === member.id) {
    closePopover()
    return
  }
  selectedMember.value = member
  popoverAnchorEl.value = event.currentTarget as HTMLElement
  activePopover.value = 'member-detail'
  popoverError.value = null
  updatePopoverPosition()
}
async function removeMemberFromTask (member: TaskDetailMember) {
  if (!task.value || !isMemberAssigned(member.id)) return
  armOverlayCloseGuard()
  await toggleMember(member)
  if (!isMemberAssigned(member.id)) {
    closePopover()
  }
}
function isMemberAssigned (memberId: number): boolean {
  return (task.value?.assignees ?? []).some(member => member.id === memberId)
}
async function toggleMember (member: TaskDetailMember) {
  if (!task.value || pickerMutationPending.value) return
  armOverlayCloseGuard()
  pickerMutationPending.value = true
  const previousAssignees = [...task.value.assignees]
  const currentIds = previousAssignees.map(m => m.id)
  const isAssigned = currentIds.includes(member.id)
  const assignee_ids = isAssigned
    ? currentIds.filter(id => id !== member.id)
    : [...currentIds, member.id]
  task.value = {
    ...task.value,
    assignees: isAssigned
      ? previousAssignees.filter(m => m.id !== member.id)
      : [...previousAssignees, member],
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { assignee_ids } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, assignees: previousAssignees }
    popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    pickerMutationPending.value = false
  }
}
function onPopoverEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !activePopover.value) return
  event.stopPropagation()
  closePopover()
}
watch(activePopover, (open) => {
  if (open === 'checklist-create') {
    nextTick(() => checklistTitleInputRef.value?.focus())
  }
  if (open) {
    document.addEventListener('keydown', onPopoverEscape)
    document.addEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    const onResize = () => updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
    updatePopoverPosition()
  } else {
    document.removeEventListener('keydown', onPopoverEscape)
    document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
  }
})
watch(
  () => task.value?.id,
  () => {
    checklistAddFormOpenId.value = null
  },
)
watch(labelSearchQuery, () => {
  if (activePopover.value === 'labels') {
    updatePopoverPosition()
  }
})
watch(memberSearchQuery, () => {
  if (activePopover.value === 'members') {
    updatePopoverPosition()
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentEscape, true)
  resetOverlayBackdropClose()
  document.removeEventListener('keydown', onPopoverEscape)
  document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
  removePopoverResizeListener?.()
  removePopoverResizeListener = null
})
function revertTitleDraft () {
  if (!task.value) return
  titleDraft.value = task.value.title
  nextTick(() => adjustTitleTextareaHeight())
}
function onTitleEnter () {
  titleDraft.value = titleDraft.value.replace(/\r?\n/g, '').trim()
  titleTextareaRef.value?.blur()
}
function adjustTitleTextareaHeight () {
  const el = titleTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
function adjustDescriptionTextareaHeight () {
  const el = descriptionTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
async function setDescriptionViewMode (mode: DescriptionViewMode) {
  if (descriptionViewMode.value === mode) {
    return
  }
  if (mode === 'preview' && descriptionViewMode.value === 'markdown') {
    await saveDescription()
  }
  descriptionViewMode.value = mode
  if (mode === 'markdown') {
    await nextTick()
    adjustDescriptionTextareaHeight()
    descriptionTextareaRef.value?.focus()
  }
}
async function onTitleBlur () {
  await saveTitle()
}
async function saveTitle () {
  if (!task.value || titleSaving.value) return
  const title = titleDraft.value.trim()
  if (!title) {
    titleDraft.value = task.value.title
    return
  }
  if (title === task.value.title) return
  titleSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { title } },
    )
    task.value = normalizeTaskDetail(updated)
    titleDraft.value = task.value.title
    nextTick(() => adjustTitleTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
  } finally {
    titleSaving.value = false
  }
}
function labelBarTextColor (color: string): string {
  const hex = color.replace('#', '').trim()
  if (hex.length !== 6) return '#172b4d'
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return '#172b4d'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#172b4d' : '#ffffff'
}
function isLabelSelected (labelId: number): boolean {
  return (task.value?.labels ?? []).some(label => label.id === labelId)
}
async function openParentTaskPicker (event?: Event) {
  if (!task.value || task.value.is_parent_task) return
  if (activePopover.value === 'parent-task') {
    closePopover()
    return
  }
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'parent-task'
  popoverError.value = null
  if (!parentTasks.value.length) {
    await fetchParentTasks()
  }
  updatePopoverPosition()
}
function openListPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'list') {
    closePopover()
    return
  }
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'list'
  popoverError.value = null
  updatePopoverPosition()
}
async function selectList (listId: number) {
  if (!task.value || listSaving.value || saving.value) return
  if (task.value.list_id === listId) return
  armOverlayCloseGuard()
  listSaving.value = true
  popoverError.value = null
  const previousListId = task.value.list_id
  const previousSortOrder = task.value.sort_order
  task.value = { ...task.value, list_id: listId }
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { list_id: listId } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
    closePopover()
  } catch (e: unknown) {
    task.value = {
      ...task.value,
      list_id: previousListId,
      sort_order: previousSortOrder,
    }
    popoverError.value = e instanceof Error ? e.message : 'リストの更新に失敗しました'
  } finally {
    listSaving.value = false
  }
}
async function selectParentTask (parentTaskId: number | null) {
  if (!task.value || parentTaskSaving.value) return
  armOverlayCloseGuard()
  await saveParentTask(parentTaskId)
}
async function saveParentTask (parentTaskId: number | null) {
  if (!task.value || parentTaskSaving.value) return
  if ((task.value.parent_task_id ?? null) === parentTaskId) return
  const previousParentTaskId = task.value.parent_task_id ?? null
  parentTaskSaving.value = true
  popoverError.value = null
  task.value = { ...task.value, parent_task_id: parentTaskId }
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { parent_task_id: parentTaskId } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, parent_task_id: previousParentTaskId }
    popoverError.value = e instanceof Error ? e.message : '親タスクの更新に失敗しました'
  } finally {
    parentTaskSaving.value = false
  }
}
function openLabelPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'labels') {
    closePopover()
    return
  }
  labelSearchQuery.value = ''
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'labels'
  popoverError.value = null
  updatePopoverPosition()
}
function openChecklistPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'checklist-create') {
    closePopover()
    return
  }
  checklistTitleDraft.value = ''
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'checklist-create'
  popoverError.value = null
  updatePopoverPosition()
}
function createTempChecklistId (): number {
  return -Date.now()
}
function checklistPayloadForApi (list: TaskChecklist[]): Array<{
  id?: number
  title: string
  items: TaskChecklist['items']
}> {
  return list.map(({ id, title, items }) => (
    id > 0
      ? { id, title, items }
      : { title, items }
  ))
}
function submitChecklistCreate () {
  if (!task.value || checklistSaving.value) return
  const title = checklistTitleDraft.value.trim() || 'チェックリスト'
  const tempId = createTempChecklistId()
  const next = [...checklists.value, { id: tempId, title, items: [] }]
  checklistAddFormOpenId.value = tempId
  void saveChecklists(next)
  dismissPopover()
  nextTick(() => {
    checklistBlockRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}
function setChecklistAddFormOpen (checklistId: number, open: boolean) {
  checklistAddFormOpenId.value = open ? checklistId : (
    checklistAddFormOpenId.value === checklistId ? null : checklistAddFormOpenId.value
  )
}
function updateChecklist (checklistId: number, nextChecklist: TaskChecklist) {
  if (!task.value || checklistSaving.value) return
  void saveChecklists(checklists.value.map(item => (
    item.id === checklistId ? { ...nextChecklist, id: checklistId } : item
  )))
}
function deleteChecklist (checklistId: number) {
  if (!task.value || checklistSaving.value) return
  if (checklistAddFormOpenId.value === checklistId) {
    checklistAddFormOpenId.value = null
  }
  void saveChecklists(checklists.value.filter(item => item.id !== checklistId))
}
async function saveChecklists (next: TaskChecklist[]) {
  if (!task.value) return
  checklists.value = next
  clearChecklistSaveTimer()
  checklistSaveTimer = setTimeout(() => {
    checklistSaveTimer = null
    void persistChecklists(checklists.value)
  }, 300)
}
async function persistChecklists (next: TaskChecklist[]) {
  if (!task.value) return
  const rollback = lastPersistedChecklists
  const openTempId = checklistAddFormOpenId.value
  const seq = ++checklistSaveSeq
  checklistSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { checklists: checklistPayloadForApi(next) } },
    )
    if (seq !== checklistSaveSeq || !task.value) return
    checklists.value = updated.checklists ?? []
    lastPersistedChecklists = checklists.value
    if (openTempId != null && openTempId < 0) {
      const openIndex = next.findIndex(item => item.id === openTempId)
      const persisted = checklists.value[openIndex]
      checklistAddFormOpenId.value = persisted?.id ?? null
    }
    emit('updated', { ...task.value, checklists: checklists.value })
  } catch (e: unknown) {
    if (seq !== checklistSaveSeq) return
    checklists.value = rollback
    saveError.value = e instanceof Error ? e.message : 'チェックリストの保存に失敗しました'
  } finally {
    if (seq === checklistSaveSeq) {
      checklistSaving.value = false
    }
  }
}
async function toggleLabel (label: TaskDetailLabel) {
  if (!task.value || pickerMutationPending.value) return
  armOverlayCloseGuard()
  pickerMutationPending.value = true
  const previousLabels = [...task.value.labels]
  const currentIds = previousLabels.map(item => item.id)
  const isSelected = currentIds.includes(label.id)
  const label_ids = isSelected
    ? currentIds.filter(id => id !== label.id)
    : [...currentIds, label.id]
  task.value = {
    ...task.value,
    labels: isSelected
      ? previousLabels.filter(item => item.id !== label.id)
      : [...previousLabels, label],
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { label_ids } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, labels: previousLabels }
    popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    pickerMutationPending.value = false
  }
}
async function onDescriptionBlur () {
  await saveDescription()
}
async function saveDescription () {
  if (!task.value || descriptionSaving.value) return
  const description = descriptionDraft.value
  const normalized = description.trim() === '' ? null : description
  if ((normalized ?? '') === (task.value.description ?? '')) return
  descriptionSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    task.value = normalizeTaskDetail(updated)
    descriptionDraft.value = task.value.description ?? ''
    nextTick(() => adjustDescriptionTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
  } finally {
    descriptionSaving.value = false
  }
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/TaskDetailModal.scss"></style>
