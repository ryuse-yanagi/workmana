<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::table('memberships')->where('role', 'leader')->update(['role' => 'member']);
        DB::table('workspace_memberships')->where('role', 'leader')->update(['role' => 'member']);
        DB::table('invites')->where('role', 'leader')->update(['role' => 'member']);

        DB::statement('ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check');
        DB::statement("ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('admin','member','viewer'))");

        DB::statement('ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check');
        DB::statement("ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin','member','viewer'))");

        DB::statement('ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_role_check');
        DB::statement("ALTER TABLE invites ADD CONSTRAINT invites_role_check CHECK (role IN ('admin','member','viewer'))");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check');
        DB::statement("ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('admin','leader','member','viewer'))");

        DB::statement('ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check');
        DB::statement("ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin','leader','member','viewer'))");

        DB::statement('ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_role_check');
        DB::statement("ALTER TABLE invites ADD CONSTRAINT invites_role_check CHECK (role IN ('admin','leader','member','viewer'))");
    }
};
