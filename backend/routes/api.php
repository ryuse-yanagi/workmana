<?php

use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ListController;
use App\Http\Controllers\Api\ProjectLabelController;
use App\Http\Controllers\Api\TaskLabelController;
use App\Http\Controllers\Api\TaskCommentController;
use App\Http\Controllers\Api\TaskController;
use Illuminate\Support\Facades\Route;

Route::middleware(['cognito'])->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me', [MeController::class, 'update']);
    Route::post('/me/avatar', [MeController::class, 'uploadAvatar']);
    Route::delete('/me/avatar', [MeController::class, 'deleteAvatar']);
    Route::get('/organizations', [OrganizationController::class, 'index']);
    Route::post('/organizations', [OrganizationController::class, 'store']);

    Route::prefix('orgs/{organization}')->middleware('org.member')->group(function () {
        Route::get('/settings', [OrganizationController::class, 'settings']);
        Route::patch('/settings', [OrganizationController::class, 'updateSettings']);
        Route::get('/project-labels', [ProjectLabelController::class, 'index']);
        Route::post('/project-labels', [ProjectLabelController::class, 'store']);
        Route::get('/task-labels', [TaskLabelController::class, 'index']);
        Route::post('/task-labels', [TaskLabelController::class, 'store']);

        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::patch('/projects/{project}', [ProjectController::class, 'update']);
        Route::patch('/projects/{project}/archive', [ProjectController::class, 'archive']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

        Route::get('/projects/{project}/lists', [ListController::class, 'index']);
        Route::post('/projects/{project}/lists', [ListController::class, 'store']);
        Route::patch('/projects/{project}/lists/{boardList}', [ListController::class, 'update']);
        Route::delete('/projects/{project}/lists/{boardList}', [ListController::class, 'destroy']);

        Route::get('/projects/{project}/tasks', [TaskController::class, 'index']);
        Route::get('/projects/{project}/tasks/archived', [TaskController::class, 'archivedIndex']);
        Route::post('/projects/{project}/tasks', [TaskController::class, 'store']);
        Route::get('/projects/{project}/tasks/{task}', [TaskController::class, 'show']);
        Route::patch('/projects/{project}/tasks/{task}', [TaskController::class, 'update']);
        Route::post('/projects/{project}/tasks/{task}/archive', [TaskController::class, 'archive']);
        Route::post('/projects/{project}/tasks/{task}/unarchive', [TaskController::class, 'unarchive']);
        Route::delete('/projects/{project}/tasks/{task}', [TaskController::class, 'destroy']);

        Route::get('/projects/{project}/tasks/{task}/comments', [TaskCommentController::class, 'index']);
        Route::post('/projects/{project}/tasks/{task}/comments', [TaskCommentController::class, 'store']);
    });
});
