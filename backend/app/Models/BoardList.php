<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BoardList extends Model
{
    protected $table = 'lists';

    protected $fillable = [
        'workspace_id',
        'name',
        'color_index',
        'sort_order',
    ];

    protected $casts = [
        'color_index' => 'integer',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'list_id');
    }
}
