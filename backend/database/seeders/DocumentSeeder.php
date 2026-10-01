<?php

namespace Database\Seeders;

use App\Models\Document\Document;
use App\Models\Organization\Organization;
use App\Models\User;
use App\Models\Workspace\Workspace;
use App\Support\Document\DefaultDocumentCategories;
use Illuminate\Database\Seeder;

class DocumentSeeder extends Seeder
{
    public function run(): void
    {
        $org = DummySeederData::seededOrganization();
        if ($org === null) {
            $this->command?->warn('Organization "'.DummySeederData::ORG_NAME.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $creator = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($creator === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        $workspace = Workspace::query()
            ->where('organization_id', $org->id)
            ->where('name', DummySeederData::WORKSPACE_NAME)
            ->first();
        if ($workspace === null) {
            $this->command?->warn('Workspace "'.DummySeederData::WORKSPACE_NAME.'" not found. Run WorkspaceSeeder first.');

            return;
        }

        if ($org->default_document_category_names === null) {
            $org->default_document_category_names = DefaultDocumentCategories::seededItems();
            $org->save();
        }

        $this->seedDocument($org, $workspace, $creator);
    }

    private function seedDocument(Organization $org, Workspace $workspace, User $creator): void
    {
        Document::query()->updateOrCreate(
            [
                'organization_id' => $org->id,
                'name' => DummySeederData::DOCUMENT_NAME,
            ],
            [
                'workspace_id' => $workspace->id,
                'created_by' => $creator->id,
                'description' => DummySeederData::DOCUMENT_DESCRIPTION,
                'category' => DummySeederData::DOCUMENT_CATEGORY,
                'body' => DummySeederData::DOCUMENT_BODY,
            ],
        );
    }
}
