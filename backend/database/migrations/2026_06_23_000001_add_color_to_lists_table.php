<?php

use App\Support\BoardListColors;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lists', function (Blueprint $table) {
            $table->string('color', 20)
                ->default(BoardListColors::DEFAULT)
                ->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('lists', function (Blueprint $table) {
            $table->dropColumn('color');
        });
    }
};
