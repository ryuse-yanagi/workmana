<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shared_documents', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('body');
            $table->softDeletes();
            $table->index(['organization_id', 'deleted_at', 'archived_at']);
        });
    }

    public function down(): void
    {
        Schema::table('shared_documents', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'deleted_at', 'archived_at']);
            $table->dropColumn(['archived_at', 'deleted_at']);
        });
    }
};
