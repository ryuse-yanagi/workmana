<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->json('default_document_category_names')->nullable()->after('default_workspace_status_names');
        });

        if (Schema::hasTable('document_categories')) {
            Schema::table('shared_documents', function (Blueprint $table) {
                if (Schema::hasColumn('shared_documents', 'category_id')) {
                    $table->dropConstrainedForeignId('category_id');
                }
                if (! Schema::hasColumn('shared_documents', 'category')) {
                    $table->string('category', 255)->nullable()->after('created_by');
                }
            });

            Schema::dropIfExists('document_categories');
        }
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('default_document_category_names');
        });
    }
};
