<?php

namespace App\Support\Label;

use App\Models\Organization\Organization;
use App\Models\Task\TaskLabel;
use App\Models\Task\TaskLabelCategory;
use App\Models\Workspace\WorkspaceLabel;
use App\Models\Workspace\WorkspaceLabelCategory;
use App\Support\Organization\OrganizationBroadcast;

final class LabelCatalogBroadcast
{
    public static function publishTask(Organization $organization): void
    {
        OrganizationBroadcast::send($organization, 'task_labels.updated', [
            'categories' => self::categories(
                TaskLabelCategory::query()
                    ->where('organization_id', $organization->id)
                    ->with(['labels' => fn ($query) => $query->orderBy('sort_order')->orderBy('name')])
                    ->orderBy('sort_order')
                    ->orderBy('name')
                    ->get(),
            ),
        ]);
    }

    public static function publishWorkspace(Organization $organization): void
    {
        OrganizationBroadcast::send($organization, 'workspace_labels.updated', [
            'categories' => self::categories(
                WorkspaceLabelCategory::query()
                    ->where('organization_id', $organization->id)
                    ->with(['labels' => fn ($query) => $query->orderBy('sort_order')->orderBy('name')])
                    ->orderBy('sort_order')
                    ->orderBy('name')
                    ->get(),
            ),
        ]);
    }

    /**
     * @param  iterable<int, TaskLabelCategory|WorkspaceLabelCategory>  $categories
     * @return list<array<string, mixed>>
     */
    private static function categories(iterable $categories): array
    {
        $payload = [];
        foreach ($categories as $category) {
            $payload[] = [
                'id' => (int) $category->id,
                'name' => $category->name,
                'sort_order' => (int) $category->sort_order,
                'labels' => $category->labels->map(fn (TaskLabel|WorkspaceLabel $label) => [
                    'id' => (int) $label->id,
                    'category_id' => (int) $label->category_id,
                    'name' => $label->name,
                    'color_index' => (int) $label->color_index,
                    'sort_order' => (int) $label->sort_order,
                    'created_at' => $label->created_at,
                ])->values()->all(),
            ];
        }

        return $payload;
    }
}
