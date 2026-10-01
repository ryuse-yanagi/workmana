<?php

namespace App\Models\Workspace;

use App\Models\Task\Task;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BoardList extends Model
{
    /** ボード列モデルだが、テーブル名は lists のまま。 */
    protected $table = 'lists';

    /**
     * 更新時に親スペースの updated_at を進める。
     *
     * @var list<string>
     */
    protected $touches = ['workspace'];

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
