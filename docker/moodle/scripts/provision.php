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

$courses_config = [
    'SOF-402' => [
        'shortname' => 'SOF-402',
        'fullname' => 'Estructuras de Datos',
        'sections' => [
            0 => ['name' => 'General: Presentación de la Asignatura y Sílabo', 'summary' => '<p>Bienvenido al aula virtual de Estructuras de Datos (FISEI - UTA). Consulte aquí la guía docente, bibliografía y avisos oficiales.</p>'],
            1 => ['name' => 'PRIMER PARCIAL: Estructuras Lineales y Complejidad', 'summary' => '<p>Pilas, colas, listas simples y doblemente enlazadas, análisis asintótico Big-O.</p>'],
            2 => ['name' => 'SEGUNDO PARCIAL: Estructuras Jerárquicas, Árboles y Grafos', 'summary' => '<p>Árboles binarios, árboles BST, balanceo AVL, grafos y recorridos BFS/DFS.</p>'],
            3 => ['name' => 'TERCER PARCIAL: Algoritmos de Búsqueda y Ordenamiento', 'summary' => '<p>Quicksort, Mergesort, tablas de dispersión Hash y complejidad algorítmica.</p>'],
            4 => ['name' => 'PROYECTO INTEGRADOR Y ASESORÍAS ACADÉMICAS', 'summary' => '<p>Desarrollo del proyecto semestral de software y sesiones de tutoría pedagógica.</p>']
        ],
        'categories' => [
            '1P' => [
                'name' => 'PRIMER PARCIAL',
                'subs' => [
                    '1P_ACD' => '1P ACD: Docencia y Tareas (40%)',
                    '1P_APE' => '1P APE: Laboratorios y Talleres (30%)',
                    '1P_AA'  => '1P AA: Trabajo Autónomo y Examen (30%)'
                ]
            ],
            '2P' => [
                'name' => 'SEGUNDO PARCIAL',
                'subs' => [
                    '2P_ACD' => '2P ACD: Docencia y Tareas (40%)',
                    '2P_APE' => '2P APE: Laboratorios y Talleres (30%)',
                    '2P_AA'  => '2P AA: Trabajo Autónomo y Examen (30%)'
                ]
            ]
        ],
        'tasks' => [
            ['name' => 'Evaluación 1.1: Modelo Conceptual y TADs', 'section' => 1, 'cat' => '1P_ACD', 'intro' => 'Implementar tipos abstractos de datos (TAD) con structs y punteros en C++.'],
            ['name' => 'Evaluación 1.2: Pilas y Colas en Memoria Dinámica', 'section' => 1, 'cat' => '1P_ACD', 'intro' => 'Desarrollar operaciones push, pop, enqueue y dequeue con control de desbordamiento.'],
            ['name' => 'Taller Práctico APE 1: Listas Enlazadas Simples y Dobles', 'section' => 1, 'cat' => '1P_APE', 'intro' => 'Práctica de laboratorio: inserción ordenada, búsqueda y eliminación en listas doblemente enlazadas.'],
            ['name' => 'Taller Práctico APE 2: Listas Circulares y Operaciones', 'section' => 1, 'cat' => '1P_APE', 'intro' => 'Laboratorio sobre listas circulares aplicadas a asignación round-robin de procesos.'],
            ['name' => 'Trabajo Autónomo 1: Análisis de Notación Asintótica Big-O', 'section' => 1, 'cat' => '1P_AA', 'intro' => 'Informe técnico sobre complejidad temporal y espacial de algoritmos iterativos y recursivos.'],
            ['name' => 'Examen Teórico - Práctico Primer Parcial', 'section' => 1, 'cat' => '1P_AA', 'intro' => 'Evaluación formal del Primer Parcial sobre estructuras de datos lineales.'],

            ['name' => 'Evaluación 2.1: Árboles Binarios de Búsqueda (BST)', 'section' => 2, 'cat' => '2P_ACD', 'intro' => 'Construir un árbol binario de búsqueda con operaciones de inserción, eliminación y búsqueda.'],
            ['name' => 'Evaluación 2.2: Balanceo y Rotaciones en Árboles AVL', 'section' => 2, 'cat' => '2P_ACD', 'intro' => 'Implementar rotaciones simples y dobles para mantener el factor de equilibrio de un árbol AVL.'],
            ['name' => 'Taller Práctico APE 3: Grafos Dirigidos y Recorridos BFS/DFS', 'section' => 2, 'cat' => '2P_APE', 'intro' => 'Laboratorio sobre matrices y listas de adyacencia y algoritmos de recorrido en grafos.'],
            ['name' => 'Taller Práctico APE 4: Algoritmo de Dijkstra para Caminos Mínimos', 'section' => 2, 'cat' => '2P_APE', 'intro' => 'Práctica experimental: cálculo de rutas más cortas en redes de transporte mediante Dijkstra.'],
            ['name' => 'Trabajo Autónomo 2: Comparativa Quicksort vs Mergesort', 'section' => 2, 'cat' => '2P_AA', 'intro' => 'Estudio comparativo empírico y teórico del rendimiento de algoritmos de ordenamiento divide y vencerás.'],
            ['name' => 'Examen Teórico - Práctico Segundo Parcial', 'section' => 2, 'cat' => '2P_AA', 'intro' => 'Evaluación formal del Segundo Parcial sobre estructuras no lineales y grafos.']
        ]
    ],
    'SOF-401' => [
        'shortname' => 'SOF-401',
        'fullname' => 'Metodologías Ágiles',
        'sections' => [
            0 => ['name' => 'General: Presentación de la Materia y Manifiesto Ágil', 'summary' => '<p>Bienvenido al curso de Metodologías Ágiles de Desarrollo de Software (FISEI - UTA). Consulte aquí el marco metodológico general.</p>'],
            1 => ['name' => 'PRIMER PARCIAL: Marco de Trabajo Scrum y Requerimientos', 'summary' => '<p>Fundamentos de Scrum, roles, eventos timeboxed, historias de usuario INVEST y estimación ágil.</p>'],
            2 => ['name' => 'SEGUNDO PARCIAL: Ingeniería Ágil, CI/CD y Calidad', 'summary' => '<p>Definición de Terminado (DoD), pruebas automatizadas, Docker, GitHub Actions y retrospectivas.</p>'],
            3 => ['name' => 'TERCER PARCIAL: Métricas Ágiles y Entrega Continua', 'summary' => '<p>Gráficos Burndown, velocidad del equipo, tiempo de ciclo y despliegue continuo.</p>'],
            4 => ['name' => 'PROYECTO INTEGRADOR Y ASESORÍAS DOCENTES', 'summary' => '<p>Seguimiento de Sprints, revisiones de incremento y sesiones de tutoría pedagógica.</p>']
        ],
        'categories' => [
            '1P' => [
                'name' => 'PRIMER PARCIAL',
                'subs' => [
                    '1P_ACD' => '1P ACD: Docencia y Talleres (40%)',
                    '1P_APE' => '1P APE: Simulaciones y Prácticas (30%)',
                    '1P_AA'  => '1P AA: Trabajo Autónomo y Examen (30%)'
                ]
            ],
            '2P' => [
                'name' => 'SEGUNDO PARCIAL',
                'subs' => [
                    '2P_ACD' => '2P ACD: Docencia y Talleres (40%)',
                    '2P_APE' => '2P APE: Simulaciones y Prácticas (30%)',
                    '2P_AA'  => '2P AA: Trabajo Autónomo y Examen (30%)'
                ]
            ]
        ],
        'tasks' => [
            ['name' => 'Evaluación 1.1: Manifiesto Ágil y Principios de Scrum', 'section' => 1, 'cat' => '1P_ACD', 'intro' => 'Análisis de los 4 valores y 12 principios ágiles contrastados contra el modelo en cascada.'],
            ['name' => 'Evaluación 1.2: Historias de Usuario con Criterios INVEST', 'section' => 1, 'cat' => '1P_ACD', 'intro' => 'Redacción formal de historias de usuario, modelo 3C y criterios de aceptación verificables.'],
            ['name' => 'Taller APE 1: Estimación de Backlog con Planning Poker', 'section' => 1, 'cat' => '1P_APE', 'intro' => 'Simulación práctica de estimación relativa en Story Points mediante escala Fibonacci modificada.'],
            ['name' => 'Taller APE 2: Configuración de Tablero Kanban y WIP Limits', 'section' => 1, 'cat' => '1P_APE', 'intro' => 'Diseño de flujo de trabajo visual con límites de trabajo en progreso para optimizar el throughput.'],
            ['name' => 'Trabajo Autónomo 1: Definición de Ready (DoR) y Done (DoD)', 'section' => 1, 'cat' => '1P_AA', 'intro' => 'Diseño de acuerdos de calidad del equipo para ingreso y cierre de historias en el Sprint.'],
            ['name' => 'Examen Primer Parcial: Marco de Trabajo Scrum', 'section' => 1, 'cat' => '1P_AA', 'intro' => 'Evaluación teórica sobre principios de Scrum, roles, eventos y artefactos según el SBOK.'],

            ['name' => 'Evaluación 2.1: Gestión de Deuda Técnica y Refactorización', 'section' => 2, 'cat' => '2P_ACD', 'intro' => 'Estrategias de refactorización continua de código para mantener la sostenibilidad del software.'],
            ['name' => 'Evaluación 2.2: Pruebas Unitarias y TDD en Entornos Ágiles', 'section' => 2, 'cat' => '2P_ACD', 'intro' => 'Diseño de pruebas automatizadas con xUnit y PyTest bajo enfoque Test-Driven Development.'],
            ['name' => 'Taller APE 3: Pipeline CI/CD con GitHub Actions', 'section' => 2, 'cat' => '2P_APE', 'intro' => 'Implementación práctica de un pipeline de integración continua que compile y ejecute pruebas unitarias.'],
            ['name' => 'Taller APE 4: Orquestación de Microservicios con Docker Compose', 'section' => 2, 'cat' => '2P_APE', 'intro' => 'Contenerización de servicios backend, frontend y bases de datos en un entorno reproducible.'],
            ['name' => 'Trabajo Autónomo 2: Métricas de Velocidad y Burndown', 'section' => 2, 'cat' => '2P_AA', 'intro' => 'Cálculo de métricas de rendimiento del Sprint y análisis de gráficos de avance.'],
            ['name' => 'Examen Segundo Parcial: Integración y Calidad Continua', 'section' => 2, 'cat' => '2P_AA', 'intro' => 'Evaluación sobre ingeniería ágil, pruebas, integración continua y despliegue.']
        ]
    ]
];

