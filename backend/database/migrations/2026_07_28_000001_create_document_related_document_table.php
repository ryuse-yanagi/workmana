<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_related_document', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('shared_documents')->cascadeOnDelete();
            $table->foreignId('related_document_id')->constrained('shared_documents')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['document_id', 'related_document_id']);
            $table->index(['related_document_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_related_document');
    }
};
