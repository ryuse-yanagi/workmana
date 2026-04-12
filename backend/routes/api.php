<?php

use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\SectionController;
use App\Http\Controllers\Api\TaskCommentController;
use App\Http\Controllers\Api\TaskController;
use Illuminate\Support\Facades\Route;

Route::middleware(['cognito'])->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::get('/organizations', [OrganizationController::class, 'index']);
    Route::post('/organizations', [OrganizationController::class, 'store']);

    Route::prefix('orgs/{organization}')->middleware('org.member')->group(function () {
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::patch('/projects/{project}', [ProjectController::class, 'update']);
        Route::patch('/projects/{project}/archive', [ProjectController::class, 'archive']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

        Route::get('/projects/{project}/sections', [SectionController::class, 'index']);
        Route::post('/projects/{project}/sections', [SectionController::class, 'store']);
        Route::patch('/projects/{project}/sections/{section}', [SectionController::class, 'update']);
        Route::delete('/projects/{project}/sections/{section}', [SectionController::class, 'destroy']);

        Route::get('/projects/{project}/tasks', [TaskController::class, 'index']);
        Route::post('/projects/{project}/tasks', [TaskController::class, 'store']);
        Route::get('/projects/{project}/tasks/{task}', [TaskController::class, 'show']);
        Route::patch('/projects/{project}/tasks/{task}', [TaskController::class, 'update']);
        Route::delete('/projects/{project}/tasks/{task}', [TaskController::class, 'destroy']);

        Route::get('/projects/{project}/tasks/{task}/comments', [TaskCommentController::class, 'index']);
        Route::post('/projects/{project}/tasks/{task}/comments', [TaskCommentController::class, 'store']);
    });
});
