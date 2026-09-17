<?php

namespace App\Support;

use App\Enums\TaskPriority as TaskPriorityEnum;

final class TaskPriority
{
    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return TaskPriorityEnum::values();
    }
}
