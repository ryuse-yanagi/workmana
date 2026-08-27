# プロフィール・アバター（Profile）

## 概要

認証ユーザー自身の **表示名** と **アバター画像** を管理する。専用ページはなく、グローバルヘッダーの「プロフィール設定」モーダルから操作する。メール変更・パスワード変更のアプリ内 UI はない（パスワードは Cognito Hosted UI 側）。

## 本書の範囲

- `GET/PATCH /me`、アバター upload／delete、ヘッダー反映

対象外: 認証 → [auth.md](./auth.md)、組織メンバー一覧での他ユーザー表示の詳細

---

## データモデル

`users.name`, `users.avatar_path`（`storage/app/public/avatars` 配下の相対パス）。  
API は `avatar_url`（相対パス `/storage/avatars/...`）を返す。フロントは Vite プロキシ（ローカル）または API オリジン（本番）へ解決して表示する。メールは参照のみ。

---

## API 要約

いずれも `cognito` 必須。常に `$request->user()`（他ユーザー指定不可）。

| Method | Path | 説明 |
| --- | --- | --- |
| `GET` | `/me` | ユーザー＋所属組織＋`avatar_url`＋`last_organization_id` |
| `PATCH` | `/me` | `name` のみ更新 |
| `POST` | `/me/avatar` | multipart `avatar`（最大 2048 KB）。旧ファイル置換 |
| `DELETE` | `/me/avatar` | path クリア＋ファイル削除 |

---

## フロント

- `ProfileSettingsModal.vue` … 氏名・ファイル選択／アップロード／削除
- `AppGlobalHeader.vue` … モーダル起動、アバターまたはイニシャル表示
- `useApi` / `resolveAvatarUrl` … `avatar_url` を表示可能な URL に正規化
- 更新後 `tm:user-profile-updated` CustomEvent でヘッダーを同期
- メンバー一覧等でも `MemberAvatar` 経由で表示

---

## 要件・ギャップ

- 要件は users 表以外にプロフィール詳細が薄い
- メール／パスワードのアプリ内変更なし
- `avatar_path` は schema-auth ドキュメントに未記載の場合あり（実装が正）

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/MeController.php`
- `frontend/app/components/modals/ProfileSettingsModal.vue`
- `frontend/app/components/app/AppGlobalHeader.vue`
