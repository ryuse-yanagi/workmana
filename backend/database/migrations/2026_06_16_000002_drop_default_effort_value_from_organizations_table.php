<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('organizations', 'default_effort_value')) {
            return;
        }

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('default_effort_value');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->decimal('default_effort_value', 12, 4)->nullable()->after('effort_unit');
        });
    }
};
