/**
 * Utilidad de anonimización local en el navegador (RNF-02).
 * Garantiza que ningún nombre, apellido ni variante viaje a proveedores externos de LLM (Gemini).
 */

export interface EstudianteAnonimizable {
  nombres: string
  apellidos: string
  codigo: string
}

export interface AnonimizadorContexto {
  anonimizar: (texto: string) => string
  desanonimizar: (texto: string) => string
}

export function crearAnonimizador(estudiantes: EstudianteAnonimizable[]): AnonimizadorContexto {
  // Mapa de texto a los códigos de estudiantes que lo poseen
  const mapaTerminos = new Map<string, { textoOriginal: string; codigos: Set<string> }>()
  // Mapa inverso para restaurar código -> nombre completo preferido
  const mapaRestauracion = new Map<string, string>()

  estudiantes.forEach((e) => {
    const n = e.nombres.trim()
    const a = e.apellidos.trim()
    const cod = e.codigo

    const nombreCompleto = `${n} ${a}`.trim()
    mapaRestauracion.set(cod, `${a} ${n}`.trim() || nombreCompleto)

    const nombresPartes = n.split(/\s+/).filter((p) => p.length >= 3)
    const apellidosPartes = a.split(/\s+/).filter((p) => p.length >= 3)

    // Candidatos de frases completas y combinaciones comunes
    const candidatos: string[] = [
      `${n} ${a}`, // Orden: Nombres Apellidos
      `${a} ${n}`, // Orden: Apellidos Nombres
      n,
      a,
    ]

    // Primer nombre + primer apellido (ej. "Cesar Carrasco" y "Carrasco Cesar")
    if (nombresPartes.length > 0 && apellidosPartes.length > 0) {
      candidatos.push(`${nombresPartes[0]} ${apellidosPartes[0]}`)
      candidatos.push(`${apellidosPartes[0]} ${nombresPartes[0]}`)
    }

    // Cada palabra individual de 3 letras o más
    nombresPartes.forEach((p) => candidatos.push(p))
    apellidosPartes.forEach((p) => candidatos.push(p))

    candidatos.forEach((cand) => {
      const limpia = cand.trim()
      if (limpia.length >= 3) {
        const key = limpia.toLowerCase()
        if (!mapaTerminos.has(key)) {
          mapaTerminos.set(key, { textoOriginal: limpia, codigos: new Set() })
        }
        mapaTerminos.get(key)!.codigos.add(cod)
      }
    })
  })

  // Generar reglas de reemplazo
  const reglas: { texto: string; reemplazo: string }[] = []
  mapaTerminos.forEach((entry) => {
    // Si la palabra la comparten varios estudiantes (ej. dos "Carlos"), usar [ESTUDIANTE]
    const reemplazo = entry.codigos.size === 1 ? Array.from(entry.codigos)[0] : '[ESTUDIANTE]'
    reglas.push({ texto: entry.textoOriginal, reemplazo })
  })

  // Regla 3: Aplicar primero los patrones más largos para evitar colisiones
  reglas.sort((a, b) => b.texto.length - a.texto.length)

  function anonimizar(str: string): string {
    if (!str) return str
    let resultado = str
    for (const r of reglas) {
      const escaped = r.texto.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
      // Regla 5: Límites Unicode para no fallar con tildes, eñes ni caracteres UTF-8
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gui')
      resultado = resultado.replace(regex, r.reemplazo)
    }
    return resultado
  }

  function desanonimizar(str: string): string {
    if (!str) return str
    let resultado = str
    mapaRestauracion.forEach((nombreReal, cod) => {
      resultado = resultado.replaceAll(cod, nombreReal)
    })
    return resultado
  }

  return { anonimizar, desanonimizar }
}
