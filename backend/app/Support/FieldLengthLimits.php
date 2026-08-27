<?php

namespace App\Support;

final class FieldLengthLimits
{
    public const USER_NAME = 20;

    public const EMAIL = 255;

    public const PASSWORD = 255;

    public const ORGANIZATION_NAME = 255;

    public const ORGANIZATION_SLUG = 100;

    public const TASK_TITLE = 100;

    public const LABEL_NAME = 30;

    public const LABEL_CATEGORY_NAME = 40;

    public const LIST_NAME = 40;

    public const WORKSPACE_NAME = 30;

    public const DOCUMENT_NAME = 30;

    public const CHECKLIST_TITLE = 30;

    public const CHECKLIST_ITEM_TEXT = 2000;

    public const COMMENT_BODY = 100;

    /** タスク・スペース・資料の説明で共通 */
    public const TASK_DESCRIPTION = 5000;

    public const DOCUMENT_BODY = 50000;

    /** 組織設定の既定リスト／ステータス／カテゴリ名 */
    public const DEFAULT_NAMED_ITEM_NAME = 255;

    public const REQUIRED_TEXT_MIN = 1;

    public const PASSWORD_MIN = 8;

    public static function requiredLengthMessage(string $label, int $max, int $min = self::REQUIRED_TEXT_MIN): string
    {
        return $label.'は'.$min.'文字以上'.$max.'文字以下で入力してください';
    }
}
