<?php
// Cuenta de servicio de solo lectura para la API de SISRA.
// Se ejecuta en cada arranque después de branding.php (que crea la categoría del período).
// La API usa el token de esta cuenta en lugar del token de un docente concreto.
define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/user/lib.php';
require_once $CFG->dirroot . '/webservice/lib.php';
require_once $CFG->libdir . '/externallib.php';
\core\session\manager::set_user(get_admin());

echo "=== CUENTA DE SERVICIO SISRA ===\n";

const SISRA_SERVICIO_USUARIO = 'sisra.servicio';
const SISRA_CATEGORIA_PERIODO = 'sisra-periodo-2026-2';
const SISRA_TOKEN_ARCHIVO = '/var/moodledata/.sisra-servicio-token';

$sistema = context_system::instance();

// 1. Autenticación "webservice": la cuenta solo sirve para la API y no puede entrar por la web.
$auths = array_filter(explode(',', $CFG->auth ?? ''));
if (!in_array('webservice', $auths, true)) {
    $auths[] = 'webservice';
    set_config('auth', implode(',', $auths));
}

// 2. Usuario de servicio
$servicioUsuario = $DB->get_record('user', ['username' => SISRA_SERVICIO_USUARIO, 'mnethostid' => $CFG->mnet_localhost_id]);
if (!$servicioUsuario) {
    $id = user_create_user((object) [
        'username' => SISRA_SERVICIO_USUARIO,
        'auth' => 'webservice',
        // Aleatoria y nunca usada (auth "webservice" no permite entrar), pero debe cumplir la política.
        'password' => 'Sv#9' . bin2hex(random_bytes(24)),
        'confirmed' => 1,
        'mnethostid' => $CFG->mnet_localhost_id,
        'firstname' => 'Servicio',
        'lastname' => 'SISRA (solo lectura)',
        'email' => 'servicio.sisra@example.invalid',
    ]);
    $servicioUsuario = \core_user::get_user($id, '*', MUST_EXIST);
    echo "Usuario de servicio creado.\n";
} elseif ($servicioUsuario->auth !== 'webservice') {
    $DB->set_field('user', 'auth', 'webservice', ['id' => $servicioUsuario->id]);
}

// 3. Rol de lectura asignable solo en categorías, con capacidades exclusivamente de consulta
$rol = $DB->get_record('role', ['shortname' => 'sisralectura']);
$rolId = $rol ? (int) $rol->id : create_role(
    'SISRA lectura del período', 'sisralectura',
    'Solo lectura de cursos, participantes y calificaciones de una categoría para la API de SISRA.'
);
set_role_contextlevels($rolId, [CONTEXT_COURSECAT]);
$capacidades = [
    'moodle/course:view',                 // Acceder a los cursos sin estar matriculado.
    'moodle/course:viewparticipants',     // core_enrol_get_users_courses / get_enrolled_users.
    'moodle/user:viewdetails',            // Sin esta capacidad solo se listan los docentes del curso.
    'moodle/course:viewhiddenuserfields', // Correo de los participantes.
    'moodle/site:viewuseridentity',
    'moodle/site:accessallgroups',
    'moodle/course:viewhiddensections',   // Detectar secciones ocultas al sincronizar.
    'moodle/course:viewhiddenactivities', // Detectar actividades ocultas al sincronizar.
    'moodle/grade:viewall',               // gradereport_user_get_grade_items de todo el curso.
    'gradereport/user:view',
    'mod/assign:view',
    'mod/assign:viewgrades',              // Estado de entrega de cada estudiante.
];
foreach ($capacidades as $capacidad) {
    assign_capability($capacidad, CAP_ALLOW, $rolId, $sistema->id, true);
}

$periodo = $DB->get_record('course_categories', ['idnumber' => SISRA_CATEGORIA_PERIODO], '*', MUST_EXIST);
$contextoPeriodo = context_coursecat::instance($periodo->id);
if (!user_has_role_assignment($servicioUsuario->id, $rolId, $contextoPeriodo->id)) {
    role_assign($rolId, $servicioUsuario->id, $contextoPeriodo->id);
}

// 4. Permiso de protocolo REST (a nivel de sitio, sin otras capacidades)
$restRol = $DB->get_record('role', ['shortname' => 'edumonitorrest']);
$restRolId = $restRol ? (int) $restRol->id : create_role('EduMonitor REST local', 'edumonitorrest', 'Solo acceso al protocolo REST');
assign_capability('webservice/rest:use', CAP_ALLOW, $restRolId, $sistema->id, true);
if (!user_has_role_assignment($servicioUsuario->id, $restRolId, $sistema->id)) {
    role_assign($restRolId, $servicioUsuario->id, $sistema->id);
}

// 5. Servicio externo autorizado solo para la cuenta de servicio
$ws = new webservice();
$servicio = $ws->get_external_service_by_shortname('edumonitor_sprint1', MUST_EXIST);
if ($servicio->name !== 'SISRA lectura') {
    $servicio->name = 'SISRA lectura';
    $ws->update_external_service($servicio);
}
if (!$ws->get_ws_authorised_user($servicio->id, $servicioUsuario->id)) {
    $ws->add_ws_authorised_user((object) [
        'externalserviceid' => $servicio->id, 'userid' => $servicioUsuario->id, 'iprestriction' => '', 'validuntil' => 0,
    ]);
}

// 6. Retirar el acceso REST del docente de ejemplo (antes la API usaba su token)
$docente = $DB->get_record('user', ['username' => 'docente.sprint1', 'mnethostid' => $CFG->mnet_localhost_id]);
if ($docente) {
    $DB->delete_records('external_services_users', ['externalserviceid' => $servicio->id, 'userid' => $docente->id]);
    $DB->delete_records('external_tokens', ['externalserviceid' => $servicio->id, 'userid' => $docente->id]);
    role_unassign($restRolId, $docente->id, $sistema->id);
}
@unlink('/var/moodledata/.edumonitor-token');

// 7. Token permanente de la cuenta de servicio (se conserva entre reinicios)
$token = file_exists(SISRA_TOKEN_ARCHIVO) ? trim(file_get_contents(SISRA_TOKEN_ARCHIVO)) : '';
if ($token === '' || !$DB->record_exists('external_tokens',
        ['token' => $token, 'userid' => $servicioUsuario->id, 'externalserviceid' => $servicio->id])) {
    $token = external_generate_token(EXTERNAL_TOKEN_PERMANENT, $servicio, $servicioUsuario->id, $sistema);
    file_put_contents(SISRA_TOKEN_ARCHIVO, $token, LOCK_EX);
    chmod(SISRA_TOKEN_ARCHIVO, 0600);
    echo "Token de servicio generado.\n";
}

$cursos = $DB->get_fieldset_select('course', 'id', "shortname IN ('SOF-401', 'SOF-402')");
@mkdir('/run/edumonitor', 0755, true);
file_put_contents('/run/edumonitor/moodle-connection.json', json_encode([
    'baseUrl' => 'http://localhost:8080',
    'moodleToken' => $token,
    'cuentaServicio' => SISRA_SERVICIO_USUARIO,
    'docenteMoodleId' => $docente ? (int) $docente->id : null,
    'cursoMoodleIds' => array_map('intval', $cursos),
], JSON_PRETTY_PRINT), LOCK_EX);

echo "Cuenta de servicio lista: solo lectura en la categoría «{$periodo->name}».\n";
