<?php

namespace App\Enums;

enum TaskEffortUnit: string
{
    case Minute = 'minute';
    case Hour = 'hour';
    case Day = 'day';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
