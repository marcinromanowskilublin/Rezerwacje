CREATE TABLE IF NOT EXISTS `psychiatric_interview_submissions` (
  `id` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `patient_name` varchar(255) NOT NULL,
  `form_ciphertext` longblob NOT NULL,
  `form_iv` varbinary(12) NOT NULL,
  `form_tag` varbinary(16) NOT NULL,
  `consent_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_psychiatric_form_created` (`created_at`),
  KEY `idx_psychiatric_form_patient` (`patient_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
