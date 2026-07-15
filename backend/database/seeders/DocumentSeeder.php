<?php

namespace Database\Seeders;

use App\Models\DocumentLabel;
use App\Models\DocumentLabelCategory;
use App\Models\Organization;
use App\Models\User;
use App\Support\DefaultDocumentCategories;
use Illuminate\Database\Seeder;

class DocumentSeeder extends Seeder
{
    /** @var list<string> */
    private const LABEL_CATEGORY_NAMES = ['dmy_ctg_doc_a', 'dmy_ctg_doc_b'];

    /**
     * @var list<array{category: string, name: string}>
     */
    private const DOCUMENT_LABELS = [
        ['category' => 'dmy_ctg_doc_a', 'name' => 'dmy_label_doc_a_1'],
        ['category' => 'dmy_ctg_doc_a', 'name' => 'dmy_label_doc_a_2'],
        ['category' => 'dmy_ctg_doc_b', 'name' => 'dmy_label_doc_b_1'],
        ['category' => 'dmy_ctg_doc_b', 'name' => 'dmy_label_doc_b_2'],
    ];

    /**
     * @var list<int>
     */
    private const LABEL_COLOR_INDICES = [8, 20, 6, 5];

    public function run (): void
    {
        $org = Organization::query()->where('slug', OrganizationSeeder::SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.OrganizationSeeder::SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $creator = User::query()->where('name', 'dmy_user_01')->first();
        if ($creator === null) {
            $this->command?->warn('dmy_user_01 not found. Run UserSeeder first.');

            return;
        }

        if ($org->default_document_category_names === null) {
            $org->default_document_category_names = DefaultDocumentCategories::DEFAULT_ITEMS;
            $org->save();
        }

        $this->seedDocumentLabels($org, $creator);
    }

    private function seedDocumentLabels (Organization $org, User $creator): void
    {
        $categoriesByName = [];

        foreach (self::LABEL_CATEGORY_NAMES as $sortOrder => $name) {
            $categoriesByName[$name] = DocumentLabelCategory::query()->firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name' => $name,
                ],
                [
                    'created_by' => $creator->id,
                    'sort_order' => $sortOrder,
                ],
            );
        }

        foreach (self::DOCUMENT_LABELS as $index => $definition) {
            $category = $categoriesByName[$definition['category']] ?? null;
            if ($category === null) {
                continue;
            }

            DocumentLabel::query()->updateOrCreate(
                [
                    'category_id' => $category->id,
                    'name' => $definition['name'],
                ],
                [
                    'organization_id' => $org->id,
                    'created_by' => $creator->id,
                    'color_index' => self::LABEL_COLOR_INDICES[$index],
                    'sort_order' => $index,
                ],
            );
        }
    }
}
