<?php

namespace Tests\Feature\Organizations;

use App\Support\DefaultDocumentCategories;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefaultDocumentCategoryItemsUseExpectedColorsTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_document_category_items_use_expected_colors(): void
    {
        $this->assertSame([
            ['name' => 'その他', 'color_index' => 5],
        ], DefaultDocumentCategories::defaultItems());
    }

    public function test_dummy_document_category_items_use_expected_colors(): void
    {
        $this->assertSame([
            ['name' => '仕様書', 'color_index' => 1],
            ['name' => '設計書', 'color_index' => 0],
            ['name' => 'マニュアル', 'color_index' => 2],
            ['name' => '議事録', 'color_index' => 3],
        ], DefaultDocumentCategories::DUMMY_ITEMS);
    }

    public function test_seeded_document_category_items_put_other_last(): void
    {
        $this->assertSame([
            ['name' => '仕様書', 'color_index' => 1],
            ['name' => '設計書', 'color_index' => 0],
            ['name' => 'マニュアル', 'color_index' => 2],
            ['name' => '議事録', 'color_index' => 3],
            ['name' => 'その他', 'color_index' => 5],
        ], DefaultDocumentCategories::seededItems());
    }
}
