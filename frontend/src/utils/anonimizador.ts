/**
 * Utilidad de anonimización local en el navegador (RNF-02 / Sprint 3).
 * Garantiza que ningún nombre, apellido ni variante viaje a proveedores externos de LLM (Gemini).
 *
 * Implementa resolución no solapada de intervalos con tolerancia a diacríticos (tildes, eñes)
 * sin descomposición NFD sobre el texto original para preservar posiciones, longitudes,
 * saltos de línea y signos de puntuación originales.
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

// Mapa de equivalencia de caracteres diacríticos para generar clases de expresiones regulares
const DIACRITIC_MAP: Record<string, string> = {
  a: '[aáàäâAÁÀÄÂ]',
  á: '[aáàäâAÁÀÄÂ]',
  à: '[aáàäâAÁÀÄÂ]',
  ä: '[aáàäâAÁÀÄÂ]',
  â: '[aáàäâAÁÀÄÂ]',
  e: '[eéèëêEÉÈËÊ]',
  é: '[eéèëêEÉÈËÊ]',
  è: '[eéèëêEÉÈËÊ]',
  ë: '[eéèëêEÉÈËÊ]',
  ê: '[eéèëêEÉÈËÊ]',
  i: '[iíìïîIÍÌÏÎ]',
  í: '[iíìïîIÍÌÏÎ]',
  ì: '[iíìïîIÍÌÏÎ]',
  ï: '[iíìïîIÍÌÏÎ]',
  î: '[iíìïîIÍÌÏÎ]',
  o: '[oóòöôOÓÒÖÔ]',
  ó: '[oóòöôOÓÒÖÔ]',
  ò: '[oóòöôOÓÒÖÔ]',
  ö: '[oóòöôOÓÒÖÔ]',
  ô: '[oóòöôOÓÒÖÔ]',
  u: '[uúùüûUÚÙÜÛ]',
  ú: '[uúùüûUÚÙÜÛ]',
  ù: '[uúùüûUÚÙÜÛ]',
  ü: '[uúùüûUÚÙÜÛ]',
  û: '[uúùüûUÚÙÜÛ]',
  n: '[nñNÑ]',
  ñ: '[nñNÑ]',
  c: '[cçCÇ]',
  ç: '[cçCÇ]',
}

/**
 * Genera un patrón de expresión regular que coincide con el texto independientemente
 * de si el usuario escribe con o sin tildes, diéresis o eñes, sin alterar el texto original.
 */
function generarPatronDiacritico(texto: string): string {
  let patron = ''
  for (const ch of texto) {
    const low = ch.toLowerCase()
    if (DIACRITIC_MAP[low]) {
      patron += DIACRITIC_MAP[low]
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      patron += `\\${ch}`
    } else if (/\s+/.test(ch)) {
      patron += '\\s+'
    } else {
      patron += `[${ch.toLowerCase()}${ch.toUpperCase()}]`
    }
  }
  return patron
}

/**
 * Normaliza claves internas para identificar términos homónimos compartidos.
 */
function normalizarClaveComparacion(str: string): string {
  return str
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    .trim()
}

interface CoincidenciaIntervalo {
  start: number
  end: number
  length: number
  reemplazo: string
}

