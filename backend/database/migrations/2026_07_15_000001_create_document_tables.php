<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shared_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('category', 255)->nullable();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->longText('body')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['organization_id', 'created_at']);
            $table->index(['organization_id', 'deleted_at', 'archived_at']);
            $table->index(['workspace_id', 'deleted_at', 'archived_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shared_documents');
    }
};
