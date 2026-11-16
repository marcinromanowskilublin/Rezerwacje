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
