<?php

namespace Database\Seeders;

use App\Models\DocumentLabel;
use App\Models\DocumentLabelCategory;
use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use App\Support\DefaultDocumentCategories;
use Illuminate\Database\Seeder;

class DocumentSeeder extends Seeder
{
    public function run (): void
    {
        $org = Organization::query()->where('slug', DummySeederData::ORG_SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.DummySeederData::ORG_SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $creator = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($creator === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        if ($org->default_document_category_names === null) {
            $org->default_document_category_names = DefaultDocumentCategories::seededItems();
            $org->save();
        }

        $this->seedDocumentLabels($org, $creator);
        $this->seedSharedDocument($org, $creator);
    }

    private function seedDocumentLabels (Organization $org, User $creator): void
    {
        $colorIndices = DummySeederData::LABEL_COLOR_INDICES;
        $globalLabelIndex = 0;
        $labelsByCategory = DummySeederData::documentLabelsByCategory();

        foreach (array_keys($labelsByCategory) as $categorySortOrder => $categoryName) {
            $category = DocumentLabelCategory::query()->firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name' => $categoryName,
                ],
                [
                    'created_by' => $creator->id,
                    'sort_order' => $categorySortOrder,
                ],
            );

            foreach ($labelsByCategory[$categoryName] as $labelSortOrder => $labelName) {
                DocumentLabel::query()->updateOrCreate(
                    [
                        'category_id' => $category->id,
                        'name' => $labelName,
                    ],
                    [
                        'organization_id' => $org->id,
                        'created_by' => $creator->id,
                        'color_index' => $colorIndices[$globalLabelIndex % count($colorIndices)],
                        'sort_order' => $labelSortOrder,
                    ],
                );
                $globalLabelIndex++;
            }
        }
    }

    private function seedSharedDocument (Organization $org, User $creator): void
    {
        SharedDocument::query()->updateOrCreate(
            [
                'organization_id' => $org->id,
                'name' => DummySeederData::DOCUMENT_NAME,
            ],
            [
                'created_by' => $creator->id,
                'description' => DummySeederData::DOCUMENT_DESCRIPTION,
                'category' => DummySeederData::DOCUMENT_CATEGORY,
            ],
        );
    }
}
