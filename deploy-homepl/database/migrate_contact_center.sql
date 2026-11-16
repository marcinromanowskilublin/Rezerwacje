CREATE TABLE IF NOT EXISTS `phone_threads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(50) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `contact_confidence` varchar(20) NOT NULL DEFAULT 'unknown',
  `contact_source` varchar(40) NOT NULL DEFAULT 'unknown',
  `last_call_at` datetime NOT NULL,
  `last_message_at` datetime DEFAULT NULL,
  `missed_count` int unsigned NOT NULL DEFAULT 1,
  `last_status` varchar(20) NOT NULL DEFAULT 'missed',
  `summary` varchar(500) NOT NULL DEFAULT '',
  `messages_preview` varchar(500) NOT NULL DEFAULT '',
  `unread_count` int unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone_threads_last_call` (`last_call_at`),
  KEY `idx_phone_threads_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone_thread_id` bigint unsigned NOT NULL,
  `direction` varchar(20) NOT NULL DEFAULT 'inbound',
  `message_type` varchar(30) NOT NULL DEFAULT 'note',
  `body_ciphertext` longblob DEFAULT NULL,
  `body_iv` varbinary(12) DEFAULT NULL,
  `body_tag` varbinary(16) DEFAULT NULL,
  `sent_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone_messages_thread_time` (`phone_thread_id`, `sent_at`, `id`),
  CONSTRAINT `fk_phone_messages_thread`
    FOREIGN KEY (`phone_thread_id`) REFERENCES `phone_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_intents` (
  `id` varchar(36) NOT NULL,
  `channel` varchar(20) NOT NULL DEFAULT 'manual',
  `source_id` varchar(80) DEFAULT NULL,
  `contact_label` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL DEFAULT '',
  `title` varchar(255) NOT NULL,
  `summary` text NOT NULL,
  `category` varchar(60) NOT NULL DEFAULT 'inna',
  `priority` varchar(20) NOT NULL DEFAULT 'normal',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `extracted_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_intents_status_time` (`status`, `extracted_at`),
  KEY `idx_contact_intents_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
