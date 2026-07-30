<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_related_workspace', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('related_workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['workspace_id', 'related_workspace_id']);
            $table->index(['related_workspace_id']);
        });

        Schema::create('workspace_related_document', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('shared_document_id')->constrained('shared_documents')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['workspace_id', 'shared_document_id']);
            $table->index(['shared_document_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_related_document');
        Schema::dropIfExists('workspace_related_workspace');
    }
};
