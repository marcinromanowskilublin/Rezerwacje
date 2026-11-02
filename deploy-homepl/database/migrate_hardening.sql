SET @drop_page_views_updated_at = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'page_views_daily'
      AND COLUMN_NAME = 'updated_at'
  ),
  'ALTER TABLE `page_views_daily` DROP COLUMN `updated_at`',
  'SELECT 1'
);
PREPARE migration_stmt FROM @drop_page_views_updated_at;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @fix_booking_time_index = (
  SELECT CASE
    WHEN EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND INDEX_NAME = 'idx_booking_time'
        AND NON_UNIQUE = 0
    )
      THEN 'ALTER TABLE `bookings` DROP INDEX `idx_booking_time`, ADD INDEX `idx_booking_time` (`booking_date`, `start_time`, `status`)'
    WHEN NOT EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND INDEX_NAME = 'idx_booking_time'
    )
      THEN 'ALTER TABLE `bookings` ADD INDEX `idx_booking_time` (`booking_date`, `start_time`, `status`)'
    ELSE 'SELECT 1'
  END
);
PREPARE migration_stmt FROM @fix_booking_time_index;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
