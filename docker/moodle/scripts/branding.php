<?php
// Identidad visual del aula virtual de laboratorio SISRA (Boost configurado).
// Se ejecuta en cada arranque, después de provision.php, y solo cambia lo que difiere.
define('CLI_SCRIPT', true);
require '/var/www/html/config.php';
require_once $CFG->dirroot . '/course/lib.php';
require_once $CFG->libdir . '/blocklib.php';
require_once $CFG->libdir . '/adminlib.php';
\core\session\manager::set_user(get_admin());

echo "=== IDENTIDAD VISUAL SISRA ===\n";

const SISRA_DIR = '/opt/edumonitor/branding';
const SISRA_AZUL = '#1F3B73';
$cambios = false;

/** Asigna un valor de configuración solo si cambió. */
function sisra_config(string $nombre, $valor, ?string $plugin = null): void {
    global $cambios;
    if ((string) get_config($plugin ?? 'core', $nombre) !== (string) $valor) {
        set_config($nombre, $valor, $plugin);
        $cambios = true;
    }
}

/** Reemplaza el archivo de un área solo si su contenido cambió; devuelve la ruta para la configuración. */
function sisra_archivo(int $contextid, string $component, string $filearea, string $nombre): string {
    global $cambios;
    $ruta = SISRA_DIR . '/' . $nombre;
    $fs = get_file_storage();
    $actual = $fs->get_file($contextid, $component, $filearea, 0, '/', $nombre);
    if (!$actual || $actual->get_contenthash() !== sha1_file($ruta)) {
        $fs->delete_area_files($contextid, $component, $filearea, 0);
        $fs->create_file_from_pathname([
            'contextid' => $contextid, 'component' => $component, 'filearea' => $filearea,
            'itemid' => 0, 'filepath' => '/', 'filename' => $nombre,
        ], $ruta);
        $cambios = true;
    }
    return '/' . $nombre;
}

/** Devuelve una categoría por idnumber y la crea o actualiza si hace falta. */
function sisra_categoria(string $idnumber, string $nombre, int $padre): core_course_category {
    global $DB, $cambios;
    $registro = $DB->get_record('course_categories', ['idnumber' => $idnumber]);
    if (!$registro) {
        $cambios = true;
        return core_course_category::create(['name' => $nombre, 'idnumber' => $idnumber, 'parent' => $padre]);
    }
    $categoria = core_course_category::get($registro->id, MUST_EXIST, true);
    if ($categoria->name !== $nombre || (int) $categoria->parent !== $padre) {
        $categoria->update(['name' => $nombre, 'parent' => $padre]);
        $cambios = true;
    }
    return $categoria;
}

$sistema = context_system::instance();

// 1. Nombre del sitio, idioma y región
$sitio = get_site();
if ($sitio->fullname !== 'SISRA · Aula Virtual FISEI' || $sitio->shortname !== 'SISRA') {
    $sitio->fullname = 'SISRA · Aula Virtual FISEI';
    $sitio->shortname = 'SISRA';
    $sitio->summary = '<p>Entorno académico de pruebas del Sistema Inteligente de Seguimiento y Refuerzo Académico.</p>';
    $DB->update_record('course', $sitio);
    $cambios = true;
}
sisra_config('timezone', 'America/Guayaquil');
sisra_config('country', 'EC');
// La lista de idiomas se guarda en caché; se renueva por si el paquete llegó con una imagen nueva.
get_string_manager()->reset_caches();
if (get_string_manager()->translation_exists('es', false)) {
    sisra_config('lang', 'es');
    // Usuarios creados antes de instalar el paquete conservan 'en'; se pasan al idioma del sitio.
    $DB->set_field('user', 'lang', 'es', ['lang' => 'en', 'deleted' => 0]);
} else {
    echo "Aviso: paquete de idioma 'es' no instalado; la interfaz seguirá en inglés.\n";
}

