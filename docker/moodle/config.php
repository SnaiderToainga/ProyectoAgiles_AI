<?php
unset($CFG);
global $CFG;
$CFG = new stdClass();
$CFG->dbtype = 'mariadb';
$CFG->dblibrary = 'native';
$CFG->dbhost = 'mariadb';
$CFG->dbname = 'moodle';
$CFG->dbuser = 'moodle';
$CFG->dbpass = getenv('MOODLE_DB_PASSWORD');
$CFG->prefix = 'mdl_';
$CFG->dboptions = ['dbpersist' => false, 'dbport' => 3306, 'dbsocket' => '', 'dbcollation' => 'utf8mb4_unicode_ci'];
$CFG->wwwroot = 'http://localhost:8080';
$CFG->dataroot = '/var/moodledata';
$CFG->admin = 'admin';
$CFG->directorypermissions = 02770;
$CFG->passwordpolicy = 1;
require_once(__DIR__ . '/lib/setup.php');