$grades_matrix = [
    'andrea.morales'   => [9.5, 9.2, 10.0, 9.8, 9.6, 9.5, 9.8, 9.5, 10.0, 9.7, 9.8, 9.6],
    'estiven.chiluisa' => [9.0, 9.2, 9.5,  9.0, 9.2, 9.0, 9.3, 9.0, 9.5,  9.2, 9.0, 9.1],
    'maria.sanchez'    => [9.2, 8.8, 9.5,  9.0, 9.0, 8.8, 9.2, 9.0, 9.4,  9.0, 9.2, 9.0],
    'snaider.toainga'  => [8.8, 8.5, 9.0,  9.2, 8.9, 8.6, 9.0, 8.8, 9.2,  8.7, 9.0, 8.8],
    'cristian.sivinta' => [8.0, 7.8, 8.5,  8.0, 8.2, 7.5, 8.2, 7.8, 8.0,  7.9, 8.0, 7.7],
    'cesar.carrasco'   => [7.8, 7.5, 8.0,  7.8, 7.9, 7.2, 8.0, 7.6, 7.8,  7.5, 7.9, 7.4],
    'diana.ortiz'      => [7.5, 7.2, 7.8,  7.4, 7.5, 7.0, 7.6, 7.2, 7.5,  7.3, 7.5, 7.1],
    'juan.torres'      => [7.2, 7.0, 7.5,  7.1, 7.2, 6.8, 7.3, 7.0, 7.2,  7.0, 7.2, 6.9],
    'sofia.lopez'      => [6.5, 6.2, 6.8,  6.0, 6.5, 5.8, 6.4, 6.0, 6.6,  6.2, 6.5, 5.9],
    'kevin.fuerez'     => [5.8, 5.5, 6.2,  5.4, 5.8, 5.0, 5.9, 5.3, 6.0,  5.5, 5.8, 5.1],
    'mateo.perez'      => [5.0, 4.8, 5.5,  4.6, 5.0, 4.2, 5.2, 4.7, 5.4,  4.8, 5.0, 4.4],
    'carlos.gomez'     => [3.5, 3.0, 4.0,  2.5, 3.0, 2.0, 3.2, 2.8, 3.5,  2.5, 3.0, 2.2],
];

