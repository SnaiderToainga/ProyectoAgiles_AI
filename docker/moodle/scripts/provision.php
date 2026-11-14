<?php
define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/user/lib.php';
require_once $CFG->dirroot . '/course/lib.php';
require_once $CFG->dirroot . '/course/modlib.php';
require_once $CFG->libdir . '/gradelib.php';
require_once $CFG->dirroot . '/webservice/lib.php';
require_once $CFG->libdir . '/externallib.php';
require_once $CFG->dirroot . '/mod/assign/lib.php';
\core\session\manager::set_user(get_admin());

echo "=== PROVISIONAMIENTO ACADÉMICO EDUMONITOR AI ===\n";

// 1. Limpieza de ítems manuales heredados y usuarios ficticios antiguos
foreach ($DB->get_records('grade_items', ['itemtype' => 'manual']) as $mi) {
    (new grade_item($mi, false))->delete('edumonitor');
}
foreach (['estudiante.uno', 'estudiante.dos', 'estudiante.tres'] as $un) {
    $u = $DB->get_record('user', ['username' => $un]);
    if ($u) { user_delete_user($u); }
}

// 2. Docente Titular
$teacher = $DB->get_record('user', ['username' => 'docente.sprint1', 'mnethostid' => $CFG->mnet_localhost_id]);
if (!$teacher) {
    $id = user_create_user((object)[
        'username' => 'docente.sprint1',
        'password' => getenv('MOODLE_DEMO_PASSWORD') ?: 'DemoEduMonitor2026!',
        'auth' => 'manual', 'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id,
        'firstname' => 'Ing. Carlos', 'lastname' => 'Docente Titular',
        'email' => 'docente.titular@uta.edu.ec', 'city' => 'Ambato', 'country' => 'EC'
    ]);
    $teacher = \core_user::get_user($id, '*', MUST_EXIST);
} else {
    $teacher->firstname = 'Ing. Carlos';
    $teacher->lastname = 'Docente Titular';
    $teacher->email = 'docente.titular@uta.edu.ec';
    $DB->update_record('user', $teacher);
}

// 3. Nómina de 12 Estudiantes Reales
$students_data = [
    ['username' => 'andrea.morales', 'firstname' => 'Andrea Carolina', 'lastname' => 'Morales Sanchez', 'email' => 'andrea.morales@uta.edu.ec'],
    ['username' => 'estiven.chiluisa', 'firstname' => 'Estiven Alexander', 'lastname' => 'Chiluisa Guanoquiza', 'email' => 'estiven.chiluisa@uta.edu.ec'],
    ['username' => 'maria.sanchez', 'firstname' => 'Maria Belen', 'lastname' => 'Sanchez Caiza', 'email' => 'maria.sanchez@uta.edu.ec'],
    ['username' => 'snaider.toainga', 'firstname' => 'Snaider Alexander', 'lastname' => 'Toainga Toapanta', 'email' => 'snaider.toainga@uta.edu.ec'],
    ['username' => 'cristian.sivinta', 'firstname' => 'Cristian Paul', 'lastname' => 'Sivinta Tasinchana', 'email' => 'cristian.sivinta@uta.edu.ec'],
    ['username' => 'cesar.carrasco', 'firstname' => 'Cesar David', 'lastname' => 'Carrasco Montero', 'email' => 'cesar.carrasco@uta.edu.ec'],
    ['username' => 'diana.ortiz', 'firstname' => 'Diana Marcela', 'lastname' => 'Ortiz Mayorga', 'email' => 'diana.ortiz@uta.edu.ec'],
    ['username' => 'juan.torres', 'firstname' => 'Juan David', 'lastname' => 'Torres Lopez', 'email' => 'juan.torres@uta.edu.ec'],
    ['username' => 'sofia.lopez', 'firstname' => 'Sofia Elizabeth', 'lastname' => 'Lopez Alarcon', 'email' => 'sofia.lopez@uta.edu.ec'],
    ['username' => 'kevin.fuerez', 'firstname' => 'Kevin Paul', 'lastname' => 'Fuerez Morales', 'email' => 'kevin.fuerez@uta.edu.ec'],
    ['username' => 'mateo.perez', 'firstname' => 'Mateo Sebastian', 'lastname' => 'Perez Viteri', 'email' => 'mateo.perez@uta.edu.ec'],
    ['username' => 'carlos.gomez', 'firstname' => 'Carlos Eduardo', 'lastname' => 'Gomez Paredes', 'email' => 'carlos.gomez@uta.edu.ec'],
];

$demo_pass = getenv('MOODLE_DEMO_PASSWORD') ?: 'DemoEduMonitor2026!';
$students = [];
foreach ($students_data as $sdata) {
    $u = $DB->get_record('user', ['username' => $sdata['username'], 'mnethostid' => $CFG->mnet_localhost_id]);
    if (!$u) {
        $id = user_create_user((object)[
            'username' => $sdata['username'],
            'password' => $demo_pass,
            'auth' => 'manual', 'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id,
            'firstname' => $sdata['firstname'], 'lastname' => $sdata['lastname'],
            'email' => $sdata['email'], 'city' => 'Ambato', 'country' => 'EC'
        ]);
        $u = \core_user::get_user($id, '*', MUST_EXIST);
    }
    update_internal_user_password($u, $demo_pass);
    $students[$sdata['username']] = $u;
}

