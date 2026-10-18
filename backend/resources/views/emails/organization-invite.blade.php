{{ $organizationName }} へ招待されました。

以下の URL から参加してください（有効期限: {{ $expiresAt->timezone(config('app.timezone'))->format('Y-m-d H:i') }}）。
アカウントが無い場合は、開いた画面から Cognito で登録できます。

{{ $inviteUrl }}

付与される権限: {{ $role === 'admin' ? '管理者' : '一般ユーザー' }}

このメールに心当たりがない場合は破棄してください。
