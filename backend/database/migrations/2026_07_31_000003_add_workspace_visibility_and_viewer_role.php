<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('visibility', 32)->default('organization')->after('status');
            $table->index(['organization_id', 'visibility', 'deleted_at']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check');
            DB::statement("ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin','member','viewer'))");
            DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_visibility_check CHECK (visibility IN ('organization','restricted'))");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_visibility_check');
            DB::statement('ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check');
            DB::statement("ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin','member'))");
        }

        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'visibility', 'deleted_at']);
            $table->dropColumn('visibility');
        });
    }
};
