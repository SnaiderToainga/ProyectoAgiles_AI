<?php
define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/user/lib.php';
require_once $CFG->dirroot . '/course/lib.php';
require_once $CFG->libdir . '/gradelib.php';
require_once $CFG->dirroot . '/webservice/lib.php';
require_once $CFG->libdir . '/externallib.php';
\core\session\manager::set_user(get_admin());

function pilot_user(string $username, string $firstname): stdClass {
    global $DB, $CFG;
    $user = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id]);
    if (!$user) {
        $id = user_create_user((object)['username'=>$username, 'password'=>getenv('MOODLE_DEMO_PASSWORD'),
            'auth'=>'manual', 'confirmed'=>1, 'mnethostid'=>$CFG->mnet_localhost_id,
            'firstname'=>$firstname, 'lastname'=>'Ficticio', 'email'=>$username.'@example.invalid']);
        $user = \core_user::get_user($id, '*', MUST_EXIST);
    }
    return $user;
}
$teacher = pilot_user('docente.sprint1', 'Docente');
$students = [pilot_user('estudiante.uno', 'Estudiante Uno'), pilot_user('estudiante.dos', 'Estudiante Dos'),
    pilot_user('estudiante.tres', 'Estudiante Tres')];
$teacherrole = $DB->get_record('role', ['shortname'=>'editingteacher'], '*', MUST_EXIST);
$studentrole = $DB->get_record('role', ['shortname'=>'student'], '*', MUST_EXIST);
$plugin = enrol_get_plugin('manual');
$courseids = [];
foreach (['SOF-401'=>'Metodologías Ágiles', 'SOF-402'=>'Estructuras de Datos'] as $code=>$name) {
    $course = $DB->get_record('course', ['shortname'=>$code]);
    if (!$course) {
        $category = \core_course_category::get_default();
        $course = create_course((object)['fullname'=>$name, 'shortname'=>$code, 'category'=>$category->id,
            'format'=>'topics', 'visible'=>1, 'numsections'=>4]);
    }
    $courseids[] = $course->id;
    $instance = null;
    foreach (enrol_get_instances($course->id, true) as $candidate) {
        if ($candidate->enrol === 'manual') {$instance=$candidate; break;}
    }
    if (!$instance) {
        $id = $plugin->add_instance($course, ['status'=>ENROL_INSTANCE_ENABLED]);
        $instance = $DB->get_record('enrol', ['id'=>$id], '*', MUST_EXIST);
    }
    $plugin->enrol_user($instance, $teacher->id, $teacherrole->id);
    foreach ($students as $student) {$plugin->enrol_user($instance, $student->id, $studentrole->id);}
    // Manual grade items avoid fabricating submission events. Null remains unknown.
    foreach (['Tarea piloto','APE piloto','Examen piloto'] as $number=>$name) {
        $idnumber = 'edumonitor-pilot-'.($number+1);
        $item = grade_item::fetch(['courseid'=>$course->id, 'idnumber'=>$idnumber]);
        if (!$item) {
            $item = new grade_item(['courseid'=>$course->id, 'itemtype'=>'manual', 'itemname'=>$name,
                'idnumber'=>$idnumber, 'gradetype'=>GRADE_TYPE_VALUE, 'grademin'=>0, 'grademax'=>100], false);
            $item->insert('edumonitor-local');


        }
        foreach ([0=>0, 1=>80] as $index=>$value) {
            $grade = grade_grade::fetch(['itemid'=>$item->id, 'userid'=>$students[$index]->id]);
            if (!$grade || $grade->finalgrade === null) {$item->update_final_grade($students[$index]->id, $value, 'edumonitor-local');}
        }
    }
    grade_regrade_final_grades($course->id);
}
set_config('enablewebservices', 1);
$protocols = array_filter(explode(',', $CFG->webserviceprotocols ?? ''));
if (!in_array('rest', $protocols, true)) {$protocols[]='rest';}
set_config('webserviceprotocols', implode(',', $protocols));
$system = context_system::instance();
$restrole = $DB->get_record('role', ['shortname'=>'edumonitorrest']);
if (!$restrole) {
    $roleid = create_role('EduMonitor REST local', 'edumonitorrest', 'Solo acceso al protocolo REST');
} else {$roleid=$restrole->id;}
assign_capability('webservice/rest:use', CAP_ALLOW, $roleid, $system->id);
role_assign($roleid, $teacher->id, $system->id);
$ws = new webservice();
$service = $ws->get_external_service_by_shortname('edumonitor_sprint1');
if (!$service) {
    $id = $ws->add_external_service((object)['name'=>'EduMonitor Sprint 1 local', 'shortname'=>'edumonitor_sprint1',
        'enabled'=>1, 'restrictedusers'=>1, 'downloadfiles'=>0, 'uploadfiles'=>0, 'requiredcapability'=>'']);
    $service = $ws->get_external_service_by_id($id, MUST_EXIST);
}
$functions = ['core_webservice_get_site_info', 'core_enrol_get_users_courses', 'core_enrol_get_enrolled_users',
    'gradereport_user_get_grade_items', 'mod_assign_get_assignments', 'mod_assign_get_submission_status'];
foreach ($functions as $function) {
    if (!$ws->service_function_exists($function, $service->id)) {$ws->add_external_function_to_service($function, $service->id);}
}
if (!$ws->get_ws_authorised_user($service->id, $teacher->id)) {
    $ws->add_ws_authorised_user((object)['externalserviceid'=>$service->id, 'userid'=>$teacher->id, 'iprestriction'=>'', 'validuntil'=>0]);
}
$tokenfile = '/var/moodledata/.edumonitor-token';
if (!file_exists($tokenfile)) {
    $token = external_generate_token(EXTERNAL_TOKEN_PERMANENT, $service, $teacher->id, $system);
    file_put_contents($tokenfile, $token, LOCK_EX);chmod($tokenfile, 0600);
} else {$token=trim(file_get_contents($tokenfile));}
file_put_contents('/run/edumonitor/moodle-connection.json', json_encode([
    'baseUrl'=>'http://localhost:8080', 'moodleToken'=>$token, 'docenteMoodleId'=>$teacher->id,
    'cursoMoodleIds'=>$courseids], JSON_PRETTY_PRINT), LOCK_EX);
echo "Aprovisionamiento verificado: 2 cursos, 1 docente y 3 estudiantes ficticios. Token guardado localmente.\n";
