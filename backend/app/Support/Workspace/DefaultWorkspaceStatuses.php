<?php

namespace App\Support\Workspace;

use App\Models\Organization\Organization;
use App\Models\Workspace\Workspace;
use App\Support\DefaultNamedColorItems;
use App\Support\FieldLengthLimits;
use App\Support\SharedJson;

class DefaultWorkspaceStatuses
{
    /**
     * 組織未設定時のフォールバック（正本: shared/default-named-color-items.json）。
     *
     * @return list<array{name: string, color_index: int}>
     */
    public static function defaultItems(): array
    {
        /** @var list<array{name: string, color_index: int}> $items */
        $items = SharedJson::load('default-named-color-items.json')['workspaceStatuses'];

        return $items;
    }

    /**
     * @return list<array{name: string, color_index: int}>
     */
    public static function itemsForOrganization(Organization $organization): array
    {
        $raw = $organization->default_workspace_status_names;

        return self::normalizeItems(is_array($raw) ? $raw : null);
    }

    /**
     * @return list<string>
     */
    public static function namesForOrganization(Organization $organization): array
    {
        return DefaultNamedColorItems::names(self::itemsForOrganization($organization));
    }

    /**
     * @param  list<mixed>|null  $raw
     * @return list<array{name: string, color_index: int}>
     */
    public static function normalizeItems(?array $raw): array
    {
        return DefaultNamedColorItems::normalize($raw, self::defaultItems(), FieldLengthLimits::WORKSPACE_STATUS_NAME);
    }

    /**
     * 組織のステータス設定に一致するときだけ名前と色を返す。
     *
     * @return array{name: string, color_index: int}|null
     */
    public static function resolvedStatusPayload(Workspace $workspace, Organization $organization): ?array
    {
        $status = $workspace->status;
        if (! is_string($status) || $status === '') {
            return null;
        }

        $items = self::itemsForOrganization($organization);
        if ($items === []) {
            return null;
        }

        return DefaultNamedColorItems::findItemByName($items, $status);
    }

    /** 空は許可し、組織のスペースステータス名に無い値は 422 にする。 */
    public static function validateStatusForOrganization(Organization $organization, ?string $status): ?string
    {
        if ($status === null || trim($status) === '') {
            return null;
        }

        $names = self::namesForOrganization($organization);
        $trimmed = trim($status);
        if ($names === [] || ! in_array($trimmed, $names, true)) {
            abort(422, 'Invalid workspace status for this organization.');
        }

        return $trimmed;
    }

    /**
     * 組織のステータス変更に合わせ、保存済み status をリネームし、消えた名前だけ null にする。
     *
     * @param  list<array{name: string, color_index: int}>  $oldItems
     * @param  list<array{name: string, color_index: int}>  $newItems
     */
    public static function syncWorkspaceStatusNames(
        Organization $organization,
        array $oldItems,
        array $newItems,
    ): void {
        $diff = DefaultNamedColorItems::diffNameChanges($oldItems, $newItems);
        DefaultNamedColorItems::syncStoredNames(
            Workspace::withTrashed()->where('organization_id', $organization->id),
            'status',
            $diff,
        );
    }
}
