<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invites', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->string('token_hash')->unique();
            $table->timestamp('expires_at');
            $table->foreignId('invited_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE invites ADD CONSTRAINT invites_role_check CHECK (role IN ('admin','project_leader','member','viewer'))");
        }
        if (in_array($driver, ['pgsql', 'sqlite'], true)) {
            DB::statement('CREATE UNIQUE INDEX invites_one_active_per_org_email ON invites (organization_id, email) WHERE revoked_at IS NULL AND used_at IS NULL');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['pgsql', 'sqlite'], true)) {
            DB::statement('DROP INDEX IF EXISTS invites_one_active_per_org_email');
        }
        Schema::dropIfExists('invites');
    }
};
