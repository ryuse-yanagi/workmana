<template>
  <Teleport to="body">
    <Transition name="modal-fade" @after-leave="onModalAfterLeave">
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
          :style="modalScrollbarStyle"
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
              aria-label="閉じる"
              @click="close"
            >
              <X
                :size="20"
                :stroke-width="2.25"
                aria-hidden="true"
              />
            </button>
          </header>
          <div v-if="loading" class="modal-body modal-body--state">
            <p class="state-message">読み込み中...</p>
          </div>
          <div v-else-if="loadError" class="modal-body modal-body--state">
            <p class="err">{{ loadError }}</p>
            <ModalFooterActions
              cancel-text="閉じる"
              confirm-text="再試行"
              @cancel="close"
              @confirm="reload"
            />
          </div>
          <div v-else class="modal-pane modal-pane--detail">
              <div
                ref="modalBodyRef"
                class="modal-pane--detail__scroller"
              >
                <div class="modal-pane--detail__body">
            <section class="field-block title-block">
              <div
                v-if="showParentTaskLabel"
                class="title-block-meta"
              >
                <button
                  ref="parentTaskLabelBtnRef"
                  type="button"
                  class="task-detail-parent-task"
                  :class="{
                    'task-detail-parent-task--open': activePopover === 'parent-task',
                    'task-detail-parent-task--unset': !task?.parent_task_id,
                  }"
                  :disabled="saving || parentSaving"
                  :aria-label="`親タスク: ${parentTaskDisplayLabel}`"
                  :aria-expanded="activePopover === 'parent-task'"
                  data-popover-trigger
                  @click.stop="openParentTaskPicker($event)"
                >
                  {{ parentTaskDisplayLabel }}
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
                >タスク名を入力...</span>
              </div>
            </section>
            <div class="action-toolbar">
              <div ref="actionButtonsRef" class="action-buttons">
                <button
                  type="button"
                  class="action-btn"
                  :class="{ 'action-btn--active': activePopover === 'members' }"
                  :disabled="saving"
                  @click="openMemberPicker($event)"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <UserPlus :size="18" :stroke-width="2.25" />
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
                    <Tags :size="18" :stroke-width="2.25" />
                  </span>
                  ラベル
                </button>
                <button
                  type="button"
                  class="action-btn"
                  :class="{ 'action-btn--active': activePopover === 'period' }"
                  :disabled="saving"
                  @click="openDatePicker($event)"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <CalendarDays :size="18" :stroke-width="2.25" />
                  </span>
                  期間
                </button>
                <button
                  type="button"
                  class="action-btn"
                  :class="{ 'action-btn--active': activePopover === 'effort' }"
                  :disabled="saving || effortSaving"
                  @click="openEffortPicker($event)"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <Clock :size="18" :stroke-width="2.25" />
                  </span>
                  工数
                </button>
                <button
                  type="button"
                  class="action-btn"
                  :class="{ 'action-btn--active': activePopover === 'progress-rate' }"
                  :disabled="saving || progressRateSaving"
                  @click="openProgressRatePicker($event)"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <ChartNoAxesColumnIncreasing :size="18" :stroke-width="2.25" />
                  </span>
                  進捗率
                </button>
                <button
                  type="button"
                  class="action-btn"
                  :class="{ 'action-btn--active': activePopover === 'checklist-add' }"
                  :disabled="saving"
                  @click="openChecklistPicker($event)"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <ListChecks :size="18" :stroke-width="2.25" />
                  </span>
                  チェックリスト
                </button>
                <button
                  v-if="taskId"
                  type="button"
                  class="action-btn"
                  :disabled="saving || attachmentUploading"
                  @click="openAttachmentFilePicker"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <Paperclip :size="18" :stroke-width="2.25" />
                  </span>
                  添付ファイル
                </button>
                <button
                  v-if="showHierarchyButton"
                  type="button"
                  class="action-btn"
                  :class="{ 'action-btn--active': activePopover === 'hierarchy' }"
                  :disabled="saving"
                  @click="openHierarchyPopover($event)"
                >
                  <span class="action-btn-icon" aria-hidden="true">
                    <Network :size="18" :stroke-width="2.25" />
                  </span>
                  階層
                </button>
                <input
                  ref="attachmentFileInputRef"
                  type="file"
                  class="attachments-upload__input attachments-upload__input--hidden"
                  :disabled="attachmentUploading || saving"
                  tabindex="-1"
                  aria-hidden="true"
                  @change="onAttachmentFileSelected"
                >
              </div>
              <div
                v-if="showListBadge"
                class="action-toolbar__aside"
              >
                <button
                  ref="listPickerBtnRef"
                  type="button"
                  class="task-detail-list-btn"
                  data-popover-trigger
                  :class="{
                    'task-detail-list-btn--placeholder': !currentListOption,
                    'task-detail-list-btn--open': activePopover === 'list',
                  }"
                  :style="listBadgeStyle"
                  :disabled="saving || listSaving"
                  :aria-label="`リスト: ${listBadgeLabel}`"
                  :aria-expanded="activePopover === 'list'"
                  @click.stop="openListPicker($event)"
                >
                  <span class="task-detail-list-btn__name">{{ listBadgeLabel }}</span>
                  <ChevronDown
                    class="task-detail-list-btn__chevron"
                    :size="14"
                    :stroke-width="2.5"
                    aria-hidden="true"
                  />
                </button>
                <button
                  v-if="showAddChildTaskButton"
                  type="button"
                  class="subheader-secondary-btn subheader-secondary-btn--add task-detail-add-child-btn"
                  :disabled="saving"
                  @click.stop="onAddChildTask"
                >
                  <FilePlus
                    :size="18"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                  子タスク追加
                </button>
              </div>
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
                      v-if="memberAvatarSrc(member)"
                      :src="memberAvatarSrc(member)!"
                      alt=""
                      class="member-avatar-btn-image"
                      @error="onMemberAvatarError(member.id)"
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
                    <Plus
                      :size="16"
                      :stroke-width="2.25"
                      class="member-avatar-btn-plus"
                      aria-hidden="true"
                    />
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
                    <Plus
                      :size="16"
                      :stroke-width="2.25"
                      class="label-chip-add-plus"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </section>
            </div>
            <div
              v-if="(task?.start_date || task?.due_date) || showEffortDetailSection || showProgressRateDetailSection"
              class="detail-meta-row detail-meta-row--schedule"
            >
              <section v-if="task?.start_date || task?.due_date" class="detail-item detail-item--date">
                <span class="detail-item-label">期間</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :disabled="saving"
                  @click="openDatePicker($event)"
                >
                  {{ formatPeriodDisplay(task.start_date, task.due_date) }}
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
              <section
                v-if="showProgressRateDetailSection"
                ref="progressRateDetailAnchorRef"
                class="detail-item detail-item--progress-rate"
              >
                <span class="detail-item-label">進捗率</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :class="{ 'detail-value-btn--editing': activePopover === 'progress-rate' }"
                  :disabled="saving || progressRateSaving"
                  :aria-live="activePopover === 'progress-rate' ? 'polite' : undefined"
                  @click="openProgressRatePicker($event)"
                >
                  {{ progressRateDetailDisplayText }}
                </button>
              </section>
            </div>
            <section class="field-block description-block">
              <span class="field-label">説明</span>
              <textarea
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
                :task-id="taskId"
                :show-add-form="checklistAddFormOpenId === checklist.id"
                @update="updateChecklist(checklist.id, $event)"
                @update:show-add-form="setChecklistAddFormOpen(checklist.id, $event)"
                @delete="deleteChecklist(checklist.id)"
              />
            </div>
            <section
              v-if="taskId && showAttachmentsSection"
              class="field-block attachments-block"
              :class="{ 'attachments-block--collapsed': attachmentsCollapsed }"
            >
              <div class="attachments-block__header">
                <div class="attachments-block__title-row">
                  <button
                    type="button"
                    class="attachments-block__icon-toggle"
                    :class="{ 'attachments-block__icon-toggle--collapsed': attachmentsCollapsed }"
                    :aria-expanded="!attachmentsCollapsed"
                    :aria-label="attachmentsCollapsed ? '添付ファイルを展開' : '添付ファイルを折りたたむ'"
                    @click="toggleAttachmentsCollapsed"
                  >
                    <span class="attachments-block__icon attachments-block__icon--default" aria-hidden="true">
                      <Paperclip :size="20" :stroke-width="2.25" />
                    </span>
                    <span class="attachments-block__icon attachments-block__icon--hover" aria-hidden="true">
                      <ChevronDown :size="20" :stroke-width="2.25" />
                    </span>
                    <span class="attachments-block__icon attachments-block__icon--collapsed" aria-hidden="true">
                      <ChevronRight :size="20" :stroke-width="2.25" />
                    </span>
                  </button>
                  <span class="attachments-block__title">添付ファイル</span>
                </div>
                <button
                  type="button"
                  class="attachments-upload"
                  :disabled="attachmentUploading || saving"
                  @click="openAttachmentFilePicker"
                >
                  追加
                </button>
              </div>
              <div v-show="!attachmentsCollapsed" class="attachments-block__body">
                <p v-if="attachmentsLoading" class="attachments-state">読み込み中…</p>
                <p v-else-if="attachmentsError" class="attachments-state attachments-state--error">{{ attachmentsError }}</p>
                <p v-else-if="!attachments.length" class="attachments-state attachments-state--empty">
                  まだ添付ファイルはありません
                </p>
                <ul v-else class="attachments-list">
                  <li
                    v-for="attachment in attachments"
                    :key="attachment.id"
                    class="attachments-item"
                    :class="{
                      'attachments-item--busy':
                        attachmentDownloadingId === attachment.id
                        || attachmentDeletingId === attachment.id,
                      'attachments-item--menu-open': openAttachmentMenuId === attachment.id,
                    }"
                    @contextmenu="onAttachmentContextMenu(attachment.id, $event)"
                  >
                    <button
                      type="button"
                      class="attachments-item__main"
                      :disabled="attachmentDownloadingId === attachment.id || attachmentDeletingId === attachment.id"
                      :aria-label="`${attachment.original_name}をダウンロード`"
                      @click="downloadAttachment(attachment)"
                    >
                      <span
                        class="attachments-item__thumb"
                        :class="`attachments-item__thumb--${attachmentFileKind(attachment)}`"
                        aria-hidden="true"
                      >
                        <component
                          :is="attachmentFileIcon(attachment)"
                          :size="18"
                          :stroke-width="2.1"
                        />
                      </span>
                      <span class="attachments-item__body">
                        <span class="attachments-item__name">{{ attachment.original_name }}</span>
                        <span class="attachments-item__meta">
                          <span>{{ formatAttachmentSize(attachment.size_bytes) }}</span>
                          <span
                            v-if="formatAttachmentDate(attachment.created_at)"
                            class="attachments-item__meta-sep"
                            aria-hidden="true"
                          >·</span>
                          <span v-if="formatAttachmentDate(attachment.created_at)">
                            {{ formatAttachmentDate(attachment.created_at) }}
                          </span>
                        </span>
                      </span>
                    </button>
                    <div
                      class="attachments-item__menu-wrap"
                      :class="{ 'attachments-item__menu-wrap--open': openAttachmentMenuId === attachment.id }"
                      @click.stop
                      @pointerdown.stop
                      @contextmenu.stop
                    >
                      <button
                        type="button"
                        class="attachments-item__menu"
                        data-popover-trigger
                        :disabled="attachmentDeletingId === attachment.id || attachmentDownloadingId === attachment.id"
                        :aria-expanded="openAttachmentMenuId === attachment.id"
                        aria-haspopup="menu"
                        aria-label="添付ファイルのメニュー"
                        @click="toggleAttachmentMenu(attachment.id, $event)"
                      >
                        <Ellipsis :size="16" :stroke-width="2.25" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </section>
            <p v-if="saveError" class="err">{{ saveError }}</p>
            <Teleport to="body">
              <Transition name="popover-fade" @after-enter="onPopoverAfterEnter" @after-leave="notifyPopoverAfterLeave">
                <div
                  v-if="modelValue && activePopover"
                  :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
                  class="popover-layer popover-layer--portal"
                >
                <TaskDatePickerPopover
                  v-if="activePopover === 'period'"
                  ref="popoverElRef"
                  :style="popoverStyle"
                  title="期間"
                  :disabled="saving"
                  :can-clear="canClearCalendarDate"
                  :error="popoverError"
                  :weekday-labels="weekdayLabels"
                  :calendar-month-label="calendarMonthLabel"
                  :calendar-cells="calendarCells"
                  :range-start-iso="periodRangeStartIso"
                  :range-end-iso="periodRangeEndIso"
                  @close="closePopover"
                  @shift-month="shiftCalendarMonth"
                  @pick="pickCalendarDay"
                  @pick-range="pickCalendarRange"
                  @clear="void clearCalendarDate()"
                />
              <TaskEffortPickerPopover
                v-else-if="activePopover === 'effort'"
                ref="popoverElRef"
                :style="popoverStyle"
                :disabled="saving || effortSaving"
                :can-clear="canClearEffort"
                :error="popoverError"
                :draft="String(effortDraft ?? '')"
                :unit-label="EFFORT_UNIT_LABEL"
                @close="void finalizeEffortPopover()"
                @update:draft="updateEffortDraft"
                @finalize="void finalizeEffortPopover()"
                @clear="void clearEffort()"
              />
              <TaskProgressRatePickerPopover
                v-else-if="activePopover === 'progress-rate'"
                ref="popoverElRef"
                :style="popoverStyle"
                :disabled="saving || progressRateSaving"
                :can-clear="canClearProgressRate"
                :error="popoverError"
                :draft="String(progressRateDraft ?? '')"
                :unit-label="PROGRESS_RATE_UNIT_LABEL"
                @close="void finalizeProgressRatePopover()"
                @update:draft="updateProgressRateDraft"
                @finalize="void finalizeProgressRatePopover()"
                @clear="void clearProgressRate()"
              />
              <TaskMemberDetailPopover
                v-else-if="activePopover === 'member-detail' && selectedMember"
                ref="popoverElRef"
                :style="popoverStyle"
                :disabled="saving"
                :error="popoverError"
                :display-name="memberDisplayName(selectedMember)"
                :email-line="memberEmailLine(selectedMember)"
                :initial="memberInitial(selectedMember)"
                :avatar-src="memberAvatarSrc(selectedMember)"
                @close="closePopover"
                @remove="removeMemberFromTask(selectedMember)"
                @avatar-error="onMemberAvatarError(selectedMember.id)"
              />
              <WorkspaceMemberPickerPopover
                v-else-if="activePopover === 'members'"
                ref="popoverElRef"
                :style="popoverStyle"
                title="担当者"
                assigned-section-heading="担当者"
                unassigned-section-heading="メンバー"
                v-model:search-query="memberSearchQuery"
                :assignees="task?.assignees ?? []"
                :org-members="workspaceMembers"
                :disabled="saving"
                :can-clear="canClearAssignees"
                :error="popoverError"
                empty-members-message="スペースメンバーがいません"
                @close="closePopover"
                @toggle-member="toggleMember"
                @clear="void clearAssignees()"
              />
              <TaskListPickerPopover
                v-else-if="activePopover === 'list'"
                ref="popoverElRef"
                :style="popoverStyle"
                :disabled="listSaving"
                :error="popoverError"
                :lists="workspaceLists"
                :selected-id="task?.list_id ?? null"
                variant="bar"
                :bar-style="listPickerBarStyle"
                @close="closePopover"
                @select="selectList"
              />
              <TaskLabelsPickerPopover
                v-else-if="activePopover === 'labels'"
                ref="popoverElRef"
                :style="popoverStyle"
                :disabled="saving"
                :can-clear="canClearLabels"
                :error="popoverError"
                v-model:search-query="labelSearchQuery"
                :categories="filteredLabelCategories"
                :selected-ids="(task?.labels ?? []).map(label => label.id)"
                :has-source-labels="orgLabels.length > 0"
                @close="closePopover"
                @toggle="toggleLabel"
                @clear="void clearLabels()"
              />
              <PopoverShell
                v-else-if="activePopover === 'hierarchy'"
                ref="popoverElRef"
                shell-class="popover popover--hierarchy"
                :style="popoverStyle"
                title="タスク階層"
                aria-label="タスク階層"
                @close="closePopover"
              >
                <div class="popover-scroll">
                  <TaskDetailHierarchyBlock
                    :parent-task="hierarchyParent"
                    :child-tasks="hierarchyChildTasks"
                    :workspace-lists="workspaceLists"
                    :show-header="false"
                    @select="onHierarchyTaskSelect"
                  />
                </div>
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'parent-task'"
                ref="popoverElRef"
                shell-class="popover popover--parent-task"
                :style="popoverStyle"
                title="親タスク"
                aria-label="親タスク"
                :close-disabled="parentSaving"
                :show-clear="task?.parent_task_id != null"
                @close="closePopover"
                @clear="void clearParentTask()"
              >
                <ParentTaskPickerPanel
                  :loading="parentTasksLoading"
                  :parents="selectableParentTasks"
                  :selected-parent-id="task?.parent_task_id ?? null"
                  :error="popoverError"
                  @select="selectParentTask"
                  @clear="void clearParentTask()"
                />
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'checklist-add'"
                ref="popoverElRef"
                shell-class="popover popover--checklist-add"
                :style="popoverStyle"
                title="チェックリスト"
                aria-label="チェックリスト"
                @close="closePopover"
              >
                <input
                  ref="checklistTitleInputRef"
                  v-model="checklistTitleDraft"
                  type="text"
                  class="checklist-add-input"
                  :maxlength="CHECKLIST_TITLE_MAX_LENGTH"
                  placeholder="タイトルを入力..."
                  aria-label="チェックリストのタイトル"
                  @keydown.enter.prevent="submitChecklistAdd"
                  @click.stop
                />
                <div class="checklist-add-actions">
                  <button
                    type="button"
                    class="checklist-add-submit"
                    @click.stop="submitChecklistAdd"
                  >
                    追加
                  </button>
                </div>
              </PopoverShell>
              </div>
              </Transition>
            </Teleport>
                </div>
              </div>
            </div>
        </section>
    </div>
    </Transition>
    <FloatingMenu
      :open="openAttachmentMenuId !== null && attachmentMenuPosition !== null"
      density="compact"
      :style="attachmentMenuStyle"
      :disabled="attachmentDeletingId !== null"
      :items="attachmentMenuItems"
      @select="onAttachmentMenuSelect"
      @close="closeAttachmentMenu"
    />
  </Teleport>
