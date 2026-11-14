CREATE TABLE IF NOT EXISTS `page_stage_daily` (
  `view_date` date NOT NULL,
  `stage` varchar(32) NOT NULL,
  `stage_count` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`view_date`, `stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
