SET @add_payments_checkout_url = IF(
  NOT EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payments'
      AND COLUMN_NAME = 'checkout_url'
  ),
  'ALTER TABLE `payments` ADD COLUMN `checkout_url` varchar(1024) DEFAULT NULL AFTER `external_payment_id`',
  'SELECT 1'
);
PREPARE migration_stmt FROM @add_payments_checkout_url;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
