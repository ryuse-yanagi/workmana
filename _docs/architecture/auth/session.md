# 認証の信頼境界

誰であるかの決め方。ログイン操作の手順は [`../../application/features/auth.md`](../../application/features/auth.md)。何を見てよいかは [authorization.md](./authorization.md)。

## ブラウザが持つもの

HttpOnly のセッション Cookie だけ。ID トークンも Refresh トークンも `localStorage` にも JS から読める Cookie にも置かない。フロントは JWT をデコードしない。ユーザー情報は `GET /api/auth/session` と `GET /api/me` の JSON から取る。

Cognito の client id と redirect URI はバックエンドの設定だけが持つ。

## サーバーが持つもの

認可コードフロー（PKCE）は Laravel が完結させる。

1. `GET /api/auth/login` が `state`（40 文字）と PKCE verifier（`random_bytes(64)`）をセッションに置き、Hosted UI へリダイレクトする。challenge は S256。認可 URL には `prompt=login` を付ける。`login_hint` がメールアドレスなら同じ URL に載せ、Hosted UI の入力欄へ出す。メールでなければ捨てる
2. `GET /api/auth/callback` が `state` を `hash_equals` で検証し、verifier をセッションから消してコードをトークンに交換する
3. ID トークンの署名・`iss`・`aud`・`token_use=id`・期限を JWKS で検証し、`users` を同期する。JWKS は 1 時間キャッシュする
4. セッション ID を再生成して Cookie を発行する
5. 以降の API は `AuthenticateCognito` がセッションからユーザーを解決する。Cognito セッションでは `Authorization` ヘッダーを見ない。期限切れなら Refresh を試し、返った ID トークンを再検証する。`sub` がセッションのユーザーと違えば拒否し、検証に失敗したらセッションを破棄する
6. ログアウトは Cognito の refresh token revoke を試したあと、成否にかかわらずローカルセッションを破棄し CSRF トークンを再生成する

`email_verified` が真でない ID トークンは同期しない。メールが一致しても、別の `cognito_sub` が既に付いているユーザーは上書きしない。ログイン後の `next` は `/` で始まるパスだけ許可する。`//` と `/\` で始まる値は外部オリジンとして解釈されるため拒否し、既定の戻り先にする。

通常の API 認証に Bearer は使わない。CORS は `CORS_ALLOWED_ORIGINS`（未設定時は `FRONTEND_URL`）のオリジンだけを許し、`supports_credentials` は true。本番起動時は [`ProductionConfigValidator`](../../../backend/app/Support/ProductionConfigValidator.php) が、セッション暗号化・Secure・HttpOnly、`SESSION_SAME_SITE` の `lax` または `none`、サーバー側セッション（`cookie` / `array` 不可）、バイパス無効、Cognito と CORS の HTTPS、コールバックが `APP_URL` の `/api/auth/callback` であることを要求する。項目は [../../deploy/production-env.md](../../deploy/production-env.md)。

トークンの置き場は `App\Support\Auth\CognitoSession`。解決は `CognitoSessionAuthenticator`。

## CSRF

API でもセッションを使うため、`PreventRequestForgery` を API グループに掛けている。フロントは `GET /api/auth/csrf-cookie` で `XSRF-TOKEN` を受け取り、更新系で `X-XSRF-TOKEN` を送る。

## ローカルバイパス

`COGNITO_BYPASS=true` かつ `COGNITO_BYPASS_USER_ID` があるとき、Cookie セッションなしでそのユーザーとして扱う。`COGNITO_BYPASS_USER_ID` が空のときだけ、Bearer の数値ユーザー ID を使う。本番起動時は `ProductionConfigValidator` がバイパスを拒否する。

## 画面のログイン確認

`auth.global.ts` は `/org/`、`/post-login`、`/organizations/` について、クライアントだけでセッションを確認し、未ログインなら `/login` へ戻す。SSR では判定しない。この確認は画面遷移用で、API の認可は `cognito` ミドルウェアが正本である。

## タブ

`plugins/auth-tab-sync.client.ts` がログイン状態の変化をタブ間で揃える。組織の切替自体は `PUT /api/me/current-organization` が `users.last_organization_id` を更新する。
