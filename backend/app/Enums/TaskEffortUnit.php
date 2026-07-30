<?php

namespace App\Enums;

enum TaskEffortUnit: string
{
    case Hour = 'hour';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
