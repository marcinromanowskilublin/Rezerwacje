DELIMITER //

CREATE PROCEDURE add_whatsapp_bot_column(IN column_name varchar(64), IN column_definition text)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'whatsapp_threads'
      AND COLUMN_NAME = column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `whatsapp_threads` ADD COLUMN ', column_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE add_whatsapp_bot_index()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'whatsapp_threads'
      AND INDEX_NAME = 'idx_whatsapp_threads_bot_due'
  ) THEN
    ALTER TABLE `whatsapp_threads`
      ADD KEY `idx_whatsapp_threads_bot_due` (`bot_next_action_at`, `bot_paused`, `bot_state`);
  END IF;
END//

DELIMITER ;

CALL add_whatsapp_bot_column('bot_state', "`bot_state` varchar(32) NOT NULL DEFAULT 'idle'");
CALL add_whatsapp_bot_column('bot_paused', "`bot_paused` tinyint(1) NOT NULL DEFAULT 0");
CALL add_whatsapp_bot_column('bot_last_auto_reply_at', "`bot_last_auto_reply_at` datetime DEFAULT NULL");
CALL add_whatsapp_bot_column('bot_next_action_at', "`bot_next_action_at` datetime DEFAULT NULL");
CALL add_whatsapp_bot_column('bot_data_ciphertext', "`bot_data_ciphertext` longblob DEFAULT NULL");
CALL add_whatsapp_bot_column('bot_data_iv', "`bot_data_iv` varbinary(12) DEFAULT NULL");
CALL add_whatsapp_bot_column('bot_data_tag', "`bot_data_tag` varbinary(16) DEFAULT NULL");
CALL add_whatsapp_bot_column('triage_summary_ciphertext', "`triage_summary_ciphertext` blob DEFAULT NULL");
CALL add_whatsapp_bot_column('triage_summary_iv', "`triage_summary_iv` varbinary(12) DEFAULT NULL");
CALL add_whatsapp_bot_column('triage_summary_tag', "`triage_summary_tag` varbinary(16) DEFAULT NULL");
CALL add_whatsapp_bot_column('requires_attention', "`requires_attention` tinyint(1) NOT NULL DEFAULT 0");
CALL add_whatsapp_bot_column('priority', "`priority` varchar(20) NOT NULL DEFAULT 'normal'");
CALL add_whatsapp_bot_index();

DROP PROCEDURE add_whatsapp_bot_index;
DROP PROCEDURE add_whatsapp_bot_column;
