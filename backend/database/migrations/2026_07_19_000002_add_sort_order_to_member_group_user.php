<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('member_group_user')) {
            return;
        }

        if (Schema::hasColumn('member_group_user', 'sort_order')) {
            return;
        }

        Schema::table('member_group_user', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('user_id');
            $table->index(['member_group_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('member_group_user')) {
            return;
        }

        if (! Schema::hasColumn('member_group_user', 'sort_order')) {
            return;
        }

        Schema::table('member_group_user', function (Blueprint $table) {
            $table->dropIndex(['member_group_id', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
