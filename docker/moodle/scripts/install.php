<?php
// Build CLI arguments in memory so the password never appears in process arguments.
$argv = [__FILE__, '--agree-license', '--fullname=EduMonitor AI Sprint 1',
    '--shortname=EduMonitor', '--adminuser=edumonitoradmin',
    '--adminpass=' . getenv('MOODLE_ADMIN_PASSWORD'), '--adminemail=admin@example.invalid'];
$argc = count($argv);
$_SERVER['argv'] = $argv;
$_SERVER['argc'] = $argc;
require '/var/www/html/admin/cli/install_database.php';
