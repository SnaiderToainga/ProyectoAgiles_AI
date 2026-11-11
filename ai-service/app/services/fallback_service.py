from app.schemas import DetallePlan, RespuestaPlan, SolicitudPlan


class FallbackService:
    """Motor de contingencia determinista ante ausencia de red, cuota agotada o timeout."""

    @staticmethod
    def generar_plan_contingencia(solicitud: SolicitudPlan) -> RespuestaPlan:
        if solicitud.promedioPonderado < 4.0:
            riesgo = "Crítico"
        elif solicitud.promedioPonderado < 6.0:
            riesgo = "Alto"
        elif solicitud.promedioPonderado < 7.0:
            riesgo = "Medio"
        else:
            riesgo = "Bajo"

        comps_txt = ", ".join(
            f"{c.componente} ({c.promedio:.2f}/10)"
            for c in solicitud.componentesDeficientes
        )
        if not comps_txt:
            comps_txt = "evaluaciones parciales"

        diagnostico = (
            f"El estudiante presenta vacíos formativos en {solicitud.materia} ({solicitud.codigo}) "
            f"con un promedio ponderado de {solicitud.promedioPonderado:.2f}/10.00 en el Parcial {solicitud.parcial}. "
            f"Se identificó bajo desempeño en: {comps_txt}."
        )

        prioridad = "Alta" if solicitud.promedioPonderado < 5.5 else "Media"
        horas = 4 if prioridad == "Alta" else 2

        detalles = [
            DetallePlan(
                temaId=tema.id,
                actividadSugerida=(
                    f"Estudio guiado y resolución de ejercicios prácticos correspondientes "
                    f"a la unidad {tema.unidad}: '{tema.nombre}'."
                ),
                prioridad=prioridad,
                tiempoEstimadoHoras=horas,
                recursoRecomendado=f"Guía Oficial FISEI UTA - Unidad {tema.unidad}: {tema.nombre}",
            )
            for tema in solicitud.temasCriticos
        ]

        return RespuestaPlan(
            nivelRiesgo=riesgo,
            diagnosticoGeneral=diagnostico,
            esFallback=True,
            detalles=detalles,
        )
