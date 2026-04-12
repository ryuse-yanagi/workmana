<?php

namespace App\Enums;

enum MembershipRole: string
{
    case Admin = 'admin';
    case ProjectLeader = 'project_leader';
    case Member = 'member';
    case Viewer = 'viewer';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
