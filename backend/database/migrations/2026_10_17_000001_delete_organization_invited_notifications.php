<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_notifications')->where('type', 'organization.invited')->delete();
    }

    public function down(): void
    {
        // 招待の平文トークンは通知へ戻さない。
    }
};
