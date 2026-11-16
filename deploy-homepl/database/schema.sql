CREATE TABLE IF NOT EXISTS `visit_types` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `duration_minutes` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'PLN',
  `payment_policy` enum('none','optional','required') NOT NULL DEFAULT 'optional',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `kind` enum('first','followup') NOT NULL DEFAULT 'followup',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `availability_rules` (
  `id` varchar(36) NOT NULL,
  `day_of_week` tinyint(1) NOT NULL COMMENT '0=Sunday, 6=Saturday',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `slot_duration` int(11) NOT NULL,
  `buffer_minutes` int(11) NOT NULL DEFAULT 0,
  `audience` enum('all','first','followup') NOT NULL DEFAULT 'all',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `blocked_periods` (
  `id` varchar(36) NOT NULL,
  `date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `page_views_daily` (
  `view_date` date NOT NULL,
  `view_count` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`view_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` varchar(36) NOT NULL,
  `visit_type_id` varchar(36) NOT NULL,
  `booking_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `patient_email` varchar(255) NOT NULL,
  `patient_phone` varchar(50) NOT NULL,
  `status` enum('pending','pending_payment','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending',
  `payment_status` enum('unpaid','pending','paid','failed','refunded','partially_refunded') NOT NULL DEFAULT 'unpaid',
  `management_token` varchar(64) NOT NULL,
  `management_token_expires_at` datetime DEFAULT NULL,
  `external_event_id` varchar(255) DEFAULT NULL,
  `meeting_url` varchar(1024) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_management_token` (`management_token`),
  KEY `idx_booking_time` (`booking_date`, `start_time`, `status`),
  CONSTRAINT `fk_visit_type` FOREIGN KEY (`visit_type_id`) REFERENCES `visit_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` varchar(36) NOT NULL,
  `booking_id` varchar(36) NOT NULL,
  `provider` varchar(50) NOT NULL,
  `external_payment_id` varchar(255) DEFAULT NULL,
  `checkout_url` varchar(1024) DEFAULT NULL,
  `payment_method` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'PLN',
  `status` enum('unpaid','pending','paid','failed','refunded','partially_refunded') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` datetime DEFAULT NULL,
  `refunded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_payment_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `smsapi_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `booking_id` varchar(36) DEFAULT NULL,
  `callback_ref` char(32) NOT NULL,
  `provider_message_id` varchar(32) DEFAULT NULL,
  `purpose` varchar(32) NOT NULL DEFAULT 'manual',
  `status_code` varchar(16) DEFAULT NULL,
  `status_name` varchar(32) NOT NULL DEFAULT 'SUBMITTING',
  `provider_error_code` varchar(32) DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_smsapi_callback_ref` (`callback_ref`),
  UNIQUE KEY `idx_smsapi_provider_message_id` (`provider_message_id`),
  KEY `idx_smsapi_booking` (`booking_id`, `created_at`),
  KEY `idx_smsapi_status` (`status_name`, `created_at`),
  CONSTRAINT `fk_smsapi_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_threads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `wa_id_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `wa_id_ciphertext` varbinary(128) NOT NULL,
  `wa_id_iv` varbinary(12) NOT NULL,
  `wa_id_tag` varbinary(16) NOT NULL,
  `profile_name_ciphertext` blob DEFAULT NULL,
  `profile_name_iv` varbinary(12) DEFAULT NULL,
  `profile_name_tag` varbinary(16) DEFAULT NULL,
  `patient_name_ciphertext` blob DEFAULT NULL,
  `patient_name_iv` varbinary(12) DEFAULT NULL,
  `patient_name_tag` varbinary(16) DEFAULT NULL,
  `booking_id_ciphertext` varbinary(128) DEFAULT NULL,
  `booking_id_iv` varbinary(12) DEFAULT NULL,
  `booking_id_tag` varbinary(16) DEFAULT NULL,
  `is_patient` tinyint(1) NOT NULL DEFAULT 0,
  `issue_category_ciphertext` varbinary(128) NOT NULL,
  `issue_category_iv` varbinary(12) NOT NULL,
  `issue_category_tag` varbinary(16) NOT NULL,
  `last_message_id` bigint unsigned DEFAULT NULL,
  `last_message_at` datetime NOT NULL,
  `last_inbound_at` datetime DEFAULT NULL,
  `unread_count` int unsigned NOT NULL DEFAULT 0,
  `bot_state` varchar(32) NOT NULL DEFAULT 'idle',
  `bot_paused` tinyint(1) NOT NULL DEFAULT 0,
  `bot_last_auto_reply_at` datetime DEFAULT NULL,
  `bot_next_action_at` datetime DEFAULT NULL,
  `bot_data_ciphertext` longblob DEFAULT NULL,
  `bot_data_iv` varbinary(12) DEFAULT NULL,
  `bot_data_tag` varbinary(16) DEFAULT NULL,
  `triage_summary_ciphertext` blob DEFAULT NULL,
  `triage_summary_iv` varbinary(12) DEFAULT NULL,
  `triage_summary_tag` varbinary(16) DEFAULT NULL,
  `requires_attention` tinyint(1) NOT NULL DEFAULT 0,
  `priority` varchar(20) NOT NULL DEFAULT 'normal',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_whatsapp_threads_wa_hash` (`wa_id_hash`),
  KEY `idx_whatsapp_threads_last_message` (`last_message_at`),
  KEY `idx_whatsapp_threads_bot_due` (`bot_next_action_at`, `bot_paused`, `bot_state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `thread_id` bigint unsigned NOT NULL,
  `meta_message_id` varchar(160) NOT NULL,
  `direction` enum('inbound','outbound') NOT NULL,
  `message_type` varchar(32) NOT NULL DEFAULT 'text',
  `body_ciphertext` longblob DEFAULT NULL,
  `body_iv` varbinary(12) DEFAULT NULL,
  `body_tag` varbinary(16) DEFAULT NULL,
  `status_name` varchar(32) NOT NULL DEFAULT 'received',
  `reply_to_meta_id` varchar(160) DEFAULT NULL,
  `sent_at` datetime NOT NULL,
  `status_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_whatsapp_messages_meta_id` (`meta_message_id`),
  KEY `idx_whatsapp_messages_thread_time` (`thread_id`, `sent_at`, `id`),
  KEY `idx_whatsapp_messages_retention` (`sent_at`),
  CONSTRAINT `fk_whatsapp_messages_thread`
    FOREIGN KEY (`thread_id`) REFERENCES `whatsapp_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `contact_form_submissions` (
  `id` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(160) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(40) NOT NULL,
  `message` text NOT NULL,
  `consent_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_form_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `psychiatric_interview_submissions` (
  `id` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `form_ciphertext` longblob NOT NULL,
  `form_iv` varbinary(12) NOT NULL,
  `form_tag` varbinary(16) NOT NULL,
  `consent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_psychiatric_form_created` (`created_at`),
  KEY `idx_psychiatric_form_patient` (`patient_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mydr_tokens` (
  `id` tinyint unsigned NOT NULL,
  `access_token` varchar(255) NOT NULL,
  `refresh_token` varchar(255) NOT NULL,
  `access_expires_at` datetime NOT NULL,
  `last_retry_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mydr_booking_links` (
  `booking_id` varchar(36) NOT NULL,
  `patient_id` int unsigned DEFAULT NULL,
  `visit_id` int unsigned DEFAULT NULL,
  `sync_status` enum('pending','synced','skipped','needs_review','error') NOT NULL DEFAULT 'pending',
  `sync_error` varchar(255) DEFAULT NULL,
  `attempts` smallint unsigned NOT NULL DEFAULT 0,
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`booking_id`),
  KEY `idx_mydr_sync_status` (`sync_status`),
  CONSTRAINT `fk_mydr_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `visit_types` (`id`, `name`, `description`, `duration_minutes`, `price`, `currency`, `payment_policy`, `active`, `kind`) VALUES
('vt_1', 'Pierwsza konsultacja', 'Kompleksowa ocena stanu zdrowia, postawienie diagnozy i zaplanowanie leczenia.', 60, 275.00, 'PLN', 'none', 1, 'first'),
('vt_2', 'Konsultacja kontrolna', 'Monitorowanie postępów leczenia i ewentualna modyfikacja zaleceń.', 30, 250.00, 'PLN', 'none', 1, 'followup');

INSERT INTO `availability_rules` (`id`, `day_of_week`, `start_time`, `end_time`, `slot_duration`, `buffer_minutes`, `audience`) VALUES
('r_1', 1, '15:00:00', '20:00:00', 60, 0, 'all'),
('r_2', 3, '09:00:00', '14:00:00', 60, 0, 'all');
