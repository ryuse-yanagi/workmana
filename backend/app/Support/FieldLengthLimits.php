<?php

namespace App\Support;

final class FieldLengthLimits
{
    public const USER_NAME = 20;

    public const EMAIL = 255;

    public const PASSWORD = 255;

    public const ORGANIZATION_NAME = 20;

    public const ORGANIZATION_SLUG = 100;

    public const TASK_TITLE = 100;

    public const LABEL_NAME = 20;

    public const LABEL_CATEGORY_NAME = 20;

    public const LIST_NAME = 20;

    public const WORKSPACE_NAME = 20;

    public const DOCUMENT_NAME = 20;

    public const CHECKLIST_TITLE = 20;

    public const WORKSPACE_STATUS_NAME = 20;

    public const DOCUMENT_CATEGORY_NAME = 20;

    public const CHECKLIST_ITEM_TEXT = 2000;

    /** タスク・スペース・資料の説明で共通。 */
    public const TASK_DESCRIPTION = 5000;

    public const DOCUMENT_BODY = 50000;

    public const REQUIRED_TEXT_MIN = 1;

    public const PASSWORD_MIN = 8;

    public const DEFAULT_NAMED_ITEM_NAME = 20;

    /**
     * @var array<string, int>
     */
    private const SHARED_KEYS = [
        'USER_NAME' => self::USER_NAME,
        'EMAIL' => self::EMAIL,
        'PASSWORD' => self::PASSWORD,
        'ORGANIZATION_NAME' => self::ORGANIZATION_NAME,
        'ORGANIZATION_SLUG' => self::ORGANIZATION_SLUG,
        'TASK_TITLE' => self::TASK_TITLE,
        'LABEL_NAME' => self::LABEL_NAME,
        'LABEL_CATEGORY_NAME' => self::LABEL_CATEGORY_NAME,
        'LIST_NAME' => self::LIST_NAME,
        'WORKSPACE_NAME' => self::WORKSPACE_NAME,
        'DOCUMENT_NAME' => self::DOCUMENT_NAME,
        'DOCUMENT_BODY' => self::DOCUMENT_BODY,
        'CHECKLIST_TITLE' => self::CHECKLIST_TITLE,
        'WORKSPACE_STATUS_NAME' => self::WORKSPACE_STATUS_NAME,
        'DOCUMENT_CATEGORY_NAME' => self::DOCUMENT_CATEGORY_NAME,
        'CHECKLIST_ITEM_TEXT' => self::CHECKLIST_ITEM_TEXT,
        'TASK_DESCRIPTION' => self::TASK_DESCRIPTION,
        'REQUIRED_TEXT_MIN' => self::REQUIRED_TEXT_MIN,
        'PASSWORD_MIN' => self::PASSWORD_MIN,
        'DEFAULT_NAMED_ITEM_NAME' => self::DEFAULT_NAMED_ITEM_NAME,
    ];

    public static function requiredLengthMessage(string $label, int $max, int $min = self::REQUIRED_TEXT_MIN): string
    {
        return $label.'は'.$min.'文字以上'.$max.'文字以下で入力してください';
    }

    public static function assertMatchesSharedJson(): void
    {
        $json = SharedJson::load('field-length-limits.json');
        foreach (self::SHARED_KEYS as $key => $value) {
            if (! array_key_exists($key, $json)) {
                throw new \RuntimeException("Shared field-length-limits.json missing key: {$key}");
            }
            if ((int) $json[$key] !== $value) {
                throw new \RuntimeException(
                    "FieldLengthLimits::{$key} ({$value}) does not match shared/field-length-limits.json ({$json[$key]})"
                );
            }
        }
    }
}