</template>
<script setup lang="ts">
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  Clock,
  Ellipsis,
  File,
  FileArchive,
  FileImage,
  FilePlus,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Network,
  Paperclip,
  Plus,
  Tags,
  UserPlus,
  X,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import TaskDetailChecklistBlock, {
  type TaskChecklist,
} from '../task/TaskDetailChecklistBlock.vue'
import { useTaskDetailSectionCollapse } from '../../composables/useTaskDetailSectionCollapse'
import TaskDetailHierarchyBlock, {
  type TaskHierarchyChild,
  type TaskHierarchyParent,
} from '../task/TaskDetailHierarchyBlock.vue'
import ParentTaskPickerPanel from '../task/ParentTaskPickerPanel.vue'
import TaskDatePickerPopover from '../task/popover/TaskDatePickerPopover.vue'
import TaskEffortPickerPopover from '../task/popover/TaskEffortPickerPopover.vue'
import TaskProgressRatePickerPopover from '../task/popover/TaskProgressRatePickerPopover.vue'
import TaskLabelsPickerPopover from '../task/popover/TaskLabelsPickerPopover.vue'
import TaskListPickerPopover from '../task/popover/TaskListPickerPopover.vue'
import TaskMemberDetailPopover from '../task/popover/TaskMemberDetailPopover.vue'
import type { TaskPopoverListOption } from '../../utils/taskPopoverTypes'
import { TASK_POPOVER_WEEKDAY_LABELS } from '../../utils/taskPopoverTypes'
import WorkspaceMemberPickerPopover from '../workspace/WorkspaceMemberPickerPopover.vue'
import { useApi } from '../../composables/useApi'
import {
  EFFORT_UNIT_LABEL,
  PROGRESS_RATE_UNIT_LABEL,
  buildTaskCalendarCells,
  formatEffortAmount,
  formatEffortDisplay,
  formatPeriodDisplay,
  formatProgressRateDisplay,
  labelBarTextColor,
  listBarSurfaceStyle,
  normalizeEffortHours,
  normalizeProgressRate,
  parseEffortDraft,
  parseProgressRateDraft,
  progressRateValueToDraft,
  resolveStoredEffortValue,
  resolveStoredProgressRate,
  resolveTaskDateRangePick,
  sanitizeEffortDraftInput,
  sanitizeProgressRateDraftInput,
  toDateInputValue,
} from '../../composables/useTaskFormHelpers'
import { memberDisplayName, memberInitial, sortMembersByDisplayName } from '../../composables/useMemberDisplay'
import {
  applyUserProfileToMember,
  applyUserProfileToMembers,
  resolveDisplayAvatarUrl,
  useOnUserProfileUpdated,
} from '../../composables/userProfileUpdated'
import { resolveAvatarUrl } from '../../utils/resolveAvatarUrl'
import { adjustTextareaHeight } from '../../utils/textareaAutoGrow'
import type { TaskAttachmentItem } from '../task/taskAttachmentTypes'
import { createOverlayBackdropClose, dismissExclusivePopoverBeforeModalClose, dismissPopoverFromOutsidePointer, getTopmostModalOverlay, isInsideFloatingPopover, isPopoverTriggerTarget, POPOVER_TRIGGER_SELECTOR } from '../../utils/uiInteraction'
import { useModalLayer } from '../../composables/useModalLayer'
import { useModalFocusTrap } from '../../composables/useModalFocusTrap'
import { useModalScrollbarGutter } from '../../composables/useModalScrollbarGutter'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  buildAnchoredPopoverStyle,
  clampPopoverBox,
  computeAnchoredPopoverBelowLayout,
  popoverPositionVisibilityStyle,
  refineAnchoredPopoverWithFloatingUi,
  resolveMeasuredFloatingMenuHeight,
  schedulePopoverOpenLayout,
} from '../../utils/popoverScrollbar'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
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
import { isAccessDeniedMessage } from '../../utils/resourceAccessError'
import {
  resolvePopoverExposedInput,
  resolvePopoverExposedRoot,
} from '../../utils/popoverComponentRef'
import { schedulePopoverInputFocus } from '../../utils/schedulePopoverInputFocus'
import {
  filterLabelCategories,
  labelCategoriesFromFlat,
  resolveAndSortLabels,
  sortLabelsByCatalogOrder,
  type LabelCategoryGroup,
} from '../../composables/useLabelCategories'
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
  list_id: number | null
  sort_order?: number
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  progress_rate: number | string | null
  assignees: TaskDetailMember[]
  labels: TaskDetailLabel[]
  checklists?: TaskChecklist[]
  is_parent_task?: boolean
  parent_task_id?: number | null
  parent_task?: TaskHierarchyParent | null
  child_tasks?: TaskHierarchyChild[]
}
type ParentTaskOption = { id: number; title: string }
type PopoverType = 'period' | 'effort' | 'progress-rate' | 'members' | 'member-detail' | 'labels' | 'list' | 'checklist-add' | 'hierarchy' | 'parent-task'
export type TaskDetailRemotePatch = Pick<TaskDetail, 'id'> & Partial<Omit<TaskDetail, 'id'>>
const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  workspaceId: string
  taskId: number | null
  orgLabels: TaskDetailLabel[]
  labelCategories?: LabelCategoryGroup[]
  workspaceMembers: TaskDetailMember[]
  workspaceLists?: WorkspaceListOption[]
  /** ボード画面で取得済みのタスク詳細（あれば読み込み画面を出さない） */
  initialTaskDetail?: TaskDetail | null
  /** ボード画面で取得済みの親タスク一覧 */
  initialParentTasks?: ParentTaskOption[] | null
  /** タスク階層の即時表示用（ボード上のタスク一覧） */
  hierarchyTasks?: TaskHierarchySource[] | null
  /** ボード画面で取得済みの添付ファイル */
  initialAttachments?: TaskAttachmentItem[] | null
  /** 他クライアントからの TaskUpdated など（rev が変わるたびに適用） */
  remoteUpdate?: TaskDetailRemotePatch | null
  remoteUpdateRev?: number
}>(), {
  workspaceLists: () => [],
  labelCategories: () => [],
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: [TaskDetail]
  'attachments-updated': [{ taskId: number; attachments: TaskAttachmentItem[] }]
  navigate: [taskId: number]
  missing: []
  'add-child-task': [{ parentTaskId: number; listId: number | null }]
}>()
useModalLayer(() => props.modelValue)
const { api } = useApi()
const config = useRuntimeConfig()
const avatarLoadFailedIds = ref(new Set<number>())
function memberAvatarSrc (member: { id: number; avatar_url?: string | null }): string | null {
  if (avatarLoadFailedIds.value.has(member.id)) {
    return null
  }
  return resolveAvatarUrl(
    resolveDisplayAvatarUrl(member),
    String(config.public.apiBaseUrl || '/api'),
  )
}
function onMemberAvatarError (memberId: number) {
  const next = new Set(avatarLoadFailedIds.value)
  next.add(memberId)
  avatarLoadFailedIds.value = next
}
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
const { scrollbarStyle: modalScrollbarStyle } = useModalScrollbarGutter({
  cardRef: modalCardRef,
  open: () => props.modelValue,
  scrollerSelector: '.modal-pane--detail__scroller, .modal-body',
})
const overlayRef = ref<HTMLElement | null>(null)
const { refreshFocusTrap } = useModalFocusTrap({
  active: () => props.modelValue,
  containerRef: modalCardRef,
})
const modalBodyRef = ref<HTMLElement | null>(null)
const popoverElRef = ref<{ rootRef: HTMLElement | null } | HTMLElement | null>(null)
function resolvePopoverElement (): HTMLElement | null {
  return resolvePopoverExposedRoot(popoverElRef.value)
}
function resolveEffortInputEl (): HTMLInputElement | null {
  const fromPopover = resolvePopoverExposedInput(popoverElRef.value)
  if (fromPopover instanceof HTMLInputElement) return fromPopover
  return effortInputRef.value
}
function resolveProgressRateInputEl (): HTMLInputElement | null {
  const fromPopover = resolvePopoverExposedInput(popoverElRef.value)
  if (fromPopover instanceof HTMLInputElement) return fromPopover
  return progressRateInputRef.value
}
const actionButtonsRef = ref<HTMLElement | null>(null)
const effortDetailAnchorRef = ref<HTMLElement | null>(null)
const progressRateDetailAnchorRef = ref<HTMLElement | null>(null)
const popoverAnchorEl = ref<HTMLElement | null>(null)
const listPickerBtnRef = ref<HTMLElement | null>(null)
const parentTaskLabelBtnRef = ref<HTMLElement | null>(null)
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
const labelSearchQuery = ref('')
const memberSearchQuery = ref('')
const checklistTitleDraft = ref('')
const checklistAddFormOpenId = ref<number | null>(null)
const checklistSaving = ref(false)
const checklists = ref<TaskChecklist[]>([])
const checklistBlockRef = ref<HTMLElement | null>(null)
const checklistTitleInputRef = ref<HTMLInputElement | null>(null)
const attachments = ref<TaskAttachmentItem[]>([])
const attachmentsLoading = ref(false)
const attachmentsError = ref<string | null>(null)
const attachmentsSectionVisible = ref(false)
const attachmentsCollapseTarget = computed(() => (
  props.taskId == null
    ? null
    : { type: 'attachments' as const, taskId: props.taskId }
))
const {
  collapsed: attachmentsCollapsed,
  toggleCollapsed: toggleAttachmentsCollapsed,
} = useTaskDetailSectionCollapse(attachmentsCollapseTarget)
watch(attachmentsCollapsed, (collapsed) => {
  if (collapsed) {
    closeAttachmentMenu()
  }
})
const attachmentUploading = ref(false)
const attachmentDeletingId = ref<number | null>(null)
const attachmentDownloadingId = ref<number | null>(null)
const attachmentFileInputRef = ref<HTMLInputElement | null>(null)
const openAttachmentMenuId = ref<number | null>(null)
const attachmentMenuPosition = ref<{ top: number; left: number } | null>(null)
const ATTACHMENT_MENU_MIN_WIDTH = 168
const attachmentMenuItems: FloatingMenuItem[] = [
  { key: 'delete', label: '添付ファイルの削除', danger: true },
]
const attachmentMenuStyle = computed(() => {
  if (!attachmentMenuPosition.value) {
    return {}
  }
  const { top, left } = attachmentMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${ATTACHMENT_MENU_MIN_WIDTH}px`,
    zIndex: 1100,
  }
})
const showAttachmentsSection = computed(() => {
  return attachments.value.length > 0
    || attachmentUploading.value
    || Boolean(attachmentsError.value)
})
function closeAttachmentMenu () {
  openAttachmentMenuId.value = null
  attachmentMenuPosition.value = null
}
function positionAttachmentMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    attachmentMenuPosition.value = { top: 0, left: 0 }
    return
  }
  const rect = anchor.getBoundingClientRect()
  const margin = 6
  const pad = POPOVER_VIEWPORT_INSET
  const menuWidth = ATTACHMENT_MENU_MIN_WIDTH
  const menuHeight = resolveMeasuredFloatingMenuHeight(attachmentMenuItems.length)
  let left = rect.right + margin
  const maxLeft = window.innerWidth - menuWidth - pad
  if (left > maxLeft) {
    left = Math.max(pad, rect.left - menuWidth - margin)
  }
  attachmentMenuPosition.value = clampPopoverBox(rect.top, left, menuWidth, menuHeight, pad)
}
function openAttachmentMenu (attachmentId: number, anchor: HTMLElement) {
  if (openAttachmentMenuId.value === attachmentId) {
    closeAttachmentMenu()
    return
  }
  positionAttachmentMenu(anchor)
  openAttachmentMenuId.value = attachmentId
  nextTick(() => {
    if (openAttachmentMenuId.value === attachmentId) {
      positionAttachmentMenu(anchor)
    }
  })
}
function toggleAttachmentMenu (attachmentId: number, event: MouseEvent) {
  event.stopPropagation()
  if (attachmentDeletingId.value !== null || attachmentDownloadingId.value !== null) {
    return
  }
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) return
  openAttachmentMenu(attachmentId, el)
}
function onAttachmentContextMenu (attachmentId: number, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (attachmentDeletingId.value !== null || attachmentDownloadingId.value !== null) {
    return
  }
  const item = event.currentTarget
  if (!(item instanceof HTMLElement)) return
  const trigger = item.querySelector('.attachments-item__menu')
  if (!(trigger instanceof HTMLElement)) return
  openAttachmentMenu(attachmentId, trigger)
}
function onAttachmentMenuSelect (item: FloatingMenuItem) {
  const attachmentId = openAttachmentMenuId.value
  closeAttachmentMenu()
  if (item.key === 'delete' && attachmentId !== null) {
    void deleteAttachment(attachmentId)
  }
}
let checklistSaveTimer: ReturnType<typeof setTimeout> | null = null
let checklistSaveSeq = 0
let lastPersistedChecklists: TaskChecklist[] = []
function clearChecklistSaveTimer () {
  if (checklistSaveTimer) {
    clearTimeout(checklistSaveTimer)
    checklistSaveTimer = null
  }
}
function cancelPendingChecklistSave () {
  clearChecklistSaveTimer()
  checklistSaveSeq += 1
  checklistSaving.value = false
}
function isStillShowingTask (requestTaskId: number): boolean {
  return props.taskId === requestTaskId && task.value?.id === requestTaskId
}
function applyUpdatedTaskIfCurrent (requestTaskId: number, updated: TaskDetail): boolean {
  if (!isStillShowingTask(requestTaskId)) {
    return false
  }
  task.value = normalizeTaskDetail(updated)
  return true
}
const effortDraft = ref<string | number>('')
const effortSaving = ref(false)
const effortInputRef = ref<HTMLInputElement | null>(null)
const progressRateDraft = ref<string | number>('')
const progressRateSaving = ref(false)
const progressRateInputRef = ref<HTMLInputElement | null>(null)
const parentTasks = ref<ParentTaskOption[]>([])
const parentTasksLoading = ref(false)
const parentSaving = ref(false)
const listSaving = ref(false)
const pickerMutationPending = ref(false)
const currentListOption = computed((): WorkspaceListOption | null => {
  const listId = task.value?.list_id
  if (listId == null) return null
  return props.workspaceLists.find(list => list.id === listId) ?? null
})
const listBadgeLabel = computed(() => currentListOption.value?.name ?? 'リストを選択')
const showListBadge = computed(() => Boolean(task.value))
const showAddChildTaskButton = computed(() => Boolean(task.value?.is_parent_task))
const showHierarchyButton = computed(() => {
  return Boolean(task.value?.parent_task_id || task.value?.is_parent_task)
})
const selectableParentTasks = computed(() => {
  const currentId = task.value?.id
  if (currentId == null) return parentTasks.value
  return parentTasks.value.filter(item => item.id !== currentId)
})
const listBadgeStyle = computed(() => {
  const color = resolveListColor(task.value?.list_id, props.workspaceLists)
  if (!color) return undefined
  return listBarSurfaceStyle(color)
})
function listPickerBarStyle (list: TaskPopoverListOption) {
  return listBarSurfaceStyle(list.color ?? '')
}
function toHierarchyTaskRef (detail: TaskDetail): TaskHierarchySource {
  return {
    id: detail.id,
    title: detail.title,
    is_parent_task: detail.is_parent_task,
    parent_task_id: detail.parent_task_id ?? null,
    parent_task_title: detail.parent_task_id != null
      ? (detail.parent_task?.title ?? null)
      : null,
    start_date: detail.start_date ?? null,
    due_date: detail.due_date ?? null,
    effort_hours: detail.effort_hours ?? null,
    progress_rate: detail.progress_rate ?? null,
    labels: detail.labels ?? [],
    assignees: detail.assignees ?? [],
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
    start_date: source?.start_date ?? null,
    due_date: source?.due_date ?? null,
    effort_hours: source?.effort_hours ?? null,
    progress_rate: source?.progress_rate ?? null,
    labels: source?.labels ?? [],
    assignees: source?.assignees ?? [],
    // 階層ポップオーバーの「親タスク」欄はルート親そのものなので、親紐付け表示は出さない
    parent_task_id: null,
    parent_task_title: null,
    is_parent_task: source?.is_parent_task ?? true,
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
    id: child.id,
    title: child.title,
    start_date: child.start_date ?? source?.start_date ?? null,
    due_date: child.due_date ?? source?.due_date ?? null,
    effort_hours: child.effort_hours ?? source?.effort_hours ?? null,
    progress_rate: child.progress_rate ?? source?.progress_rate ?? null,
    labels: child.labels?.length ? child.labels : (source?.labels ?? []),
    assignees: child.assignees?.length ? child.assignees : (source?.assignees ?? []),
    parent_task_id: child.parent_task_id ?? source?.parent_task_id ?? null,
    parent_task_title: child.parent_task_title ?? source?.parent_task_title ?? null,
    is_parent_task: child.is_parent_task ?? source?.is_parent_task ?? false,
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
const parentTaskDisplayLabel = computed(() => {
  if (!task.value?.parent_task_id) {
    return '未設定'
  }
  if (hierarchyParent.value?.title) {
    return hierarchyParent.value.title
  }
  if (task.value.parent_task?.title) {
    return task.value.parent_task.title
  }
  const parent = parentTasks.value.find(item => item.id === task.value!.parent_task_id)
  return parent?.title ?? '未設定'
})
/** 親タスクになり得る通常タスクのみ。ルート親（is_parent_task）は階層UI側で扱う */
const showParentTaskLabel = computed(() => {
  return Boolean(task.value && !task.value.is_parent_task)
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
const showProgressRateDetailSection = computed(() => {
  if (!task.value) return false
  if (activePopover.value === 'progress-rate') {
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    return parsed !== null && parsed !== 'invalid'
  }
  return resolveStoredProgressRateForTask(task.value) !== null
})
const progressRateDetailDisplayText = computed(() => {
  if (activePopover.value === 'progress-rate') {
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    if (parsed === null || parsed === 'invalid') {
      return ''
    }
    return `${parsed} ${PROGRESS_RATE_UNIT_LABEL}`
  }
  if (!task.value) {
    return ''
  }
  return formatProgressRateDisplayForTask(task.value)
})
const canClearCalendarDate = computed(() => (
  !!(toDateInputValue(task.value?.start_date) || toDateInputValue(task.value?.due_date))
))
const periodRangeStartIso = computed(() => toDateInputValue(task.value?.start_date) || null)
const periodRangeEndIso = computed(() => toDateInputValue(task.value?.due_date) || null)
const canClearEffort = computed(() => String(effortDraft.value ?? '').trim() !== '')
const canClearProgressRate = computed(() => String(progressRateDraft.value ?? '').trim() !== '')
const canClearAssignees = computed(() => (task.value?.assignees ?? []).length > 0)
const canClearLabels = computed(() => (task.value?.labels ?? []).length > 0)
const filteredLabelCategories = computed(() => {
  return filterLabelCategories(
    labelCategoriesFromFlat(props.labelCategories, props.orgLabels),
    labelSearchQuery.value,
  )
})
const weekdayLabels = [...TASK_POPOVER_WEEKDAY_LABELS]
const calendarMonthLabel = computed(() => {
  const y = calendarCursor.value.getFullYear()
  const m = calendarCursor.value.getMonth() + 1
  return `${y}年${m}月`
})
const calendarCells = computed(() => buildTaskCalendarCells(calendarCursor.value))
function memberEmailLine (member: TaskDetailMember): string {
  const email = member.email?.trim()
  if (email) return email
  return `@user${member.id}`
}
function normalizeTaskDetail (detail: TaskDetail): TaskDetail {
  return {
    ...detail,
    labels: resolveAndSortLabels(detail.labels, props.orgLabels),
    assignees: sortMembersByDisplayName(detail.assignees ?? []),
    checklists: detail.checklists ?? [],
    parent_task: detail.parent_task ?? null,
    child_tasks: detail.child_tasks ?? [],
  }
}
function resetInteractionState () {
  cancelPendingChecklistSave()
  saving.value = false
  dateSaving.value = false
  saveError.value = null
  dismissPopover()
  ignoreOverlayCloseUntil.value = 0
  popoverStyle.value = popoverPositionVisibilityStyle(false)
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
  progressRateDraft.value = ''
  progressRateSaving.value = false
  progressRateInputRef.value = null
  progressRateDetailAnchorRef.value = null
  listSaving.value = false
  parentSaving.value = false
  pickerMutationPending.value = false
  checklistAddFormOpenId.value = null
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
  cancelPendingChecklistSave()
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
  popoverStyle.value = popoverPositionVisibilityStyle(false)
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
  progressRateDraft.value = ''
  progressRateSaving.value = false
  progressRateInputRef.value = null
  progressRateDetailAnchorRef.value = null
  parentTasks.value = []
  parentTasksLoading.value = false
  listSaving.value = false
  pickerMutationPending.value = false
  checklistAddFormOpenId.value = null
  isNavigatingFade.value = false
  attachments.value = []
  attachmentsLoading.value = false
  attachmentsError.value = null
  attachmentsSectionVisible.value = false
  attachmentUploading.value = false
  attachmentDeletingId.value = null
  attachmentDownloadingId.value = null
  closeAttachmentMenu()
}
function openAttachmentFilePicker () {
  if (saving.value || attachmentUploading.value || props.taskId === null) return
  attachmentFileInputRef.value?.click()
}
function formatAttachmentSize (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
type AttachmentFileKind = 'image' | 'pdf' | 'sheet' | 'archive' | 'text' | 'file'
function attachmentExtension (attachment: TaskAttachmentItem): string {
  const name = attachment.original_name || ''
  const idx = name.lastIndexOf('.')
  if (idx < 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}
function attachmentFileKind (attachment: TaskAttachmentItem): AttachmentFileKind {
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
function attachmentFileIcon (attachment: TaskAttachmentItem): Component {
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
function formatAttachmentDate (value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}
async function downloadAttachment (attachment: TaskAttachmentItem) {
  if (props.taskId === null || attachmentDownloadingId.value !== null) {
    return
  }
  attachmentDownloadingId.value = attachment.id
  attachmentsError.value = null
  try {
    const blob = await api<Blob>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/attachments/${attachment.id}/download`,
      {
        responseType: 'blob',
      },
    )
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = attachment.original_name || `attachment-${attachment.id}`
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (e: unknown) {
    attachmentsError.value = e instanceof Error ? e.message : 'ダウンロードに失敗しました'
  } finally {
    if (attachmentDownloadingId.value === attachment.id) {
      attachmentDownloadingId.value = null
    }
  }
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
    if (attachments.value.length > 0) {
      attachmentsSectionVisible.value = true
    }
  } catch (e: unknown) {
    attachmentsError.value = e instanceof Error ? e.message : '添付ファイルの読み込みに失敗しました'
    attachments.value = []
  } finally {
    attachmentsLoading.value = false
  }
}
function applyInitialAttachments (items: TaskAttachmentItem[]) {
  attachments.value = [...items]
  attachmentsLoading.value = false
  attachmentsError.value = null
  attachmentsSectionVisible.value = attachments.value.length > 0
}
function emitAttachmentsUpdated () {
  if (props.taskId === null) {
    return
  }
  emit('attachments-updated', {
    taskId: props.taskId,
    attachments: [...attachments.value],
  })
}
async function onAttachmentFileSelected (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || props.taskId === null || attachmentUploading.value) return
  attachmentsSectionVisible.value = true
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
    emitAttachmentsUpdated()
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
    if (attachments.value.length === 0) {
      attachmentsSectionVisible.value = false
      attachmentsError.value = null
    }
    emitAttachmentsUpdated()
  } catch (e: unknown) {
    attachmentsError.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    attachmentDeletingId.value = null
  }
}
function resolveStoredEffortValueForTask (detail: TaskDetail): number | null {
  return resolveStoredEffortValue({
    effort_hours: detail.effort_hours ?? null,
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
    effort_hours: detail.effort_hours ?? null,
  })
}
function resolveStoredProgressRateForTask (detail: TaskDetail): number | null {
  return resolveStoredProgressRate({
    progress_rate: detail.progress_rate ?? null,
  })
}
function progressRateValueToDraftFromTask (detail: TaskDetail): string {
  return progressRateValueToDraft({
    progress_rate: detail.progress_rate ?? null,
  })
}
function formatProgressRateDisplayForTask (detail: TaskDetail): string {
  return formatProgressRateDisplay({
    progress_rate: detail.progress_rate ?? null,
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
function resolveProgressRatePopoverAnchor (event?: Event): HTMLElement | null {
  const clicked = event?.currentTarget
  const detailAnchor = progressRateDetailAnchorRef.value
  if (
    detailAnchor
    && clicked instanceof Node
    && detailAnchor.contains(clicked)
  ) {
    return getProgressRateDisplayButton() ?? detailAnchor
  }
  return capturePopoverAnchor(event)
}
function openEffortPicker (event?: Event) {
  void (async () => {
    if (!task.value || saving.value || effortSaving.value) return
    const anchor = resolveEffortPopoverAnchor(event)
    if (!(await beginPopoverOpen('effort'))) return
    popoverAnchorEl.value = anchor
    activePopover.value = 'effort'
    popoverError.value = null
    effortDraft.value = effortValueToDraftFromTask(task.value)
    updatePopoverPosition()
    nextTick(() => {
      schedulePopoverInputFocus(() => resolveEffortInputEl(), { select: 'all' })
    })
  })()
}
function openProgressRatePicker (event?: Event) {
  void (async () => {
    if (!task.value || saving.value || progressRateSaving.value) return
    const anchor = resolveProgressRatePopoverAnchor(event)
    if (!(await beginPopoverOpen('progress-rate'))) return
    popoverAnchorEl.value = anchor
    activePopover.value = 'progress-rate'
    popoverError.value = null
    progressRateDraft.value = progressRateValueToDraftFromTask(task.value)
    updatePopoverPosition()
    nextTick(() => {
      schedulePopoverInputFocus(() => resolveProgressRateInputEl(), { select: 'all' })
    })
  })()
}
function updateEffortDraft (raw: string | number) {
  const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
  effortDraft.value = sanitized
  const inputEl = resolveEffortInputEl()
  if (inputEl && inputEl.value !== sanitized) {
    inputEl.value = sanitized
  }
}
function updateProgressRateDraft (raw: string | number) {
  const sanitized = sanitizeProgressRateDraftInput(String(raw ?? ''))
  progressRateDraft.value = sanitized
  const inputEl = resolveProgressRateInputEl()
  if (inputEl && inputEl.value !== sanitized) {
    inputEl.value = sanitized
  }
}
/** 入力ありなら保存、未入力なら工数を消してから閉じる。不正値なら開いたまま。 */
async function finalizeEffortPopover () {
  const closing = activePopover.value
  if (closing !== 'effort') return
  const parsed = parseEffortDraft(effortDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '工数は0以上の数値で入力してください'
    return
  }
  popoverError.value = null
  const saved = await saveEffort()
  if (!saved) {
    return
  }
  // 保存中に別ポップオーバーへ切り替わっていたら閉じない
  if (activePopover.value !== closing) return
  dismissPopover()
}
/** 入力ありなら保存、未入力なら進捗率を消してから閉じる。不正値なら開いたまま。 */
async function finalizeProgressRatePopover () {
  const closing = activePopover.value
  if (closing !== 'progress-rate') return
  const parsed = parseProgressRateDraft(progressRateDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '進捗率は0〜100の整数で入力してください'
    return
  }
  popoverError.value = null
  const saved = await saveProgressRate()
  if (!saved) {
    return
  }
  if (activePopover.value !== closing) return
  dismissPopover()
}
function getEffortDisplayButton (): HTMLButtonElement | null {
  const section = effortDetailAnchorRef.value
  return section?.querySelector('.detail-value-btn') ?? null
}
function getProgressRateDisplayButton (): HTMLButtonElement | null {
  const section = progressRateDetailAnchorRef.value
  return section?.querySelector('.detail-value-btn') ?? null
}
function shouldIgnorePopoverOutsideClose (target: Node): boolean {
  // トリガー再クリック／別ポップオーバー切替は click 側で処理する（mouseup で先行クローズしない）
  if (isPopoverTriggerTarget(target)) {
    return true
  }
  if (activePopover.value === 'list') {
    const listBtn = listPickerBtnRef.value
    if (listBtn?.contains(target)) {
      return true
    }
  }
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
  // 進捗率: アンカーボタン（アクションバー or 詳細の値ボタン）再クリックはトグル用。
  // 詳細セクション内の余白・ラベルは外側クリックとして閉じる。
  if (activePopover.value === 'progress-rate') {
    const detailAnchor = progressRateDetailAnchorRef.value
    if (detailAnchor?.contains(target)) {
      const displayButton = getProgressRateDisplayButton()
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
  if (isInsideFloatingPopover(target)) return
  if (resolvePopoverElement()?.contains(target)) return
  if (shouldIgnorePopoverOutsideClose(target)) return
  dismissPopoverFromOutsidePointer(target, closePopover)
}
async function saveEffort (): Promise<boolean> {
  if (!task.value || effortSaving.value) return false
  const parsed = parseEffortDraft(effortDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '工数は0以上の数値で入力してください'
    effortDraft.value = effortValueToDraftFromTask(task.value)
    return false
  }
  const effortHours = parsed === null ? null : normalizeEffortHours(parsed)
  const currentValue = resolveStoredEffortValueForTask(task.value)
  if (effortHours === currentValue) {
    popoverError.value = null
    return true
  }
  const requestTaskId = task.value.id
  const previousHours = task.value.effort_hours ?? null
  task.value = {
    ...task.value,
    effort_hours: effortHours,
  }
  effortSaving.value = true
  popoverError.value = null
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { effort_hours: effortHours } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return false
    effortDraft.value = effortValueToDraftFromTask(task.value)
    emit('updated', task.value)
    return true
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return false
    task.value = {
      ...task.value,
      effort_hours: previousHours,
    }
    effortDraft.value = effortValueToDraftFromTask(task.value)
    const message = e instanceof Error ? e.message : '工数の更新に失敗しました'
    popoverError.value = message
    saveError.value = message
    return false
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      effortSaving.value = false
    }
  }
}
async function saveProgressRate (): Promise<boolean> {
  if (!task.value || progressRateSaving.value) return false
  const parsed = parseProgressRateDraft(progressRateDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '進捗率は0〜100の整数で入力してください'
    progressRateDraft.value = progressRateValueToDraftFromTask(task.value)
    return false
  }
  const progressRate = parsed === null ? null : normalizeProgressRate(parsed)
  const currentValue = resolveStoredProgressRateForTask(task.value)
  if (progressRate === currentValue) {
    popoverError.value = null
    return true
  }
  const requestTaskId = task.value.id
  const previousRate = task.value.progress_rate ?? null
  task.value = {
    ...task.value,
    progress_rate: progressRate,
  }
  progressRateSaving.value = true
  popoverError.value = null
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { progress_rate: progressRate } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return false
    progressRateDraft.value = progressRateValueToDraftFromTask(task.value)
    emit('updated', task.value)
    return true
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return false
    task.value = {
      ...task.value,
      progress_rate: previousRate,
    }
    progressRateDraft.value = progressRateValueToDraftFromTask(task.value)
    const message = e instanceof Error ? e.message : '進捗率の更新に失敗しました'
    popoverError.value = message
    saveError.value = message
    return false
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      progressRateSaving.value = false
    }
  }
}
async function fetchParentTasks () {
  parentTasksLoading.value = true
  try {
    const res = await api<{ data: ParentTaskOption[] }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/parents`,
    )
    parentTasks.value = res.data ?? []
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
    const message = e instanceof Error ? e.message : '読み込みに失敗しました'
    if (isAccessDeniedMessage(message)) {
      loading.value = false
      emit('missing')
      return
    }
    loadError.value = message
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
  if (loading.value || titleSaving.value || descriptionSaving.value || saving.value || dateSaving.value || effortSaving.value || progressRateSaving.value || listSaving.value || parentSaving.value || checklistSaving.value || activePopover.value === 'effort' || activePopover.value === 'progress-rate') {
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
    && merged.list_id === current.list_id
    && (merged.sort_order ?? null) === (current.sort_order ?? null)
    && (merged.start_date ?? null) === (current.start_date ?? null)
    && (merged.due_date ?? null) === (current.due_date ?? null)
    && (merged.effort_hours ?? null) === (current.effort_hours ?? null)
    && (merged.progress_rate ?? null) === (current.progress_rate ?? null)
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
      // 閉じる瞬間に中身を消すと leave フェードが空カードになるため after-leave で reset
      return
    }
    if (id === null) return
    if (prevOpen && prevId === id) return
    const initial = props.initialTaskDetail
    const seedAttachments = () => {
      if (props.initialAttachments != null) {
        applyInitialAttachments(props.initialAttachments)
        return
      }
      void loadAttachments()
    }
    if (initial && initial.id === id) {
      resetInteractionState()
      applyLoadedTask(initial, props.initialParentTasks)
      void refreshTaskDetailSilently()
      seedAttachments()
      return
    }
    resetState()
    await loadTask()
    seedAttachments()
  },
  { immediate: true },
)
function onModalAfterLeave () {
  if (!props.modelValue) {
    resetState()
  }
}
function armOverlayCloseGuard (ms = 400) {
  ignoreOverlayCloseUntil.value = Date.now() + ms
}
function isOverlayCloseBlocked (): boolean {
  return Date.now() < ignoreOverlayCloseUntil.value
}
async function close () {
  if (isOverlayCloseBlocked() || saving.value || titleSaving.value || descriptionSaving.value || effortSaving.value || progressRateSaving.value || checklistSaving.value || dateSaving.value || listSaving.value || parentSaving.value || pickerMutationPending.value) return
  if (activePopover.value) {
    void closePopover()
    return
  }
  if (dismissExclusivePopoverBeforeModalClose()) {
    return
  }
  // Escape では blur が走らないため、未保存ドラフトを閉じてから閉じる
  await saveTitle()
  await saveDescription()
  clearChecklistSaveTimer()
  if (task.value && JSON.stringify(checklists.value) !== JSON.stringify(lastPersistedChecklists)) {
    await persistChecklists(checklists.value)
  }
  if (titleSaving.value || descriptionSaving.value || checklistSaving.value) return
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
    && !progressRateSaving.value
    && !checklistSaving.value
    && !dateSaving.value
    && !listSaving.value
    && !parentSaving.value
    && !pickerMutationPending.value,
})
function dismissPopover () {
  activePopover.value = null
  selectedMember.value = null
  popoverError.value = null
  pendingDate.value = null
  // popoverStyle は leave 完了後に消す（フェードアウトを維持）
}
let popoverLeaveResolve: (() => void) | null = null
function resolvePopoverLeaveWait () {
  popoverLeaveResolve?.()
  popoverLeaveResolve = null
}
function notifyPopoverAfterLeave () {
  // 別ポップオーバーへ切り替えた後に leave が完了しても、新しい側の位置を消さない
  if (activePopover.value == null) {
    popoverStyle.value = popoverPositionVisibilityStyle(false)
  }
  // leave 待ちは必ず解除する（早期 return だと closePopover が永続待ちになり、
  // ユーザー情報へ切り替え不能・次の担当者ポップオーバーが未配置のまま左上表示になる）
  resolvePopoverLeaveWait()
}
function armPopoverLeaveWait (): Promise<void> {
  return new Promise((resolve) => {
    const previous = popoverLeaveResolve
    popoverLeaveResolve = resolve
    // 前の待ちを破棄せず完了扱いにする
    previous?.()
  })
}
async function closePopover () {
  if (activePopover.value == null) {
    return
  }
  const leaveDone = armPopoverLeaveWait()
  if (activePopover.value === 'effort') {
    await finalizeEffortPopover()
    if (activePopover.value != null) {
      resolvePopoverLeaveWait()
      return
    }
    await leaveDone
    return
  }
  if (activePopover.value === 'progress-rate') {
    await finalizeProgressRatePopover()
    if (activePopover.value != null) {
      resolvePopoverLeaveWait()
      return
    }
    await leaveDone
    return
  }
  dismissPopover()
  await leaveDone
}
/**
 * 別ポップオーバーへ切り替える前に現在のものを閉じる。
 * 同種トグルなら閉じただけで false。不正入力で閉じられなかった場合も false。
 */
async function beginPopoverOpen (next: PopoverType): Promise<boolean> {
  const current = activePopover.value
  if (current === next) {
    await closePopover()
    return false
  }
  if (current != null) {
    await closePopover()
    if (activePopover.value != null) {
      return false
    }
  }
  return true
}
useExclusivePopover(
  () => activePopover.value != null,
  () => { void closePopover() },
)
async function onHierarchyTaskSelect (taskId: number) {
  if (!task.value || isNavigatingFade.value) {
    return
  }
  if (activePopover.value) {
    await closePopover()
  }
  isNavigatingFade.value = true
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, TASK_DETAIL_NAVIGATE_FADE_MS)
  })
  if (task.value.id !== taskId) {
    emit('navigate', taskId)
  }
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isNavigatingFade.value = false
    })
  })
}
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
let removePopoverResizeListener: (() => void) | null = null
let removeAttachmentMenuResizeListener: (() => void) | null = null

function resolveTaskDetailPopoverBaseWidth (type: PopoverType | null): number {
  switch (type) {
    case 'period':
      return POPOVER_PANEL_BASE_WIDTH.date
    case 'effort':
      return POPOVER_PANEL_BASE_WIDTH.effort
    case 'progress-rate':
      return POPOVER_PANEL_BASE_WIDTH.progressRate
    case 'members':
    case 'member-detail':
      return POPOVER_PANEL_BASE_WIDTH.members
    case 'list':
      return POPOVER_PANEL_BASE_WIDTH.list
    case 'labels':
      return POPOVER_PANEL_BASE_WIDTH.labels
    case 'hierarchy':
      return POPOVER_PANEL_BASE_WIDTH.hierarchy
    case 'parent-task':
      return POPOVER_PANEL_BASE_WIDTH.list
    case 'checklist-add':
      return POPOVER_PANEL_BASE_WIDTH.checklistAdd
    default:
      return POPOVER_PANEL_BASE_WIDTH.date
  }
}
/** await 後は event.currentTarget が null になるため、同期的に要素を保持する */
function capturePopoverAnchor (event?: Event): HTMLElement | null {
  const fromEvent = event?.currentTarget
  if (fromEvent instanceof HTMLElement) {
    return fromEvent
  }
  const fromTarget = event?.target
  if (fromTarget instanceof Element) {
    const trigger = fromTarget.closest(
      `${POPOVER_TRIGGER_SELECTOR}, button, [role="button"]`,
    )
    if (trigger instanceof HTMLElement) {
      return trigger
    }
  }
  return null
}
function updatePopoverPosition () {
  const wasVisible = popoverStyle.value.visibility === 'visible'
  if (!wasVisible) {
    popoverStyle.value = popoverPositionVisibilityStyle(false)
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionPopover(false),
        () => positionPopover(true),
      )
    })
    return
  }
  nextTick(() => {
    requestAnimationFrame(() => positionPopover(true))
  })
}
function onPopoverAfterEnter () {
  updatePopoverPosition()
  if (activePopover.value === 'checklist-add') {
    schedulePopoverInputFocus(() => checklistTitleInputRef.value)
  }
}
async function positionPopover (visible = true) {
  const anchor = popoverAnchorEl.value
  const popover = resolvePopoverElement()
  if (!anchor || !popover) return
  let layout = computeAnchoredPopoverBelowLayout(
    anchor.getBoundingClientRect(),
    resolveTaskDetailPopoverBaseWidth(activePopover.value),
    popover,
    {
      pad: POPOVER_VIEWPORT_INSET,
      gap: POPOVER_ANCHOR_GAP,
      minHeight: POPOVER_MIN_HEIGHT,
    },
  )
  if (visible) {
    layout = await refineAnchoredPopoverWithFloatingUi(anchor, popover, layout, {
      pad: POPOVER_VIEWPORT_INSET,
      gap: POPOVER_ANCHOR_GAP,
    })
  }
  popoverStyle.value = buildAnchoredPopoverStyle(layout, { zIndex: 210, visible })
}
function openDatePicker (event?: Event) {
  void (async () => {
    if (!task.value) return
    const anchor = capturePopoverAnchor(event)
    if (!(await beginPopoverOpen('period'))) return
    popoverAnchorEl.value = anchor
    activePopover.value = 'period'
    popoverError.value = null
    const startIso = toDateInputValue(task.value.start_date) || null
    const dueIso = toDateInputValue(task.value.due_date) || null
    pendingDate.value = startIso || dueIso
    const baseIso = startIso || dueIso
    const base = baseIso
      ? new Date(`${baseIso}T12:00:00`)
      : new Date()
    calendarCursor.value = new Date(base.getFullYear(), base.getMonth(), 1)
    updatePopoverPosition()
  })()
}
function shiftCalendarMonth (delta: number) {
  const next = new Date(calendarCursor.value)
  next.setMonth(next.getMonth() + delta, 1)
  calendarCursor.value = next
  popoverError.value = null
}
async function pickCalendarDay (iso: string) {
  if (!task.value || activePopover.value !== 'period' || dateSaving.value) return
  const nextRange = resolveTaskDateRangePick(iso, task.value.start_date, task.value.due_date)
  if (!nextRange) {
    popoverError.value = null
    return
  }
  await applyPeriodRange(nextRange)
}
async function pickCalendarRange (range: { start_date: string; due_date: string }) {
  if (!task.value || activePopover.value !== 'period' || dateSaving.value) return
  await applyPeriodRange(range)
}
async function applyPeriodRange (nextRange: { start_date: string; due_date: string }) {
  if (!task.value) return
  const requestTaskId = task.value.id
  const prevStart = task.value.start_date ?? null
  const prevDue = task.value.due_date ?? null
  if (
    toDateInputValue(prevStart) === nextRange.start_date
    && toDateInputValue(prevDue) === nextRange.due_date
  ) {
    popoverError.value = null
    return
  }
  pendingDate.value = nextRange.start_date
  patchTaskDateRange(nextRange.start_date, nextRange.due_date)
  saveError.value = null
  popoverError.value = null
  dateSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: nextRange },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    pendingDate.value = toDateInputValue(task.value.start_date) || nextRange.start_date
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    patchTaskDateRange(prevStart, prevDue)
    pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
    popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      dateSaving.value = false
    }
  }
}
async function clearCalendarDate () {
  if (!task.value || activePopover.value !== 'period' || dateSaving.value || saving.value) return
  const requestTaskId = task.value.id
  const prevStart = task.value.start_date ?? null
  const prevDue = task.value.due_date ?? null
  pendingDate.value = null
  if (!prevStart && !prevDue) {
    return
  }
  patchTaskDateRange(null, null)
  saveError.value = null
  popoverError.value = null
  dateSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { start_date: null, due_date: null } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    patchTaskDateRange(prevStart, prevDue)
    pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
    popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      dateSaving.value = false
    }
  }
}
async function clearEffort () {
  if (!task.value || effortSaving.value || saving.value) return
  effortDraft.value = ''
  popoverError.value = null
  const inputEl = resolveEffortInputEl()
  if (inputEl) {
    inputEl.value = ''
  }
  await saveEffort()
}
async function clearProgressRate () {
  if (!task.value || progressRateSaving.value || saving.value) return
  progressRateDraft.value = ''
  popoverError.value = null
  const inputEl = resolveProgressRateInputEl()
  if (inputEl) {
    inputEl.value = ''
  }
  await saveProgressRate()
}
async function clearAssignees () {
  if (!task.value || pickerMutationPending.value || saving.value) return
  const requestTaskId = task.value.id
  const previousAssignees = [...task.value.assignees]
  if (!previousAssignees.length) return
  armOverlayCloseGuard()
  pickerMutationPending.value = true
  task.value = {
    ...task.value,
    assignees: [],
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { assignee_ids: [] } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    task.value = { ...task.value, assignees: previousAssignees }
    popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      pickerMutationPending.value = false
    }
  }
}
async function clearLabels () {
  if (!task.value || pickerMutationPending.value || saving.value) return
  const requestTaskId = task.value.id
  const previousLabels = [...task.value.labels]
  if (!previousLabels.length) return
  armOverlayCloseGuard()
  pickerMutationPending.value = true
  task.value = {
    ...task.value,
    labels: [],
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { label_ids: [] } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    task.value = { ...task.value, labels: previousLabels }
    popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      pickerMutationPending.value = false
    }
  }
}
function patchTaskDateRange (startDate: string | null, dueDate: string | null) {
  if (!task.value) return
  task.value = { ...task.value, start_date: startDate, due_date: dueDate }
}
function openMemberPicker (event?: Event) {
  void (async () => {
    if (!task.value) return
    const anchor = capturePopoverAnchor(event)
    if (!(await beginPopoverOpen('members'))) return
    selectedMember.value = null
    popoverAnchorEl.value = anchor
    activePopover.value = 'members'
    popoverError.value = null
    updatePopoverPosition()
  })()
}
function openMemberDetail (member: TaskDetailMember, event: Event) {
  void (async () => {
    if (!task.value) return
    // await 後は event.currentTarget が null になるため、先にアンカーを保持する
    const anchor = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : capturePopoverAnchor(event)
    if (!anchor) return
    if (
      activePopover.value === 'member-detail'
      && selectedMember.value?.id === member.id
    ) {
      await closePopover()
      return
    }
    if (activePopover.value != null && activePopover.value !== 'member-detail') {
      await closePopover()
      if (activePopover.value != null) return
    }
    selectedMember.value = member
    popoverAnchorEl.value = anchor
    activePopover.value = 'member-detail'
    popoverError.value = null
    updatePopoverPosition()
  })()
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
  const requestTaskId = task.value.id
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
    assignees: sortMembersByDisplayName(
      isAssigned
        ? previousAssignees.filter(m => m.id !== member.id)
        : [...previousAssignees, member],
    ),
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { assignee_ids } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    task.value = { ...task.value, assignees: previousAssignees }
    popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      pickerMutationPending.value = false
    }
  }
}
function onPopoverEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (openAttachmentMenuId.value !== null) {
    event.stopPropagation()
    closeAttachmentMenu()
    return
  }
  if (!activePopover.value) return
  event.stopPropagation()
  closePopover()
}
watch(
  () => openAttachmentMenuId.value !== null,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onPopoverEscape)
      const onResize = () => closeAttachmentMenu()
      window.addEventListener('resize', onResize)
      removeAttachmentMenuResizeListener = () => window.removeEventListener('resize', onResize)
      return
    }
    removeAttachmentMenuResizeListener?.()
    removeAttachmentMenuResizeListener = null
    if (!activePopover.value) {
      document.removeEventListener('keydown', onPopoverEscape)
    }
  },
)
watch(activePopover, (open) => {
  if (open === 'checklist-add') {
    schedulePopoverInputFocus(() => checklistTitleInputRef.value)
  }
  if (open) {
    closeAttachmentMenu()
    document.addEventListener('keydown', onPopoverEscape)
    document.addEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    const onResize = () => updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
    updatePopoverPosition()
    requestAnimationFrame(() => refreshFocusTrap())
  } else {
    if (openAttachmentMenuId.value === null) {
      document.removeEventListener('keydown', onPopoverEscape)
    }
    document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
    requestAnimationFrame(() => refreshFocusTrap())
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
useOnUserProfileUpdated((detail) => {
  if (task.value?.assignees?.length) {
    const assignees = applyUserProfileToMembers(task.value.assignees, detail)
    if (assignees !== task.value.assignees) {
      task.value = { ...task.value, assignees }
    }
  }
  if (selectedMember.value) {
    selectedMember.value = applyUserProfileToMember(selectedMember.value, detail)
  }
  if ('avatar_url' in detail) {
    const next = new Set(avatarLoadFailedIds.value)
    next.delete(detail.id)
    avatarLoadFailedIds.value = next
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentEscape, true)
  resetOverlayBackdropClose()
  document.removeEventListener('keydown', onPopoverEscape)
  document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
  removePopoverResizeListener?.()
  removePopoverResizeListener = null
  removeAttachmentMenuResizeListener?.()
  removeAttachmentMenuResizeListener = null
  closeAttachmentMenu()
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
  adjustTextareaHeight(titleTextareaRef.value)
}
function adjustDescriptionTextareaHeight () {
  adjustTextareaHeight(descriptionTextareaRef.value)
}
async function onTitleBlur () {
  await saveTitle()
}
async function saveTitle () {
  if (!task.value || titleSaving.value) return
  const requestTaskId = task.value.id
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
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { title } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    titleDraft.value = task.value.title
    nextTick(() => adjustTitleTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    saveError.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      titleSaving.value = false
    }
  }
}
function openListPicker (event?: Event) {
  void (async () => {
    if (!task.value) return
    const fromEvent = event?.currentTarget
    const anchor = fromEvent instanceof HTMLElement
      ? fromEvent
      : listPickerBtnRef.value
    if (!(await beginPopoverOpen('list'))) return
    popoverAnchorEl.value = anchor
    activePopover.value = 'list'
    popoverError.value = null
    updatePopoverPosition()
  })()
}
function onAddChildTask () {
  if (!task.value?.is_parent_task || saving.value) return
  void closePopover()
  emit('add-child-task', {
    parentTaskId: task.value.id,
    listId: task.value.list_id ?? null,
  })
}
async function selectList (listId: number) {
  if (!task.value || listSaving.value || saving.value) return
  if (task.value.list_id === listId) return
  const requestTaskId = task.value.id
  armOverlayCloseGuard()
  listSaving.value = true
  popoverError.value = null
  const previousListId = task.value.list_id
  const previousSortOrder = task.value.sort_order
  task.value = {
    ...task.value,
    list_id: listId,
  }
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { list_id: listId } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    task.value = {
      ...task.value,
      list_id: previousListId,
      sort_order: previousSortOrder,
    }
    popoverError.value = e instanceof Error ? e.message : 'リストの更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      listSaving.value = false
    }
  }
}
function openLabelPicker (event?: Event) {
  void (async () => {
    if (!task.value) return
    const anchor = capturePopoverAnchor(event)
    if (!(await beginPopoverOpen('labels'))) return
    labelSearchQuery.value = ''
    popoverAnchorEl.value = anchor
    activePopover.value = 'labels'
    popoverError.value = null
    updatePopoverPosition()
  })()
}
function openChecklistPicker (event?: Event) {
  void (async () => {
    if (!task.value) return
    const anchor = capturePopoverAnchor(event)
    if (!(await beginPopoverOpen('checklist-add'))) return
    checklistTitleDraft.value = ''
    popoverAnchorEl.value = anchor
    activePopover.value = 'checklist-add'
    popoverError.value = null
    updatePopoverPosition()
    schedulePopoverInputFocus(() => checklistTitleInputRef.value)
  })()
}
function openHierarchyPopover (event?: Event) {
  void (async () => {
    if (!task.value) return
    const anchor = capturePopoverAnchor(event)
    if (!(await beginPopoverOpen('hierarchy'))) return
    popoverAnchorEl.value = anchor
    activePopover.value = 'hierarchy'
    popoverError.value = null
    updatePopoverPosition()
  })()
}
async function openParentTaskPicker (event?: Event) {
  if (!task.value || parentSaving.value) return
  const fromEvent = event?.currentTarget
  const anchor = fromEvent instanceof HTMLElement
    ? fromEvent
    : null
  if (!(await beginPopoverOpen('parent-task'))) return
  popoverAnchorEl.value = anchor
  activePopover.value = 'parent-task'
  popoverError.value = null
  updatePopoverPosition()
  if (parentTasks.value.length === 0 && !parentTasksLoading.value) {
    await fetchParentTasks()
    if (activePopover.value === 'parent-task') {
      updatePopoverPosition()
    }
  }
}
async function persistParentTaskId (parentTaskId: number | null) {
  if (!task.value || parentSaving.value || saving.value) return
  if ((task.value.parent_task_id ?? null) === parentTaskId) {
    return
  }
  const requestTaskId = task.value.id
  armOverlayCloseGuard()
  parentSaving.value = true
  popoverError.value = null
  const previousParentTaskId = task.value.parent_task_id ?? null
  const previousParentTask = task.value.parent_task ?? null
  const previousIsParentTask = Boolean(task.value.is_parent_task)
  const selectedParent = parentTaskId != null
    ? selectableParentTasks.value.find(item => item.id === parentTaskId) ?? null
    : null
  task.value = {
    ...task.value,
    parent_task_id: parentTaskId,
    parent_task: selectedParent
      ? { id: selectedParent.id, title: selectedParent.title }
      : null,
    is_parent_task: false,
  }
  await nextTick()
  if (activePopover.value === 'parent-task') {
    popoverAnchorEl.value = parentTaskLabelBtnRef.value
    updatePopoverPosition()
  }
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { parent_task_id: parentTaskId } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
    await nextTick()
    if (activePopover.value === 'parent-task') {
      popoverAnchorEl.value = parentTaskLabelBtnRef.value
      updatePopoverPosition()
    }
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    task.value = {
      ...task.value,
      parent_task_id: previousParentTaskId,
      parent_task: previousParentTask,
      is_parent_task: previousIsParentTask,
    }
    popoverError.value = e instanceof Error ? e.message : '親タスクの更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      parentSaving.value = false
    }
  }
}
function selectParentTask (parentTaskId: number) {
  void persistParentTaskId(parentTaskId)
}
function clearParentTask () {
  void persistParentTaskId(null)
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
function submitChecklistAdd () {
  if (!task.value) return
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
  if (!task.value) return
  void saveChecklists(checklists.value.map(item => (
    item.id === checklistId ? { ...nextChecklist, id: checklistId } : item
  )))
}
function deleteChecklist (checklistId: number) {
  if (!task.value) return
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
  const requestTaskId = task.value.id
  const rollback = lastPersistedChecklists
  const openTempId = checklistAddFormOpenId.value
  const seq = ++checklistSaveSeq
  checklistSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { checklists: checklistPayloadForApi(next) } },
    )
    if (seq !== checklistSaveSeq || !isStillShowingTask(requestTaskId)) return
    checklists.value = updated.checklists ?? []
    lastPersistedChecklists = checklists.value
    if (openTempId != null && openTempId < 0) {
      const openIndex = next.findIndex(item => item.id === openTempId)
      const persisted = checklists.value[openIndex]
      checklistAddFormOpenId.value = persisted?.id ?? null
    }
    if (task.value) {
      emit('updated', { ...task.value, checklists: checklists.value })
    }
  } catch (e: unknown) {
    if (seq !== checklistSaveSeq || !isStillShowingTask(requestTaskId)) return
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
  const requestTaskId = task.value.id
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
    labels: sortLabelsByCatalogOrder(
      isSelected
        ? previousLabels.filter(item => item.id !== label.id)
        : [...previousLabels, label],
      props.orgLabels,
    ),
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { label_ids } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    task.value = { ...task.value, labels: previousLabels }
    popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      pickerMutationPending.value = false
    }
  }
}
async function onDescriptionBlur () {
  await saveDescription()
}
async function saveDescription () {
  if (!task.value || descriptionSaving.value) return
  const requestTaskId = task.value.id
  const description = descriptionDraft.value
  const normalized = description.trim() === '' ? null : description
  if ((normalized ?? '') === (task.value.description ?? '')) return
  descriptionSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${requestTaskId}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    if (!applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
    descriptionDraft.value = task.value.description ?? ''
    nextTick(() => adjustDescriptionTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    if (!isStillShowingTask(requestTaskId)) return
    saveError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
  } finally {
    if (isStillShowingTask(requestTaskId) || props.taskId === requestTaskId) {
      descriptionSaving.value = false
    }
  }
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/TaskDetailModal.scss"></style>
