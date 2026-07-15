<?php

use App\Support\LabelColorPresets;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_label_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 40);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'sort_order']);
        });

        Schema::create('document_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('document_label_categories')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 40);
            $table->unsignedTinyInteger('color_index')->default(LabelColorPresets::DEFAULT_INDEX);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['category_id', 'name']);
            $table->index(['organization_id', 'created_at']);
            $table->index(['category_id', 'sort_order']);
        });

        Schema::create('shared_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('category', 255)->nullable();
            $table->string('name', 100);
            $table->timestamps();
            $table->index(['organization_id', 'created_at']);
        });

        Schema::create('document_document_label', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shared_document_id')->constrained('shared_documents')->cascadeOnDelete();
            $table->foreignId('document_label_id')->constrained('document_labels')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['shared_document_id', 'document_label_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_document_label');
        Schema::dropIfExists('shared_documents');
        Schema::dropIfExists('document_labels');
        Schema::dropIfExists('document_label_categories');
    }
};
