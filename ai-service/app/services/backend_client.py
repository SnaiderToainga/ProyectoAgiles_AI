"""Cliente HTTP de la API académica: es la única fuente de datos de las herramientas del agente.

Cada petición viaja con el JWT del docente que hizo la consulta, de modo que el agente solo puede
leer las materias que ese docente tiene asignadas. La API entrega los datos ya seudonimizados.
"""
from typing import Any, Dict, Optional

import httpx

from app.config import settings


CODIGOS_RECUPERABLES = {"agente_estudiante_no_encontrado", "agente_codigo_invalido"}


class BackendError(Exception):
    """Fallo al consultar la API académica. `recuperable` indica si el agente puede seguir."""

    def __init__(self, mensaje: str, status: int = 502, recuperable: bool = False) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status
        self.recuperable = recuperable


class BackendAcademico:
    def __init__(
        self,
        token: str,
        base_url: Optional[str] = None,
        transport: Optional[httpx.BaseTransport] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=(base_url or settings.BACKEND_API_URL).rstrip("/"),
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=timeout or settings.BACKEND_TIMEOUT_SECONDS,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "BackendAcademico":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def datos_curso(self, curso_id: int, parcial_id: int) -> Dict[str, Any]:
        return self._get(f"/api/academico/agente/materias/{curso_id}/parciales/{parcial_id}/estudiantes")

    def estudiante(self, curso_id: int, parcial_id: int, codigo: str) -> Dict[str, Any]:
        return self._get(
            f"/api/academico/agente/materias/{curso_id}/parciales/{parcial_id}/estudiantes/{codigo}"
        )

    def alertas(self, curso_id: int, parcial_id: int) -> Dict[str, Any]:
        return self._get(f"/api/academico/agente/materias/{curso_id}/parciales/{parcial_id}/alertas")

    def registrar_traza(self, traza: Dict[str, Any]) -> Optional[int]:
        datos = self._request("POST", "/api/academico/agente/trazas", json=traza)
        return datos.get("id") if isinstance(datos, dict) else None

    def _get(self, ruta: str) -> Dict[str, Any]:
        return self._request("GET", ruta)

    def _request(self, metodo: str, ruta: str, **kwargs: Any) -> Any:
        try:
            respuesta = self._client.request(metodo, ruta, **kwargs)
        except httpx.TimeoutException as exc:
            raise BackendError("La API académica no respondió a tiempo.", 504) from exc
        except httpx.HTTPError as exc:
            raise BackendError("No se pudo conectar con la API académica.", 503) from exc

        if respuesta.status_code in (401, 403):
            raise BackendError("La sesión no tiene permiso para consultar estos datos académicos.", respuesta.status_code)
        if respuesta.status_code in (400, 404):
            # Solo un estudiante inexistente o un código mal formado se informan al modelo para que continúe;
            # una materia o parcial inexistente invalida toda la consulta.
            recuperable = _codigo(respuesta) in CODIGOS_RECUPERABLES
            raise BackendError(_mensaje(respuesta, "Dato no encontrado."), respuesta.status_code, recuperable=recuperable)
        if respuesta.status_code >= 400:
            raise BackendError(f"La API académica respondió HTTP {respuesta.status_code}.", 502)
        if not respuesta.content:
            return {}
        try:
            return respuesta.json()
        except ValueError as exc:
            raise BackendError("La API académica devolvió una respuesta no válida.", 502) from exc


def _codigo(respuesta: httpx.Response) -> str:
    try:
        datos = respuesta.json()
    except ValueError:
        return ""
    return str(datos.get("code") or "") if isinstance(datos, dict) else ""


def _mensaje(respuesta: httpx.Response, por_defecto: str) -> str:
    try:
        datos = respuesta.json()
    except ValueError:
        return por_defecto
    if isinstance(datos, dict):
        return str(datos.get("detail") or datos.get("title") or por_defecto)
    return por_defecto
