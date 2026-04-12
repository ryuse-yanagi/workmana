<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_memberships', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->primary(['user_id', 'project_id']);
            $table->index(['project_id', 'role']);
            $table->index('user_id');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE project_memberships ADD CONSTRAINT project_memberships_role_check CHECK (role IN ('admin','project_leader','member','viewer'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_memberships');
    }
};
