<?php

use App\Support\BoardListColors;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name', 30);
            $table->unsignedTinyInteger('color_index')->default(BoardListColors::DEFAULT_INDEX);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'sort_order']);
        });

        Schema::create('member_group_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_group_id')->constrained('member_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['member_group_id', 'user_id']);
            $table->index(['member_group_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_group_user');
        Schema::dropIfExists('member_groups');
    }
};
