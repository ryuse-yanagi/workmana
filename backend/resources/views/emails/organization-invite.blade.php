{{ $organizationName }} へ招待されました。

以下の URL から登録を完了してください（有効期限: {{ $expiresAt->timezone(config('app.timezone'))->format('Y-m-d H:i') }}）。

{{ $inviteUrl }}

付与されるロール: {{ $role === 'admin' ? '管理者' : 'メンバー' }}

このメールに心当たりがない場合は破棄してください。
