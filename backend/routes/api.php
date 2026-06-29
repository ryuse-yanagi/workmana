<?php

use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\WorkspaceController;
use App\Http\Controllers\Api\ListController;
use App\Http\Controllers\Api\WorkspaceLabelController;
use App\Http\Controllers\Api\WorkspaceLabelCategoryController;
use App\Http\Controllers\Api\TaskLabelController;
use App\Http\Controllers\Api\TaskLabelCategoryController;
use App\Http\Controllers\Api\SharedDocumentController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TaskCommentController;
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
        Route::get('/workspace-label-categories', [WorkspaceLabelCategoryController::class, 'index']);
        Route::post('/workspace-label-categories', [WorkspaceLabelCategoryController::class, 'store']);
        Route::patch('/workspace-label-categories/{category}', [WorkspaceLabelCategoryController::class, 'update']);
        Route::delete('/workspace-label-categories/{category}', [WorkspaceLabelCategoryController::class, 'destroy']);
        Route::get('/workspace-labels', [WorkspaceLabelController::class, 'index']);
        Route::post('/workspace-labels', [WorkspaceLabelController::class, 'store']);
        Route::patch('/workspace-labels/{workspaceLabel}', [WorkspaceLabelController::class, 'update']);
        Route::delete('/workspace-labels/{workspaceLabel}', [WorkspaceLabelController::class, 'destroy']);
        Route::get('/task-label-categories', [TaskLabelCategoryController::class, 'index']);
        Route::post('/task-label-categories', [TaskLabelCategoryController::class, 'store']);
        Route::patch('/task-label-categories/{category}', [TaskLabelCategoryController::class, 'update']);
        Route::delete('/task-label-categories/{category}', [TaskLabelCategoryController::class, 'destroy']);
        Route::get('/task-labels', [TaskLabelController::class, 'index']);
        Route::post('/task-labels', [TaskLabelController::class, 'store']);
        Route::patch('/task-labels/{taskLabel}', [TaskLabelController::class, 'update']);
        Route::delete('/task-labels/{taskLabel}', [TaskLabelController::class, 'destroy']);

        Route::get('/workspaces', [WorkspaceController::class, 'index']);
        Route::post('/workspaces', [WorkspaceController::class, 'store']);
        Route::get('/documents', [SharedDocumentController::class, 'index']);
        Route::get('/workspaces/{workspace}/members', [WorkspaceController::class, 'members']);
        Route::get('/workspaces/{workspace}', [WorkspaceController::class, 'show']);
        Route::patch('/workspaces/{workspace}', [WorkspaceController::class, 'update']);
        Route::patch('/workspaces/{workspace}/archive', [WorkspaceController::class, 'archive']);
        Route::delete('/workspaces/{workspace}', [WorkspaceController::class, 'destroy']);

        Route::get('/workspaces/{workspace}/lists', [ListController::class, 'index']);
        Route::post('/workspaces/{workspace}/lists', [ListController::class, 'store']);
        Route::patch('/workspaces/{workspace}/lists/reorder', [ListController::class, 'reorder']);
        Route::patch('/workspaces/{workspace}/lists/{boardList}', [ListController::class, 'update']);
        Route::patch('/workspaces/{workspace}/lists/{boardList}/tasks/reorder', [ListController::class, 'reorderTasks']);
        Route::delete('/workspaces/{workspace}/lists/{boardList}', [ListController::class, 'destroy']);

        Route::get('/workspaces/{workspace}/tasks', [TaskController::class, 'index']);
        Route::get('/workspaces/{workspace}/tasks/parents', [TaskController::class, 'parentTasksIndex']);
        Route::get('/workspaces/{workspace}/tasks/comments', [TaskCommentController::class, 'workspaceIndex']);
        Route::get('/workspaces/{workspace}/tasks/table', [TaskController::class, 'tableIndex']);
        Route::patch('/workspaces/{workspace}/tasks/table/orphan-parent-label', [TaskController::class, 'tableUpdateOrphanParentLabel']);
        Route::patch('/workspaces/{workspace}/tasks/table/reorder', [TaskController::class, 'tableReorder']);
        Route::get('/workspaces/{workspace}/tasks/archived', [TaskController::class, 'archivedIndex']);
        Route::post('/workspaces/{workspace}/tasks', [TaskController::class, 'store']);
        Route::get('/workspaces/{workspace}/tasks/{task}', [TaskController::class, 'show']);
        Route::patch('/workspaces/{workspace}/tasks/{task}', [TaskController::class, 'update']);
        Route::post('/workspaces/{workspace}/tasks/{task}/archive', [TaskController::class, 'archive']);
        Route::post('/workspaces/{workspace}/tasks/{task}/unarchive', [TaskController::class, 'unarchive']);
        Route::delete('/workspaces/{workspace}/tasks/{task}', [TaskController::class, 'destroy']);

        Route::get('/workspaces/{workspace}/tasks/{task}/comments', [TaskCommentController::class, 'index']);
        Route::post('/workspaces/{workspace}/tasks/{task}/comments', [TaskCommentController::class, 'store']);
        Route::patch('/workspaces/{workspace}/tasks/{task}/comments/{comment}', [TaskCommentController::class, 'update']);
        Route::delete('/workspaces/{workspace}/tasks/{task}/comments/{comment}', [TaskCommentController::class, 'destroy']);
        Route::post('/workspaces/{workspace}/tasks/{task}/comments/{comment}/reactions', [TaskCommentController::class, 'toggleReaction']);
    });
});
