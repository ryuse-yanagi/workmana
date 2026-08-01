<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('workspaces', 'visibility')) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_visibility_check');
            }

            Schema::table('workspaces', function (Blueprint $table) {
                $indexes = Schema::getIndexes('workspaces');
                foreach ($indexes as $index) {
                    $cols = $index['columns'] ?? [];
                    if ($cols === ['organization_id', 'visibility', 'deleted_at']) {
                        $table->dropIndex($index['name']);
                        break;
                    }
                }
                $table->dropColumn('visibility');
            });
        }

        Schema::dropIfExists('workspace_memberships');
    }

    public function down(): void
    {
        if (! Schema::hasTable('workspace_memberships')) {
            Schema::create('workspace_memberships', function (Blueprint $table) {
                $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('role', 32);
                $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->primary(['workspace_id', 'user_id']);
            });
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin','member'))");
            }
        }

        if (! Schema::hasColumn('workspaces', 'visibility')) {
            Schema::table('workspaces', function (Blueprint $table) {
                $table->string('visibility', 32)->default('organization')->after('status');
                $table->index(['organization_id', 'visibility', 'deleted_at']);
            });
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_visibility_check CHECK (visibility IN ('organization','restricted'))");
            }
        }
    }
};