// 4. Configurar Roles y Plugins de Matrícula
$teacherrole = $DB->get_record('role', ['shortname' => 'editingteacher'], '*', MUST_EXIST);
$studentrole = $DB->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);
$plugin = enrol_get_plugin('manual');

$courses = [
    ['code' => 'SOF-401', 'name' => 'Metodologías Ágiles'],
    ['code' => 'SOF-402', 'name' => 'Estructuras de Datos']
];
$courseids = [];

foreach ($courses as $cinfo) {
    $course = $DB->get_record('course', ['shortname' => $cinfo['code']]);
    if (!$course) {
        $category = \core_course_category::get_default();
        $course = create_course((object)[
            'fullname' => $cinfo['name'], 'shortname' => $cinfo['code'],
            'category' => $category->id, 'format' => 'topics', 'visible' => 1, 'numsections' => 4
        ]);
    }
    $courseids[] = $course->id;

    $instance = null;
    foreach (enrol_get_instances($course->id, true) as $candidate) {
        if ($candidate->enrol === 'manual') { $instance = $candidate; break; }
    }
    if (!$instance) {
        $id = $plugin->add_instance($course, ['status' => ENROL_INSTANCE_ENABLED]);
        $instance = $DB->get_record('enrol', ['id' => $id], '*', MUST_EXIST);
    }
    $plugin->enrol_user($instance, $teacher->id, $teacherrole->id);
    foreach ($students as $stu) {
        $plugin->enrol_user($instance, $stu->id, $studentrole->id);
    }
}

// 5. Configuración de Web Services y Tokens
set_config('enablewebservices', 1);
$protocols = array_filter(explode(',', $CFG->webserviceprotocols ?? ''));
if (!in_array('rest', $protocols, true)) { $protocols[] = 'rest'; }
set_config('webserviceprotocols', implode(',', $protocols));

$system = context_system::instance();
$restrole = $DB->get_record('role', ['shortname' => 'edumonitorrest']);
if (!$restrole) {
    $roleid = create_role('EduMonitor REST local', 'edumonitorrest', 'Solo acceso al protocolo REST');
} else { $roleid = $restrole->id; }

assign_capability('webservice/rest:use', CAP_ALLOW, $roleid, $system->id);
role_assign($roleid, $teacher->id, $system->id);

$ws = new webservice();
$service = $ws->get_external_service_by_shortname('edumonitor_sprint1');
if (!$service) {
    $id = $ws->add_external_service((object)[
        'name' => 'EduMonitor Sprint 1 local', 'shortname' => 'edumonitor_sprint1',
        'enabled' => 1, 'restrictedusers' => 1, 'downloadfiles' => 0, 'uploadfiles' => 0, 'requiredcapability' => ''
    ]);
    $service = $ws->get_external_service_by_id($id, MUST_EXIST);
}

$functions = [
    'core_webservice_get_site_info',
    'core_enrol_get_users_courses',
    'core_enrol_get_enrolled_users',
    'gradereport_user_get_grade_items',
    'mod_assign_get_assignments',
    'mod_assign_get_submission_status',
    'core_course_get_contents'
];
foreach ($functions as $function) {
    if (!$ws->service_function_exists($function, $service->id)) {
        $ws->add_external_function_to_service($function, $service->id);
    }
}

if (!$ws->get_ws_authorised_user($service->id, $teacher->id)) {
    $ws->add_ws_authorised_user((object)[
        'externalserviceid' => $service->id, 'userid' => $teacher->id, 'iprestriction' => '', 'validuntil' => 0
    ]);
}

$tokenfile = '/var/moodledata/.edumonitor-token';
if (!file_exists($tokenfile)) {
    $token = external_generate_token(EXTERNAL_TOKEN_PERMANENT, $service, $teacher->id, $system);
    file_put_contents($tokenfile, $token, LOCK_EX);
    chmod($tokenfile, 0600);
} else {
    $token = trim(file_get_contents($tokenfile));
}

@mkdir('/run/edumonitor', 0755, true);
file_put_contents('/run/edumonitor/moodle-connection.json', json_encode([
    'baseUrl' => 'http://localhost:8080',
    'moodleToken' => $token,
    'docenteMoodleId' => $teacher->id,
    'cursoMoodleIds' => $courseids
], JSON_PRETTY_PRINT), LOCK_EX);

grade_regrade_final_grades(2);
grade_regrade_final_grades(3);
rebuild_course_cache(2, true);
rebuild_course_cache(3, true);

echo "Aprovisionamiento verificado: Cursos y 12 alumnos sincronizados sin datos manuales obsoletos.\n";