// 2. Logos y favicon
sisra_config('logo', sisra_archivo($sistema->id, 'core_admin', 'logo', 'logo.svg'), 'core_admin');
sisra_config('logocompact', sisra_archivo($sistema->id, 'core_admin', 'logocompact', 'logo-compacto.svg'), 'core_admin');
sisra_config('favicon', sisra_archivo($sistema->id, 'core_admin', 'favicon', 'emblema.svg'), 'core_admin');

// 3. Tema Boost: colores, fondo de acceso y estilos propios
sisra_config('brandcolor', SISRA_AZUL, 'theme_boost');
sisra_config('loginbackgroundimage',
    sisra_archivo($sistema->id, 'theme_boost', 'loginbackgroundimage', 'login-fondo.svg'), 'theme_boost');
sisra_config('scss', file_get_contents(SISRA_DIR . '/sisra.scss'), 'theme_boost');
sisra_config('guestloginbutton', 0);
sisra_config('auth_instructions',
    'Entorno académico de pruebas del proyecto SISRA. Ingrese con las credenciales de demostración del equipo.');

// 4. Página principal: buscador de cursos y árbol de categorías
sisra_config('frontpage', '7,4');
sisra_config('frontpageloggedin', '7,4');

// 5. Categorías por período, carrera y semestre
$periodo = sisra_categoria('sisra-periodo-2026-2', 'Octubre 2026 – Febrero 2027', 0);
$carreras = [
    'sisra-software' => 'SOFTWARE',
    'sisra-ti' => 'TECNOLOGÍAS DE LA INFORMACIÓN',
    'sisra-telecom' => 'TELECOMUNICACIONES',
    'sisra-industrial' => 'INGENIERÍA INDUSTRIAL',
    'sisra-robotica' => 'AUTOMATIZACIÓN Y ROBÓTICA',
];
foreach ($carreras as $idnumber => $nombre) {
    $categoria = sisra_categoria($idnumber, $nombre, $periodo->id);
    if ($idnumber === 'sisra-software') {
        $software = $categoria;
    }
}
$cuarto = sisra_categoria('sisra-software-cuarto', 'Cuarto Semestre', $software->id);

$imagenes = ['SOF-401' => 'curso-sof-401.svg', 'SOF-402' => 'curso-sof-402.svg'];
foreach ($imagenes as $codigo => $imagen) {
    $curso = $DB->get_record('course', ['shortname' => $codigo]);
    if (!$curso) {
        continue;
    }
    if ((int) $curso->category !== (int) $cuarto->id) {
        move_courses([$curso->id], $cuarto->id);
        $cambios = true;
    }
    sisra_archivo(context_course::instance($curso->id)->id, 'course', 'overviewfiles', $imagen);
}

// La categoría por defecto de la instalación queda oculta si ya no contiene cursos.
$porDefecto = $DB->get_record_select('course_categories',
    "name = :nombre AND (idnumber IS NULL OR idnumber = '')", ['nombre' => 'Category 1']);
if ($porDefecto && $porDefecto->visible && !$DB->record_exists('course', ['category' => $porDefecto->id])) {
    core_course_category::get($porDefecto->id, MUST_EXIST, true)->hide();
    $cambios = true;
}

// 6. Bloque "Usuarios en línea" en el panel lateral de la página principal
$contextoSitio = context_course::instance(SITEID);
if (!$DB->record_exists('block_instances', ['blockname' => 'online_users', 'parentcontextid' => $contextoSitio->id])) {
    $pagina = new moodle_page();
    $pagina->set_course($sitio);
    $pagina->set_context($contextoSitio);
    $pagina->set_pagetype('site-index');
    $pagina->blocks->add_region('side-pre');
    $pagina->blocks->add_block('online_users', 'side-pre', 0, false, 'site-index');
    $cambios = true;
}

if ($cambios) {
    purge_all_caches();
    echo "Identidad visual aplicada.\n";
} else {
    echo "Identidad visual sin cambios.\n";
}
