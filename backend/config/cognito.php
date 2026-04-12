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

    'audience' => env('COGNITO_AUDIENCE'),

    /*
    | ローカル・テストのみ: true のとき、検証をスキップして Bearer トークンを
    | 「テスト用ユーザー ID」として解釈します（本番では必ず false）。
    */
    'bypass' => env('COGNITO_BYPASS', false),

    'bypass_user_id' => env('COGNITO_BYPASS_USER_ID'),

];
