ALTER TABLE `visit_types`
  ADD COLUMN `kind` enum('first','followup') NOT NULL DEFAULT 'followup';

UPDATE `visit_types` SET `kind` = 'first' WHERE `id` = 'vt_1';
UPDATE `visit_types` SET `kind` = 'followup' WHERE `id` = 'vt_2';

ALTER TABLE `availability_rules`
  ADD COLUMN `buffer_minutes` int(11) NOT NULL DEFAULT 0,
  ADD COLUMN `audience` enum('all','first','followup') NOT NULL DEFAULT 'all';
