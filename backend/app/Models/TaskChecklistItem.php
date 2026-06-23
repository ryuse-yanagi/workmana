<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskChecklistItem extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'task_checklist_id',
        'text',
        'checked',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'checked' => 'boolean',
        ];
    }

    public function checklist(): BelongsTo
    {
        return $this->belongsTo(TaskChecklist::class, 'task_checklist_id');
    }
}
