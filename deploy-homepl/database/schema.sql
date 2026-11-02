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

INSERT INTO `visit_types` (`id`, `name`, `description`, `duration_minutes`, `price`, `currency`, `payment_policy`, `active`, `kind`) VALUES
('vt_1', 'Pierwsza konsultacja', 'Kompleksowa ocena stanu zdrowia, postawienie diagnozy i zaplanowanie leczenia.', 60, 275.00, 'PLN', 'none', 1, 'first'),
('vt_2', 'Konsultacja kontrolna', 'Monitorowanie postępów leczenia i ewentualna modyfikacja zaleceń.', 30, 250.00, 'PLN', 'none', 1, 'followup');

INSERT INTO `availability_rules` (`id`, `day_of_week`, `start_time`, `end_time`, `slot_duration`, `buffer_minutes`, `audience`) VALUES
('r_1', 1, '15:00:00', '20:00:00', 60, 0, 'all'),
('r_2', 3, '09:00:00', '14:00:00', 60, 0, 'all');