$feedback_samples = [
    'Sobresaliente' => ['Excelente implementación técnica y código pulcro.', 'Solución óptima y bien documentada.', 'Demuestra dominio cabal de los conceptos.'],
    'Regular'       => ['Buen trabajo, cumple con los requerimientos.', 'Código funcional; se sugiere modularizar mejor los métodos.', 'Entrega correcta y dentro del plazo.'],
    'En Riesgo'     => ['Faltan validaciones de casos borde y manejo de excepciones.', 'Se requiere mayor dedicación en la estructura algorítmica.', 'Presenta fallos en la prueba de integración.'],
    'Critico'       => ['Entrega incompleta; no supera las pruebas de ejecución mínimas.', 'Faltan componentes clave de la asignación. Agendar tutoría obligatoria.', 'Rendimiento deficiente en esta actividad.']
];

$module = $DB->get_record('modules', ['name' => 'assign'], '*', MUST_EXIST);
$courseids = [];

foreach ($courses_config as $code => $cinfo) {
    $course = $DB->get_record('course', ['shortname' => $code]);
    if (!$course) {
        $category = \core_course_category::get_default();
        $course = create_course((object)[
            'fullname' => $cinfo['fullname'], 'shortname' => $code,
            'category' => $category->id, 'format' => 'topics', 'visible' => 1, 'numsections' => 4
        ]);
    }
    $courseids[] = $course->id;

    // Actualizar nombres y descripciones de secciones
    foreach ($cinfo['sections'] as $sec_num => $sec_data) {
        $sec = $DB->get_record('course_sections', ['course' => $course->id, 'section' => $sec_num]);
        if (!$sec) {
            $sec = course_create_section($course->id, $sec_num);
        }
        $sec->name = $sec_data['name'];
        $sec->summary = $sec_data['summary'];
        $sec->summaryformat = FORMAT_HTML;
        $sec->visible = 1;
        $DB->update_record('course_sections', $sec);
    }

    // Matricular docente y 12 estudiantes
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

    // Categorías de calificación (Primer Parcial, Segundo Parcial, ACD, APE, AA)
    $course_cat = grade_category::fetch_course_category($course->id);
    $cat_map = [];

    foreach ($cinfo['categories'] as $p_key => $p_data) {
        $p_cat = grade_category::fetch(['courseid' => $course->id, 'fullname' => $p_data['name']]);
        if (!$p_cat) {
            $p_cat = new grade_category(['courseid' => $course->id, 'fullname' => $p_data['name']], false);
            $p_cat->parent = $course_cat->id;
            $p_cat->aggregation = GRADE_AGGREGATE_WEIGHTED_MEAN;
            $p_cat->insert();
        }
        foreach ($p_data['subs'] as $sub_key => $sub_name) {
            $sub_cat = grade_category::fetch(['courseid' => $course->id, 'fullname' => $sub_name]);
            if (!$sub_cat) {
                $sub_cat = new grade_category(['courseid' => $course->id, 'fullname' => $sub_name], false);
                $sub_cat->parent = $p_cat->id;
                $sub_cat->aggregation = GRADE_AGGREGATE_WEIGHTED_MEAN;
                $sub_cat->insert();
            }
            $cat_map[$sub_key] = $sub_cat->id;
        }
    }

    // Crear las 12 Tareas académicas si no existen
    $created_tasks = [];
    foreach ($cinfo['tasks'] as $t_index => $t_info) {
        $existing_assign = $DB->get_record('assign', ['course' => $course->id, 'name' => $t_info['name']]);
        if (!$existing_assign) {
            $moduleinfo = new stdClass();
            $moduleinfo->modulename = 'assign';
            $moduleinfo->module = $module->id;
            $moduleinfo->name = $t_info['name'];
            $moduleinfo->intro = "<p>{$t_info['intro']}</p>";
            $moduleinfo->introformat = FORMAT_HTML;
            $moduleinfo->section = $t_info['section'];
            $moduleinfo->visible = 1;
            $moduleinfo->grade = 10;
            $moduleinfo->gradepass = 7;
            $moduleinfo->assignsubmission_onlinetext_enabled = 1;
            $moduleinfo->assignsubmission_file_enabled = 1;
            $moduleinfo->assignsubmission_file_maxfiles = 2;
            $moduleinfo->maxbytes = 10485760;
            $moduleinfo->alwaysshowdescription = 1;
            $moduleinfo->submissiondrafts = 0;
            $moduleinfo->requiresubmissionstatement = 0;
            $moduleinfo->sendnotifications = 0;
            $moduleinfo->sendlatenotifications = 0;
            $moduleinfo->duedate = time() + (7 + $t_index) * 86400;
            $moduleinfo->cutoffdate = 0;
            $moduleinfo->gradingduedate = 0;
            $moduleinfo->allowsubmissionsfromdate = time() - (14 - $t_index) * 86400;
            $moduleinfo->teamsubmission = 0;
            $moduleinfo->requireallteammemberssubmit = 0;
            $moduleinfo->blindmarking = 0;
            $moduleinfo->markingworkflow = 0;
            $moduleinfo->markingallocation = 0;
            $moduleinfo->preventsubmissionnotingroup = 0;

            $created = add_moduleinfo($moduleinfo, $course, null);
            $instance_id = $created->instance;

            // Asignar a la categoría correspondiente
            $g_record = $DB->get_record('grade_items', ['courseid' => $course->id, 'itemtype' => 'mod', 'itemmodule' => 'assign', 'iteminstance' => $instance_id]);
            if ($g_record && isset($cat_map[$t_info['cat']])) {
                $gi = new grade_item($g_record, false);
                $gi->set_parent($cat_map[$t_info['cat']]);
            }
        } else {
            $instance_id = $existing_assign->id;
        }

        $created_tasks[] = ['index' => $t_index, 'instance' => $instance_id];
    }

    // Insertar Calificaciones para los 12 estudiantes en escala 0 a 10
    foreach ($created_tasks as $t_info) {
        $t_idx = $t_info['index'];
        $g_record = $DB->get_record('grade_items', ['courseid' => $course->id, 'itemtype' => 'mod', 'itemmodule' => 'assign', 'iteminstance' => $t_info['instance']]);
        if (!$g_record) continue;
        $gi = new grade_item($g_record, false);

        foreach ($students as $username => $stu) {
            $existing_grade = grade_grade::fetch(['itemid' => $gi->id, 'userid' => $stu->id]);
            if (!$existing_grade || $existing_grade->finalgrade === null) {
                $nota = $grades_matrix[$username][$t_idx] ?? 7.5;
                $tier = ($nota >= 8.5) ? 'Sobresaliente' : (($nota >= 7.0) ? 'Regular' : (($nota >= 4.0) ? 'En Riesgo' : 'Critico'));
                $fb_list = $feedback_samples[$tier];
                $fb = $fb_list[$t_idx % count($fb_list)];
                $gi->update_final_grade($stu->id, $nota, 'assign', $fb);
            }
        }
    }

    grade_regrade_final_grades($course->id);
    rebuild_course_cache($course->id, true);
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

echo "Aprovisionamiento completado: 12 tareas por curso, 12 estudiantes y calificaciones consolidadas.\n";
