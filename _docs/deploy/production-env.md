# 本番環境変数

`APP_ENV=production` で使う環境変数。欠けるか不正だと、起動時に [`ProductionConfigValidator`](../../backend/app/Support/ProductionConfigValidator.php) がアプリを止めるものが多い。

機密値（`APP_KEY`、`DB_PASSWORD`、`REVERB_APP_SECRET`、`COGNITO_CLIENT_SECRET` など）は Secrets Manager または SSM SecureString から ECS タスクへ注入する。SES / S3 / CloudWatch の AWS 認証はタスクロールを使う（`AWS_ACCESS_KEY_ID` は置かない）。

---

## バックエンド

### アプリ / セッション / CORS

| 変数 | 値 |
|------|-----|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | Laravel 暗号化キー |
| `APP_URL` | API の公開 URL（HTTPS） |
| `SESSION_DRIVER` | `database`（`cookie` / `array` 不可） |
| `SESSION_ENCRYPT` | `true` |
| `SESSION_SECURE_COOKIE` | `true` |
| `SESSION_HTTP_ONLY` | `true` |
| `SESSION_SAME_SITE` | `lax` または `none`（`strict` 不可。Cognito コールバックで Cookie が送られない） |
| `SESSION_DOMAIN` | フロントと API が別ホストのとき必須。共有親ドメイン（例: `.example.com`）。未設定だと SPA が `XSRF-TOKEN` を読めず、登録・招待受諾を含む書き込みが 419 になる。同一ホストなら空でよい |
| `CORS_ALLOWED_ORIGINS` | フロントの HTTPS オリジン（カンマ区切り可） |
| `FRONTEND_URL` | フロントの HTTPS オリジン |

### データベース

| 変数 | 値 |
|------|-----|
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | Aurora / RDS。`DB_URL` でまとめてもよい |
| `DB_SSLMODE` | `require` または `verify-full` を推奨 |
| `QUEUE_CONNECTION` | `database` |
| `CACHE_STORE` | `database` |

### Cognito

| 変数 | 値 |
|------|-----|
| `COGNITO_BYPASS` | `false` |
| `COGNITO_JWKS_URL` | HTTPS |
| `COGNITO_ISSUER` | HTTPS |
| `COGNITO_AUDIENCE` | `COGNITO_CLIENT_ID` と同じ |
| `COGNITO_DOMAIN` | Hosted UI の HTTPS URL |
| `COGNITO_CLIENT_ID` | アプリクライアント ID |
| `COGNITO_REDIRECT_URI` | `APP_URL` と同じホストの `https://<api-host>/api/auth/callback`。Cognito の許可コールバックと一致。フロントホストにするとログインセッションが届かない |
| `COGNITO_LOGOUT_REDIRECT_URI` | フロントの `https://<app-host>/login` |
| `COGNITO_FRONTEND_URL` | ログイン後の戻り先と招待リンクのオリジン（HTTPS） |
| `COGNITO_CLIENT_SECRET` | 機密クライアントのときだけ。パブリッククライアントなら空 |
| `COGNITO_SCOPES` | 既定 `openid email profile` |
| `COGNITO_DEFAULT_REDIRECT_PATH` | 既定 `/post-login` |
| `COGNITO_USER_POOL_ID` | 必須。登録と招待受諾は AdminCreateUser でメール検証済み・本パスワードにする |
| `COGNITO_REGION` | 未設定時は `AWS_DEFAULT_REGION`。Admin API のリージョン |

### メール（SES）/ ストレージ（S3）

| 変数 | 値 |
|------|-----|
| `MAIL_MAILER` | `ses` または `ses-v2` |
| `MAIL_FROM_ADDRESS` | SES 検証済みの送信元（`hello@example.com` 不可） |
| `MAIL_FROM_NAME` | ユーザー名（任意） |
| `AWS_DEFAULT_REGION` | SES / S3 のリージョン |
| `FILESYSTEM_DISK` | `s3` |
| `AWS_BUCKET` | バケット名。アバター・組織アイコン・タスク添付が同じバケットに入る |
| `AWS_URL` | 任意。アバター／組織アイコンの公開 URL（CloudFront）。付ける場合は `avatars/*` と `org-icons/*` だけを配信する |

アップロードは ACL を送らない。バケットの「オブジェクト所有者」は Bucket owner enforced のままでよい。公開読み取りが必要なのは次のプレフィックスだけ。

- `avatars/*`
- `org-icons/*`

