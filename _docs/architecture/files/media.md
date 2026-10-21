# ファイル保存

アップロードの論理ディスク。バケットの公開設定や配信の前段は [../cloud/](../cloud/) に書く。

実装は `App\Support\MediaStorage` と `config/filesystems.php` の `public_media` / `private_media`。

| 種別 | ディスクの選び方 | 読み方 | 制限 |
| --- | --- | --- | --- |
| アバター | 公開（ローカル既定 `public`。`FILESYSTEM_DISK=s3` なら `s3-public`） | API が返す URL。ローカルは `/storage/avatars/...` | 画像、最大 2MB |
| 組織アイコン | 同上（`org-icons/`） | 同上 | 画像、最大 2MB |
| タスク添付 | 非公開（ローカル既定 `local`。s3 なら `s3-private`） | `GET .../attachments/{id}/download` のみ | 最大 10MB。許可した拡張子のみ |

`/storage` の直リンクでは新しいタスク添付を取れない。過去に `local` / `public` へ置いた添付は、download API が現行の非公開ディスク → `local` → `public` の順で探す。download は組織ユーザーかつスペースを閲覧できるユーザーに限る。タスクと添付の所属が違えば 404。

Content-Type はクライアント申告の MIME ではなく拡張子から決める。応答には `X-Content-Type-Options: nosniff` を付ける。インライン表示を許すのは画像、テキスト、PDF だけ。テキストのインライン表示には `Content-Security-Policy: default-src 'none'` を付ける。ダウンロードファイル名はパス区切りと改行を除いた元ファイル名にする。

削除は `PermanentDeleter` が DB 行とファイルの両方を片づける。URL 組み立ては `MediaUrl`。フロントの `useApi` は相対 URL を、いま向いている API ベースから読める形に直す。
