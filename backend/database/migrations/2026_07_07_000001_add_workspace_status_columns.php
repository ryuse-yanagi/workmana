<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->json('default_workspace_status_names')->nullable()->after('default_board_list_names');
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('status', 255)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('default_workspace_status_names');
        });
    }
};
