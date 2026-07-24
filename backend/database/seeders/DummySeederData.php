<?php

namespace Database\Seeders;

class DummySeederData
{
    public const ORG_SLUG = 'abcde';

    public const ORG_NAME = 'ABCDE';

    public const ADMIN_NAME = 'A';

    public const WORKSPACE_NAME = '業務管理アプリ';

    public const WORKSPACE_DESCRIPTION = '業務管理アプリの設計・開発・テスト・リリースを管理する。';

    public const WORKSPACE_STATUS = '準備中';

    /** @var list<string> */
    public const WORKSPACE_ASSIGNEE_NAMES = ['A', 'B', 'C', 'D', 'E'];

    public const DOCUMENT_NAME = '【業務管理アプリ】要件定義書';

    public const DOCUMENT_DESCRIPTION = '業務管理アプリの機能要件および非機能要件をまとめた資料';

    public const DOCUMENT_CATEGORY = '仕様書';

    /** @var list<int> */
    public const LABEL_COLOR_INDICES = [8, 20, 6, 5, 0, 1, 2, 3, 4, 7, 9];

    /**
     * @return list<string>
     */
    public static function userNames(): array
    {
        $names = [];
        for ($index = 0; $index < 20; $index++) {
            $names[] = chr(65 + $index);
        }

        return $names;
    }

    /**
     * @return array<string, list<string>>
     */
    public static function workspaceLabelsByCategory(): array
    {
        return [
            '優先度' => ['優先度：高', '優先度：中', '優先度：低'],
            '公開範囲' => ['社外共有', '機密'],
            '担当部署' => ['開発部', '営業部', '人事部', '総務部'],
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    public static function taskLabelsByCategory(): array
    {
        return [
            '担当分野' => ['フロントエンド', 'バックエンド', 'インフラ', 'デザイン'],
            '作業種別' => ['設計', '実装', 'テスト', 'レビュー', '資料作成'],
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    public static function documentLabelsByCategory(): array
    {
        return [
            '担当分野' => ['フロントエンド', 'バックエンド', 'API', 'インフラ'],
            '公開範囲' => ['社外共有', '機密'],
            '担当部署' => ['開発部', '営業部', '人事部', '総務部'],
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    public static function taskTree(): array
    {
        return [
            'ログイン画面' => [
                'UIデザイン実装',
                'ログイン処理実装',
                'バリデーション実装',
            ],
            'タスク一覧画面' => [
                'UIデザイン実装',
                '一覧表示実装',
                'フィルター機能実装',
                'ソート機能実装',
            ],
            '設定画面' => [
                'UIデザイン実装',
                'プロフィール設定実装',
                'ラベル設定実装',
            ],
        ];
    }
}