`tasks/*` は非公開のままにする。添付の取得は認証付き download API だけ。バケット全体を公開したり、CloudFront で全キーを配信したりしない。

### ログ（CloudWatch）

| 変数 | 値 |
|------|-----|
| `LOG_CHANNEL` | `stderr`（または `errorlog`、それらを含む `stack`） |
| `LOG_STDERR_FORMATTER` | `Monolog\Formatter\JsonFormatter`（任意） |

ECS タスク定義のログドライバは `awslogs`。

### Reverb

| 変数 | 値 |
|------|-----|
| `BROADCAST_CONNECTION` | `reverb` |
| `APP_RUNTIME` | `web`（nginx + php-fpm + Reverb 同一タスク）。API のみなら `http`、Reverb のみなら `reverb` |
| `REVERB_APP_ID` | アプリ ID |
| `REVERB_APP_KEY` | フロントの `NUXT_PUBLIC_REVERB_KEY` と一致 |
| `REVERB_APP_SECRET` | サーバーのみ |
| `REVERB_HOST` | ブラウザから見た公開ホスト名（`localhost` 不可） |
| `REVERB_PORT` | `443`（ALB 経由） |
| `REVERB_SCHEME` | `https` |
| `REVERB_BROADCAST_HOST` | 同一タスクなら `127.0.0.1`（`APP_RUNTIME=web` では entrypoint が既定） |
| `REVERB_BROADCAST_PORT` | `8080` |
| `REVERB_BROADCAST_SCHEME` | `http`（コンテナ内。外向けの `REVERB_SCHEME` とは分ける） |
| `REVERB_SERVER_HOST` | `0.0.0.0` |
| `REVERB_SERVER_PORT` | `8080` |

複数 Reverb タスクにするときだけ:

| 変数 | 値 |
|------|-----|
| `REVERB_SCALING_ENABLED` | `true` |
| `REDIS_HOST` または `REDIS_URL` | ElastiCache など（localhost 不可） |
| `REDIS_PASSWORD` | 設定している場合 |

ALB のアイドルタイムアウトは 90 秒以上（Reverb の ping は 60 秒）。

---

## フロントエンド

| 変数 | 値 |
|------|-----|
| `NUXT_PUBLIC_API_BASE_URL` | API の絶対 URL（`https://<api-host>/api`） |
| `NUXT_PUBLIC_REVERB_KEY` | `REVERB_APP_KEY` と同じ |
| `NUXT_PUBLIC_REVERB_HOST` | `REVERB_HOST` と同じ |
| `NUXT_PUBLIC_REVERB_PORT` | `443` |
| `NUXT_PUBLIC_REVERB_SCHEME` | `https` |

Cognito の設定はバックエンドのみ。

---

## 設定例

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.com
APP_KEY=

SESSION_DRIVER=database
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
SESSION_DOMAIN=.example.com

CORS_ALLOWED_ORIGINS=https://app.example.com
FRONTEND_URL=https://app.example.com

DB_CONNECTION=pgsql
DB_HOST=
DB_PORT=5432
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
DB_SSLMODE=require

COGNITO_BYPASS=false
COGNITO_JWKS_URL=https://cognito-idp.ap-northeast-1.amazonaws.com/<pool-id>/.well-known/jwks.json
COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/<pool-id>
COGNITO_AUDIENCE=
COGNITO_DOMAIN=https://<prefix>.auth.ap-northeast-1.amazoncognito.com
COGNITO_CLIENT_ID=
COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
COGNITO_REDIRECT_URI=https://api.example.com/api/auth/callback
COGNITO_LOGOUT_REDIRECT_URI=https://app.example.com/login
COGNITO_FRONTEND_URL=https://app.example.com

MAIL_MAILER=ses
MAIL_FROM_ADDRESS=noreply@example.com
AWS_DEFAULT_REGION=ap-northeast-1
FILESYSTEM_DISK=s3
AWS_BUCKET=

LOG_CHANNEL=stderr

BROADCAST_CONNECTION=reverb
APP_RUNTIME=web
REVERB_APP_ID=
REVERB_APP_KEY=
REVERB_APP_SECRET=
REVERB_HOST=api.example.com
REVERB_PORT=443
REVERB_SCHEME=https
```

```env
NUXT_PUBLIC_API_BASE_URL=https://api.example.com/api
NUXT_PUBLIC_REVERB_KEY=
NUXT_PUBLIC_REVERB_HOST=api.example.com
NUXT_PUBLIC_REVERB_PORT=443
NUXT_PUBLIC_REVERB_SCHEME=https
```
