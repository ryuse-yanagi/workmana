<?php

namespace Tests\Feature\Organizations;

use App\Support\DefaultWorkspaceStatuses;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefaultWorkspaceStatusItemsUseExpectedColorsTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_workspace_status_items_use_expected_colors(): void
    {
        $this->assertSame([
            ['name' => '準備中', 'color_index' => 1],
            ['name' => '稼働中', 'color_index' => 0],
            ['name' => '保留', 'color_index' => 3],
            ['name' => '完了', 'color_index' => 5],
        ], DefaultWorkspaceStatuses::DEFAULT_ITEMS);
    }
}
