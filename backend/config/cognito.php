<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Amazon Cognito (JWT)
    |--------------------------------------------------------------------------
    |
    | ID トークンまたはアクセストークンを検証するための設定です。
    | JWKS URL 例: https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
    | issuer 例: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
    |
    */

    'jwks_url' => env('COGNITO_JWKS_URL'),

    'issuer' => env('COGNITO_ISSUER'),

    // 必須。Cognito ID Token の aud（通常は app client ID）と常に照合する。
    'audience' => env('COGNITO_AUDIENCE'),

    /*
    |--------------------------------------------------------------------------
    | Hosted UI / OAuth 2.0 (Authorization Code + PKCE)
    |--------------------------------------------------------------------------
    |
    | 認可コードフローはバックエンドで完結させ、トークンはサーバー側セッション
    | にのみ保持します。ブラウザへ渡るのは HttpOnly のセッション Cookie だけです。
    |
    | domain 例: https://example.auth.ap-northeast-1.amazoncognito.com
    | redirect_uri はブラウザから見た URL（= フロントのオリジン配下の /api/auth/callback）
    | を指定し、Cognito アプリクライアントの許可コールバック URL にも登録します。
    |
    */

    'domain' => rtrim((string) env('COGNITO_DOMAIN', ''), '/'),

    'client_id' => (string) env('COGNITO_CLIENT_ID', ''),

    // パブリッククライアント（シークレットなし）の場合は空のままにします。
    'client_secret' => (string) env('COGNITO_CLIENT_SECRET', ''),

    'redirect_uri' => (string) env('COGNITO_REDIRECT_URI', ''),

    'logout_redirect_uri' => (string) env('COGNITO_LOGOUT_REDIRECT_URI', ''),

    'scopes' => array_values(array_filter(array_map(
        'trim',
        explode(' ', (string) env('COGNITO_SCOPES', 'openid email profile'))
    ))),

    /*
    |--------------------------------------------------------------------------
    | ログイン完了後のリダイレクト先
    |--------------------------------------------------------------------------
    |
    | コールバック処理後にブラウザを戻すフロントエンドのオリジンです。
    | オープンリダイレクトを避けるため、遷移先はこのオリジン配下に限定します。
    |
    */

    'frontend_url' => rtrim((string) env('COGNITO_FRONTEND_URL', env('FRONTEND_URL', 'http://localhost:3000')), '/'),

    'default_redirect_path' => (string) env('COGNITO_DEFAULT_REDIRECT_PATH', '/post-login'),

    /*
    | アクセストークンの残り有効期間がこの秒数を切ったらリフレッシュします。
    */
    'refresh_leeway' => (int) env('COGNITO_REFRESH_LEEWAY', 60),

    /*
    | ローカル・テストのみ: true のとき、検証をスキップして Bearer トークンを
    | 「テスト用ユーザー ID」として解釈します（本番では必ず false）。
    */
    'bypass' => env('COGNITO_BYPASS', false),

    'bypass_user_id' => env('COGNITO_BYPASS_USER_ID'),

    /*
    |--------------------------------------------------------------------------
    | User Pool（招待登録時のユーザー作成）
    |--------------------------------------------------------------------------
    |
    | region 例: ap-northeast-1
    | user_pool_id 例: ap-northeast-1_XXXXXXXXX
    | AdminCreateUser / AdminSetUserPassword / AdminConfirmSignUp に使用します。
    | 未設定かつ bypass=false の場合は、アプリクライアント向け SignUp API を使います。
    |
    */

    'region' => (string) env('COGNITO_REGION', env('AWS_DEFAULT_REGION', 'ap-northeast-1')),

    'user_pool_id' => (string) env('COGNITO_USER_POOL_ID', ''),

];
