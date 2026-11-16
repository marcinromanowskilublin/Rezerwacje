CREATE TABLE IF NOT EXISTS `edr_visit_links` (
  `booking_id` varchar(36) NOT NULL,
  `edr_visit_id` varchar(80) DEFAULT NULL,
  `edr_patient_id` varchar(80) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `last_error` text DEFAULT NULL,
  `request_payload` longtext DEFAULT NULL,
  `response_payload` longtext DEFAULT NULL,
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`booking_id`),
  KEY `idx_edr_visit_links_visit` (`edr_visit_id`),
  CONSTRAINT `fk_edr_visit_links_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `edr_spoken_notes` (
  `id` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `booking_id` varchar(36) NOT NULL,
  `edr_visit_id` varchar(80) DEFAULT NULL,
  `source` varchar(40) NOT NULL DEFAULT 'voice',
  `target_field` varchar(32) NOT NULL DEFAULT 'interview',
  `transcript_text` longtext DEFAULT NULL,
  `examination_text` longtext DEFAULT NULL,
  `recommendation_text` longtext DEFAULT NULL,
  `summary_text` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `last_error` text DEFAULT NULL,
  `edr_response_payload` longtext DEFAULT NULL,
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_edr_spoken_notes_booking` (`booking_id`, `created_at`),
  KEY `idx_edr_spoken_notes_status` (`status`, `created_at`),
  CONSTRAINT `fk_edr_spoken_notes_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
