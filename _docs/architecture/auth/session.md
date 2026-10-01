# 認証の信頼境界

誰であるかの決め方。ログイン操作の手順は [`../../application/features/auth.md`](../../application/features/auth.md)。何を見てよいかは [authorization.md](./authorization.md)。

## ブラウザが持つもの

HttpOnly のセッション Cookie だけ。ID トークンも Refresh トークンも `localStorage` にも JS から読める Cookie にも置かない。フロントは JWT をデコードしない。ユーザー情報は `GET /api/auth/session` と `GET /api/me` の JSON から取る。

Cognito の client id と redirect URI はバックエンドの設定だけが持つ。

## サーバーが持つもの

認可コードフロー（PKCE）は Laravel が完結させる。

1. `GET /api/auth/login` が `state` と PKCE verifier をセッションに置き、Hosted UI へリダイレクトする
2. `GET /api/auth/callback` が `state` を検証し、コードをトークンに交換する
3. ID トークンの署名・`iss`・`aud`・`token_use=id`・期限を JWKS で検証し、`users` を同期する
4. セッション ID を再生成して Cookie を発行する
5. 以降の API は `AuthenticateCognito` がセッションからユーザーを解決する。期限切れなら Refresh を試し、検証に失敗したらセッションを破棄する
6. ログアウトは Cognito の revoke のあとローカルセッションを破棄する

`email_verified` が真でない ID トークンは同期しない。メールが一致しても、別の `cognito_sub` が既に付いているユーザーは上書きしない。ログイン後の `next` は同一オリジンの相対パスだけ許可する。

トークンの置き場は `App\Support\Auth\CognitoSession`。解決は `CognitoSessionAuthenticator`。

## CSRF

API でもセッションを使うため、`PreventRequestForgery` を API グループに掛けている。フロントは `GET /api/auth/csrf-cookie` で `XSRF-TOKEN` を受け取り、更新系で `X-XSRF-TOKEN` を送る。

## ローカルバイパス

`COGNITO_BYPASS=true` かつ `COGNITO_BYPASS_USER_ID` のとき、Cookie セッションなしでそのユーザーとして扱う。本番起動時は `ProductionConfigValidator` がバイパスを拒否する。

## タブ

`plugins/auth-tab-sync.client.ts` がログイン状態の変化をタブ間で揃える。組織の切替自体は `PUT /api/me/current-organization` が `users.last_organization_id` を更新する。
