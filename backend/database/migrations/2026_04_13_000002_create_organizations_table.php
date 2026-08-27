<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('icon_path')->nullable();
            $table->json('default_board_list_names')->nullable();
            $table->json('default_workspace_status_names')->nullable();
            $table->json('default_document_category_names')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });

        // users.last_organization_id references organizations (users is created earlier).
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('last_organization_id')
                ->nullable()
                ->after('avatar_path')
                ->constrained('organizations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('last_organization_id');
        });
        Schema::dropIfExists('organizations');
    }
};