export function crearAnonimizador(estudiantes: EstudianteAnonimizable[]): AnonimizadorContexto {
  const mapaTerminos = new Map<string, { textoBase: string; codigos: Set<string> }>()
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

    // Combinaciones cruzadas de cualquier nombre con cualquier apellido (y viceversa)
    nombresPartes.forEach((np) => {
      apellidosPartes.forEach((ap) => {
        candidatos.push(`${np} ${ap}`)
        candidatos.push(`${ap} ${np}`)
      })
    })

    // Sub-frases compuestas comunes (ej. "Cesar Steven Carrasco" o "Cesar Carrasco Manotoa")
    if (nombresPartes.length >= 2 && apellidosPartes.length >= 1) {
      candidatos.push(`${nombresPartes.join(' ')} ${apellidosPartes[0]}`)
      candidatos.push(`${apellidosPartes[0]} ${nombresPartes.join(' ')}`)
    }
    if (nombresPartes.length >= 1 && apellidosPartes.length >= 2) {
      candidatos.push(`${nombresPartes[0]} ${apellidosPartes.join(' ')}`)
      candidatos.push(`${apellidosPartes.join(' ')} ${nombresPartes[0]}`)
    }

    // Palabras individuales de 3 letras o más
    nombresPartes.forEach((p) => candidatos.push(p))
    apellidosPartes.forEach((p) => candidatos.push(p))

    candidatos.forEach((cand) => {
      const limpia = cand.trim()
      if (limpia.length >= 3) {
        const key = normalizarClaveComparacion(limpia)
        if (!mapaTerminos.has(key)) {
          mapaTerminos.set(key, { textoBase: limpia, codigos: new Set<string>() })
        }
        mapaTerminos.get(key)!.codigos.add(cod)
      }
    })
  })

  // Generar reglas con expresiones regulares Unicode
  const reglas: { regex: RegExp; reemplazo: string; pesoLongitud: number }[] = []

  mapaTerminos.forEach((entry) => {
    // Si la palabra la comparten varios estudiantes (ej. dos "Carlos"), usar [ESTUDIANTE]
    const reemplazo = entry.codigos.size === 1 ? Array.from(entry.codigos)[0] : '[ESTUDIANTE]'
    const patron = generarPatronDiacritico(entry.textoBase)
    // Límites Unicode para asegurar palabras completas sin fallar con tildes ni eñes
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${patron}(?![\\p{L}\\p{N}])`, 'gui')
    reglas.push({ regex, reemplazo, pesoLongitud: entry.textoBase.length })
  })

  // Regla: Priorizar patrones más largos primero
  reglas.sort((a, b) => b.pesoLongitud - a.pesoLongitud)

  function anonimizar(str: string): string {
    if (!str) return str

    // 1. Recolectar todas las coincidencias de todas las reglas en el texto original
    const coincidencias: CoincidenciaIntervalo[] = []

    for (const regla of reglas) {
      regla.regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regla.regex.exec(str)) !== null) {
        coincidencias.push({
          start: match.index,
          end: match.index + match[0].length,
          length: match[0].length,
          reemplazo: regla.reemplazo,
        })
      }
    }

    if (coincidencias.length === 0) return str

    // 2. Ordenar coincidencias por longitud descendente (la coincidencia más larga manda)
    coincidencias.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length
      return a.start - b.start
    })

    // 3. Selección codiciosa de intervalos no solapados (Interval Scheduling)
    // Esto garantiza que "Andrés Peña" se reemplace una sola vez como "EST-002"
    // y no como "EST-002 EST-002" por coincidencias parciales redundantes.
    const seleccionadas: CoincidenciaIntervalo[] = []
    const ocupado = new Array<boolean>(str.length).fill(false)

    for (const c of coincidencias) {
      let solapa = false
      for (let i = c.start; i < c.end; i++) {
        if (ocupado[i]) {
          solapa = true
          break
        }
      }

      if (!solapa) {
        seleccionadas.push(c)
        for (let i = c.start; i < c.end; i++) {
          ocupado[i] = true
        }
      }
    }

    // 4. Ordenar los intervalos seleccionados cronológicamente por su posición inicial
    seleccionadas.sort((a, b) => a.start - b.start)

    // 5. Reconstruir el texto reemplazando únicamente los intervalos identificados
    let resultado = ''
    let cursor = 0

    for (const sel of seleccionadas) {
      resultado += str.slice(cursor, sel.start)
      resultado += sel.reemplazo
      cursor = sel.end
    }
    resultado += str.slice(cursor)

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
