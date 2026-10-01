<?php

namespace Database\Seeders;

use App\Models\Organization\Organization;

class DummySeederData
{
    public const ORG_NAME = 'ABCDE';

    public const ADMIN_NAME = 'A';

    public const WORKSPACE_NAME = 'WorkMana';

    public const WORKSPACE_DESCRIPTION = 'WorkManaの設計・開発・テスト・リリースを管理する。';

    public const WORKSPACE_STATUS = '準備中';

    /** @var list<string> */
    public const WORKSPACE_ASSIGNEE_NAMES = ['A', 'B', 'C', 'D', 'E'];

    public const DOCUMENT_NAME = '【WorkMana】要件定義書';

    public const DOCUMENT_DESCRIPTION = 'WorkManaの機能要件および非機能要件をまとめた資料';

    public const DOCUMENT_CATEGORY = '仕様書';

    public const DOCUMENT_BODY = <<<'MD'
# 概要

WorkMana は、組織の中でスペース・タスク・資料を扱う業務管理アプリである。本書は画面と権限の要件をまとめる。

## 対象ユーザー

- 組織管理者: メンバー招待、組織設定、アーカイブと完全削除
- メンバー: スペースと資料の閲覧・編集。アーカイブ操作はできない

## 機能要件

### スペース

- 一覧からボードと WBS を開ける
- ステータス、担当者、ラベルを持てる
- サイドバーから、そのスペースの資料を作成できる

### タスク

- ボードのリストに必ず所属する
- 担当者、ラベル、期限、工数、チェックリストを持てる
- 親子は 1 階層まで

### 資料

- 1 つのスペースにだけ所属する
- 本文は Markdown で書き、閲覧時は HTML で表示する
- カテゴリは組織の資料カテゴリから選ぶ

## 非機能要件

- ログインは Cognito を使い、ブラウザはセッション Cookie だけを持つ
- ボードと WBS の更新は、同じスペースを開いている他のメンバーへ即時反映する
- タスクの添付ファイルは、認証済みのダウンロード以外では取得できない

## 対象外

- 資料の版管理と添付
- 資料本文のリアルタイム同時編集
MD;

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
            '担当部署' => ['開発部', '営業部', '総務部'],
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

    /**
     * 親タスクタイトル → 配置するボードリスト名。
     *
     * @return array<string, string>
     */
    public static function taskListNamesByParent(): array
    {
        return [
            'ログイン画面' => '未着手',
            'タスク一覧画面' => '進行中',
            '設定画面' => '完了',
        ];
    }

    public static function taskListNameForParent(string $parentTitle): string
    {
        return self::taskListNamesByParent()[$parentTitle]
            ?? throw new \InvalidArgumentException('Unknown parent task title: '.$parentTitle);
    }

    public static function seededOrganization(): ?Organization
    {
        return Organization::query()->where('name', self::ORG_NAME)->first();
    }
}
