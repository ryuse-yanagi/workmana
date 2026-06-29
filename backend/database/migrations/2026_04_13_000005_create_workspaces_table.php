<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('wbs_orphan_parent_label', 255)->nullable();
            $table->integer('wbs_orphan_parent_sort_order')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'deleted_at', 'archived_at']);
            $table->index(['organization_id', 'deleted_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspaces');
    }
};
