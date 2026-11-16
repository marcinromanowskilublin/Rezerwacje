<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/api/bootstrap.php';
require_once dirname(__DIR__) . '/api/mydr.php';

mydr_sync_after_response((string) ($argv[1] ?? ''));
json_response(['ok' => true]);
