CREATE TABLE IF NOT EXISTS `page_views_daily` (
  `view_date` date NOT NULL,
  `view_count` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`view_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
