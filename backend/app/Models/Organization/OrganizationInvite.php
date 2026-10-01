<?php

namespace App\Models\Organization;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationInvite extends Model
{
    protected $fillable = [
        'organization_id',
        'email',
        'role',
        'token',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isActive(): bool
    {
        return ! $this->isUsed() && ! $this->isExpired();
    }

    /** 照合前に前後の空白を除き、小文字へ揃える。 */
    public static function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    public static function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    /** token 列は SHA-256 なので、平文をハッシュしてから探す。 */
    public static function findByPlainToken(string $plainToken): ?self
    {
        if ($plainToken === '') {
            return null;
        }

        return self::query()
            ->where('token', self::hashToken($plainToken))
            ->first();
    }
}
