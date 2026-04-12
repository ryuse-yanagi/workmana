<?php

namespace App\Enums;

enum TaskHistoryEventType: string
{
    case TaskCreated = 'task_created';
    case TaskUpdated = 'task_updated';
    case TaskDeleted = 'task_deleted';
    case StatusChanged = 'status_changed';
    case PriorityChanged = 'priority_changed';
    case AssigneeChanged = 'assignee_changed';
    case DueDateChanged = 'due_date_changed';
    case CommentAdded = 'comment_added';
    case CommentEdited = 'comment_edited';
    case CommentDeleted = 'comment_deleted';
}
