<?php

use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\MeController;
use App\Http\Controllers\Api\Document\DocumentController;
use App\Http\Controllers\Api\Notification\NotificationController;
use App\Http\Controllers\Api\Organization\InviteAcceptController;
use App\Http\Controllers\Api\Organization\OrganizationController;
use App\Http\Controllers\Api\Organization\OrganizationInviteController;
use App\Http\Controllers\Api\Task\TaskAttachmentController;
use App\Http\Controllers\Api\Task\TaskController;
use App\Http\Controllers\Api\Task\TaskLabelCategoryController;
use App\Http\Controllers\Api\Task\TaskLabelController;
use App\Http\Controllers\Api\Workspace\ListController;
use App\Http\Controllers\Api\Workspace\WorkspaceController;
use App\Http\Controllers\Api\Workspace\WorkspaceLabelCategoryController;
use App\Http\Controllers\Api\Workspace\WorkspaceLabelController;
use Illuminate\Support\Facades\Route;

Route::pattern('workspace', '[0-9]+');
Route::pattern('task', '[0-9]+');
Route::pattern('document', '[0-9]+');
Route::pattern('relatedDocument', '[0-9]+');
Route::pattern('relatedWorkspace', '[0-9]+');
Route::pattern('boardList', '[0-9]+');
Route::pattern('attachment', '[0-9]+');
Route::pattern('member', '[0-9]+');

/*
|--------------------------------------------------------------------------
| API Routes（プレフィックス: /api）
|--------------------------------------------------------------------------
|
| 認証まわりと招待の確認・受諾だけは未ログインでも叩ける。
| それ以外は cognito ミドルウェア（セッション Cookie）必須。
| 組織配下（/orgs/{organization}/...）はさらに org.member で所属チェックする。
|
*/

// =============================================================================
// 認証関連（Cognito Hosted UI + セッション Cookie）
// =============================================================================
// フロントは JWT を持たず、バックエンドがセッションを管理する。
// ログイン開始・コールバック・セッション確認は認証前に必要なため cognito の外。
Route::prefix('auth')->group(function () {
    Route::get('/csrf-cookie', [AuthController::class, 'csrfCookie']); // XSRF-TOKEN Cookie を発行（書き込み API の前に呼ぶ）
    Route::get('/session', [AuthController::class, 'session']);       // 認証状態・ユーザー情報（未認証でも 200）
    Route::get('/login', [AuthController::class, 'login']);           // Cognito Hosted UI へリダイレクト開始
    Route::get('/callback', [AuthController::class, 'callback']);     // Cognito からの認可コード受け取り・セッション確立
    Route::post('/register', [AuthController::class, 'register']);    // 組織なしのセルフサーブ登録
    Route::post('/logout', [AuthController::class, 'logout']);        // セッション破棄 + Hosted UI ログアウト URL 返却
});

// =============================================================================
// 招待関連（認証不要）
// =============================================================================
// メール等で受け取ったトークンで、招待内容の確認と受諾を行う。
Route::get('/invites/{token}', [InviteAcceptController::class, 'show']);
Route::post('/invites/{token}/accept', [InviteAcceptController::class, 'accept']);

