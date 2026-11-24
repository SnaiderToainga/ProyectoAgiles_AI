from typing import Dict, List, Optional
from app.schemas import ContextoCursoChat, EstudianteChatDto


class ChatTools:
    """
    Herramientas deterministas (Tools) para el Asistente Pedagógico de IA.
    Ejecutan cálculos estadísticos y filtros exactos sobre los datos académicos,
    garantizando cero alucinaciones en métricas y notas numéricas (T-13.5).
    """

    @staticmethod
    def tool_resumen_curso(
        contexto: Optional[ContextoCursoChat],
        estudiantes: List[EstudianteChatDto],
    ) -> Dict:
        """Calcula estadísticas generales, tasa de aprobación y desglose por rangos."""
        total = len(estudiantes)
        if total == 0:
            if contexto:
                return {
                    "materia": contexto.materia,
                    "codigo": contexto.codigo,
                    "totalEstudiantes": contexto.totalEstudiantes,
                    "promedioGeneral": contexto.promedioGeneral,
                    "estudiantesEnRiesgo": contexto.estudiantesEnRiesgo,
                    "aprobados": contexto.aprobados,
                    "tasaAprobacionPct": round(
                        (contexto.aprobados / contexto.totalEstudiantes * 100), 1
                    )
                    if contexto.totalEstudiantes > 0
                    else 0.0,
                }
            return {
                "materia": "No especificada",
                "totalEstudiantes": 0,
                "promedioGeneral": 0.0,
                "estudiantesEnRiesgo": 0,
                "aprobados": 0,
                "tasaAprobacionPct": 0.0,
            }

        notas = [e.notaFinal for e in estudiantes]
        promedio = round(sum(notas) / total, 2)
        en_riesgo = [e for e in estudiantes if e.notaFinal < 7.0 or e.enRiesgo]
        aprobados = [e for e in estudiantes if e.notaFinal >= 7.0 and not e.enRiesgo]

        # 4 Rangos institucionales FISEI UTA
        critico = len([n for n in notas if 0.0 <= n < 4.0])
        riesgo = len([n for n in notas if 4.0 <= n < 7.0])
        regular = len([n for n in notas if 7.0 <= n < 8.5])
        sobresaliente = len([n for n in notas if 8.5 <= n <= 10.0])

        return {
            "materia": contexto.materia if contexto else "Asignatura",
            "codigo": contexto.codigo if contexto else "SOF",
            "totalEstudiantes": total,
            "promedioGeneral": promedio,
            "estudiantesEnRiesgo": len(en_riesgo),
            "aprobados": len(aprobados),
            "tasaAprobacionPct": round((len(aprobados) / total) * 100, 1),
            "distribucionRangos": {
                "critico": {"cantidad": critico, "porcentaje": round((critico / total) * 100, 1)},
                "enRiesgo": {"cantidad": riesgo, "porcentaje": round((riesgo / total) * 100, 1)},
                "regular": {"cantidad": regular, "porcentaje": round((regular / total) * 100, 1)},
                "sobresaliente": {
                    "cantidad": sobresaliente,
                    "porcentaje": round((sobresaliente / total) * 100, 1),
                },
            },
        }

    @staticmethod
    def tool_estudiantes_en_riesgo(
        estudiantes: List[EstudianteChatDto], umbral: float = 7.0
    ) -> Dict:
        """Filtra y ordena a los estudiantes con nota deficiente (< 7.00)."""
        reprobados = [e for e in estudiantes if e.notaFinal < umbral or e.enRiesgo]
        # Orden ascendente: más críticos primero
        reprobados_ordenados = sorted(reprobados, key=lambda x: x.notaFinal)

        detalle = [
            {
                "codigo": e.codigo,
                "notaFinal": e.notaFinal,
                "temasDeficientes": e.temasDeficientes,
                "componentes": e.componentes or {},
            }
            for e in reprobados_ordenados
        ]

        return {
            "totalEnRiesgo": len(detalle),
            "umbralAprobatorio": umbral,
            "estudiantes": detalle,
        }

    @staticmethod
    def tool_diagnostico_estudiante(estudiante: EstudianteChatDto) -> Dict:
        """Formula el diagnóstico individual y recomendación de dedicación de tutoría."""
        nota = estudiante.notaFinal
        en_riesgo = nota < 7.0 or estudiante.enRiesgo

        if nota < 4.0:
            nivel = "Crítico"
            dedicacion = 6
            enfoque = "Nivelación urgente en conceptos base y acompañamiento docente directo"
        elif nota < 7.0:
            nivel = "Alto"
            dedicacion = 4
            enfoque = "Refuerzo práctico en talleres APE y resolución de casos de estudio"
        elif nota < 8.5:
            nivel = "Medio"
            dedicacion = 2
            enfoque = "Consolidación de buenas prácticas y afianzamiento de conocimientos"
        else:
            nivel = "Bajo"
            dedicacion = 1
            enfoque = "Profundización autónoma y proyectos de extensión"

        actividades_deficientes = [
            {
                "nombre": ev.nombre,
                "componente": ev.componente,
                "nota": round(ev.nota, 2),
                "temas": ev.temas,
            }
            for ev in estudiante.evaluaciones
            if ev.nota < 7.0
        ]
        actividades_deficientes.sort(key=lambda x: x["nota"])

        detalle_por_tema: Dict[str, List[Dict]] = {}
        for ev in estudiante.evaluaciones:
            for tema in ev.temas or ["Sin tema asignado"]:
                detalle_por_tema.setdefault(tema, []).append(
                    {
                        "actividad": ev.nombre,
                        "componente": ev.componente,
                        "nota": round(ev.nota, 2),
                    }
                )

        return {
            "codigo": estudiante.codigo,
            "notaFinal": nota,
            "enRiesgo": en_riesgo,
            "nivelRiesgo": nivel,
            "horasTutoriaSugeridas": dedicacion,
            "enfoquePedagogico": enfoque,
            "temasDeficientes": estudiante.temasDeficientes,
            "componentes": estudiante.componentes or {},
            "actividadesDeficientes": actividades_deficientes,
            "detallePorTema": {
                tema: {
                    "promedioTema": round(sum(a["nota"] for a in acts) / len(acts), 2),
                    "actividades": acts,
                }
                for tema, acts in detalle_por_tema.items()
            },
        }

    @staticmethod
    def tool_analisis_temas(estudiantes: List[EstudianteChatDto]) -> Dict:
        """Agrega calificaciones por tema curricular para detectar en qué tema hay mayor rezago."""
        acum_temas: Dict[str, Dict] = {}
        for e in estudiantes:
            for ev in e.evaluaciones:
                for tema in ev.temas:
                    registro = acum_temas.setdefault(
                        tema,
                        {
                            "notas": [],
                            "reprobaciones": 0,
                            "estudiantesEnRiesgo": set(),
                            "actividades": set(),
                        },
                    )
                    registro["notas"].append(ev.nota)
                    registro["actividades"].add(ev.nombre)
                    if ev.nota < 7.0:
                        registro["reprobaciones"] += 1
                        registro["estudiantesEnRiesgo"].add(e.codigo)

        if not acum_temas:
            # Respaldo con conteo de temasDeficientes si no llegaron evaluaciones detalladas
            conteo_temas: Dict[str, int] = {}
            for e in estudiantes:
                for tema in e.temasDeficientes:
                    conteo_temas[tema] = conteo_temas.get(tema, 0) + 1
            if not conteo_temas:
                return {"disponible": False, "temas": [], "motivo": "No hay detalle de temas registrado."}
            ordenados = sorted(conteo_temas.items(), key=lambda x: x[1], reverse=True)
            return {
                "disponible": True,
                "temas": [
                    {"tema": t, "estudiantesConDeficiencia": c, "promedioTema": None, "actividades": []}
                    for t, c in ordenados
                ],
                "temaCritico": ordenados[0][0],
            }

        resumen_temas = []
        for tema, info in acum_temas.items():
            notas = info["notas"]
            resumen_temas.append(
                {
                    "tema": tema,
                    "promedioTema": round(sum(notas) / len(notas), 2),
                    "estudiantesConDeficiencia": len(info["estudiantesEnRiesgo"]),
                    "evaluacionesBajoUmbral": info["reprobaciones"],
                    "actividades": sorted(info["actividades"]),
                }
            )
        resumen_temas.sort(key=lambda x: (x["promedioTema"], -x["estudiantesConDeficiencia"]))
        return {
            "disponible": True,
            "temaCritico": resumen_temas[0]["tema"],
            "promedioTemaCritico": resumen_temas[0]["promedioTema"],
            "temas": resumen_temas,
        }

    @staticmethod
    def tool_analisis_componentes(
        contexto: Optional[ContextoCursoChat],
        estudiantes: List[EstudianteChatDto],
    ) -> Dict:
        """Determina cuál componente evaluativo (Tareas, APE, Examen) presenta mayor rezago."""
        if contexto and contexto.componentesPromedios:
            comps = contexto.componentesPromedios
            comp_mas_bajo = min(comps.items(), key=lambda x: x[1])
            return {
                "disponible": True,
                "componentes": comps,
                "componenteCritico": comp_mas_bajo[0],
                "promedioComponenteCritico": comp_mas_bajo[1],
            }

        # Extraer de los estudiantes si tienen componentes
        acum: Dict[str, List[float]] = {}
        for e in estudiantes:
            if e.componentes:
                for comp, val in e.componentes.items():
                    acum.setdefault(comp, []).append(val)

        if acum:
            promedios = {k: round(sum(v) / len(v), 2) for k, v in acum.items()}
            comp_mas_bajo = min(promedios.items(), key=lambda x: x[1])
            return {
                "disponible": True,
                "componentes": promedios,
                "componenteCritico": comp_mas_bajo[0],
                "promedioComponenteCritico": comp_mas_bajo[1],
            }

        # Cuando no hay notas por componente registradas, no inventar valores
        return {
            "disponible": False,
            "componentes": {},
            "componenteCritico": None,
            "promedioComponenteCritico": None,
            "motivo": "No hay notas por componente registradas.",
        }