// =============================================================================
// 認証必須 API（cognito ミドルウェア）
// =============================================================================
Route::middleware(['cognito'])->group(function () {

    // -------------------------------------------------------------------------
    // プロフィール関連（ログイン中ユーザー自身）
    // -------------------------------------------------------------------------
    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me', [MeController::class, 'update']);
    Route::post('/me/avatar', [MeController::class, 'uploadAvatar']);
    Route::delete('/me/avatar', [MeController::class, 'deleteAvatar']);
    Route::get('/me/current-organization', [MeController::class, 'currentOrganization']);
    Route::put('/me/current-organization', [MeController::class, 'switchOrganization']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // -------------------------------------------------------------------------
    // 組織の作成（組織スラッグ不要）
    // -------------------------------------------------------------------------
    // 所属一覧は /auth/session・/me の organizations で返すため、GET は持たない。
    Route::post('/organizations', [OrganizationController::class, 'store']);

    // -------------------------------------------------------------------------
    // 組織配下 API（/orgs/{organization}/...）
    // {organization} は ID または slug。org.member で所属メンバーのみ許可。
    // -------------------------------------------------------------------------
    Route::prefix('orgs/{organization}')->middleware('org.member')->group(function () {

        // =====================================================================
        // 組織メンバー・招待・設定
        // =====================================================================
        Route::get('/members', [OrganizationController::class, 'members']);
        Route::patch('/members/{member}', [OrganizationController::class, 'updateMember']);
        Route::delete('/members/{member}', [OrganizationController::class, 'removeMember']);
        Route::get('/invites', [OrganizationInviteController::class, 'index']);
        Route::post('/invites', [OrganizationInviteController::class, 'store']);
        Route::delete('/invites/{invite}', [OrganizationInviteController::class, 'destroy']);
        Route::get('/settings', [OrganizationController::class, 'settings']);
        Route::patch('/settings', [OrganizationController::class, 'updateSettings']);
        Route::post('/icon', [OrganizationController::class, 'uploadIcon']);
        Route::delete('/icon', [OrganizationController::class, 'deleteIcon']);

        // =====================================================================
        // ラベル関連
        // ---------------------------------------------------------------------
        // ラベルは「カテゴリ」と「ラベル本体」の2層。
        // 対象エンティティごとに同じ CRUD パターンが並ぶ:
        //   - workspace-*: スペースに付けるラベル
        //   - task-*:      タスクに付けるラベル
        // reorder は表示順の一括更新。{category}/{label} 付きルートより先に定義する。
        // =====================================================================

        // --- スペース用ラベル ---
        Route::get('/workspace-label-categories', [WorkspaceLabelCategoryController::class, 'index']);
        Route::post('/workspace-label-categories', [WorkspaceLabelCategoryController::class, 'store']);
        Route::patch('/workspace-label-categories/reorder', [WorkspaceLabelCategoryController::class, 'reorder']);
        Route::patch('/workspace-label-categories/{category}', [WorkspaceLabelCategoryController::class, 'update']);
        Route::delete('/workspace-label-categories/{category}', [WorkspaceLabelCategoryController::class, 'destroy']);
        Route::get('/workspace-labels', [WorkspaceLabelController::class, 'index']);
        Route::post('/workspace-labels', [WorkspaceLabelController::class, 'store']);
        Route::patch('/workspace-labels/reorder', [WorkspaceLabelController::class, 'reorder']);
        Route::patch('/workspace-labels/{workspaceLabel}', [WorkspaceLabelController::class, 'update']);
        Route::delete('/workspace-labels/{workspaceLabel}', [WorkspaceLabelController::class, 'destroy']);

        // --- タスク用ラベル ---
        Route::get('/task-label-categories', [TaskLabelCategoryController::class, 'index']);
        Route::post('/task-label-categories', [TaskLabelCategoryController::class, 'store']);
        Route::patch('/task-label-categories/reorder', [TaskLabelCategoryController::class, 'reorder']);
        Route::patch('/task-label-categories/{category}', [TaskLabelCategoryController::class, 'update']);
        Route::delete('/task-label-categories/{category}', [TaskLabelCategoryController::class, 'destroy']);
        Route::get('/task-labels', [TaskLabelController::class, 'index']);
        Route::post('/task-labels', [TaskLabelController::class, 'store']);
        Route::patch('/task-labels/reorder', [TaskLabelController::class, 'reorder']);
        Route::patch('/task-labels/{taskLabel}', [TaskLabelController::class, 'update']);
        Route::delete('/task-labels/{taskLabel}', [TaskLabelController::class, 'destroy']);

        // =====================================================================
        // スペース（ワークスペース）関連 — 一覧・作成
        // =====================================================================
        Route::get('/workspaces', [WorkspaceController::class, 'index']);
        Route::post('/workspaces', [WorkspaceController::class, 'store']);

        // =====================================================================
        // ドキュメント関連（組織共有ドキュメント）
        // =====================================================================
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::get('/documents/archived', [DocumentController::class, 'archivedIndex']);
        Route::post('/documents', [DocumentController::class, 'store']);
        Route::get('/documents/{document}', [DocumentController::class, 'show']);
        Route::patch('/documents/{document}', [DocumentController::class, 'update']);
        Route::post('/documents/{document}/archive', [DocumentController::class, 'archive']);
        Route::post('/documents/{document}/unarchive', [DocumentController::class, 'unarchive']);
        Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

        // =====================================================================
        // スペース関連 — 詳細・更新・関連付け・アーカイブ
        // =====================================================================
        Route::get('/workspaces/archived', [WorkspaceController::class, 'archivedIndex']);
        Route::get('/workspaces/{workspace}/members', [WorkspaceController::class, 'members']);
        Route::get('/workspaces/{workspace}/documents/archived', [DocumentController::class, 'workspaceArchivedIndex']);
        Route::get('/workspaces/{workspace}/documents', [DocumentController::class, 'workspaceIndex']);
        Route::post('/workspaces/{workspace}/documents', [DocumentController::class, 'storeForWorkspace']);
        Route::get('/workspaces/{workspace}', [WorkspaceController::class, 'show']);
        Route::patch('/workspaces/{workspace}', [WorkspaceController::class, 'update']);
        Route::post('/workspaces/{workspace}/archive', [WorkspaceController::class, 'archive']);
        Route::post('/workspaces/{workspace}/unarchive', [WorkspaceController::class, 'unarchive']);
        Route::post('/workspaces/{workspace}/pin', [WorkspaceController::class, 'pin']);
        Route::post('/workspaces/{workspace}/unpin', [WorkspaceController::class, 'unpin']);
        Route::delete('/workspaces/{workspace}', [WorkspaceController::class, 'destroy']);

        /**
         * ボードリストのCRUD・タスクの並び替え
         */
        Route::get('/workspaces/{workspace}/lists', [ListController::class, 'index']);
        Route::post('/workspaces/{workspace}/lists', [ListController::class, 'store']);
        Route::patch('/workspaces/{workspace}/lists/reorder', [ListController::class, 'reorder']);
        Route::patch('/workspaces/{workspace}/lists/{boardList}', [ListController::class, 'update']);
        Route::delete('/workspaces/{workspace}/lists/{boardList}', [ListController::class, 'destroy']);
        Route::patch('/workspaces/{workspace}/lists/{boardList}/tasks/reorder', [ListController::class, 'reorderTasks']);

        /**
         * タスク・親タスク・アーカイブの一覧取得
         */
        Route::get('/workspaces/{workspace}/tasks', [TaskController::class, 'index']);
        Route::get('/workspaces/{workspace}/tasks/parents', [TaskController::class, 'parentTasksIndex']);
        Route::get('/workspaces/{workspace}/tasks/archived', [TaskController::class, 'archivedIndex']);

        /**
         * WBSの一覧取得・並び替え
         */
        Route::get('/workspaces/{workspace}/tasks/wbs', [TaskController::class, 'wbsIndex']);
        Route::patch('/workspaces/{workspace}/tasks/wbs/reorder', [TaskController::class, 'wbsReorder']);
        Route::get('/workspaces/{workspace}/tasks/attachments', [TaskAttachmentController::class, 'workspaceIndex']);

        /**
         * タスクの作成・詳細・更新・アーカイブ・復元・削除
         */
        Route::post('/workspaces/{workspace}/tasks', [TaskController::class, 'store']);
        Route::get('/workspaces/{workspace}/tasks/{task}', [TaskController::class, 'show']);
        Route::patch('/workspaces/{workspace}/tasks/{task}', [TaskController::class, 'update']);
        Route::post('/workspaces/{workspace}/tasks/{task}/archive', [TaskController::class, 'archive']);
        Route::post('/workspaces/{workspace}/tasks/{task}/unarchive', [TaskController::class, 'unarchive']);
        Route::delete('/workspaces/{workspace}/tasks/{task}', [TaskController::class, 'destroy']);

        Route::get('/workspaces/{workspace}/tasks/{task}/attachments', [TaskAttachmentController::class, 'index']);
        Route::post('/workspaces/{workspace}/tasks/{task}/attachments', [TaskAttachmentController::class, 'store']);
        Route::get('/workspaces/{workspace}/tasks/{task}/attachments/{attachment}/download', [TaskAttachmentController::class, 'download']);
        Route::delete('/workspaces/{workspace}/tasks/{task}/attachments/{attachment}', [TaskAttachmentController::class, 'destroy']);
    });
});
