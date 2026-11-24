import { describe, it, expect } from 'vitest'
import { crearAnonimizador, type EstudianteAnonimizable } from './anonimizador'

describe('Anonimizador de Privacidad RNF-02 (T-13.3 / Sprint 3)', () => {
  const estudiantesMuestra: EstudianteAnonimizable[] = [
    { nombres: 'Cesar Steven', apellidos: 'Carrasco Manotoa', codigo: 'EST-001' },
    { nombres: 'Andrés', apellidos: 'Peña', codigo: 'EST-002' },
    { nombres: 'Estivén', apellidos: 'Chiluisa', codigo: 'EST-003' },
    { nombres: 'Carlos Alberto', apellidos: 'Gómez', codigo: 'EST-004' },
    { nombres: 'Carlos', apellidos: 'Pérez', codigo: 'EST-005' },
    { nombres: 'María Belén', apellidos: 'Toapanta', codigo: 'EST-006' },
  ]

  const { anonimizar, desanonimizar } = crearAnonimizador(estudiantesMuestra)

  // 1. Anonimización de nombres completos
  it('1. Debe anonimizar nombres completos tanto en orden Nombres-Apellidos como Apellidos-Nombres', () => {
    expect(anonimizar('Informe de Cesar Steven Carrasco Manotoa')).toBe('Informe de EST-001')
    expect(anonimizar('Registro de Carrasco Manotoa Cesar Steven')).toBe('Registro de EST-001')
  })

  // 2. Anonimización de nombres sin tildes
  it('2. Debe reconocer nombres aunque el docente escriba sin tilde (Andres, Estiven, Maria, Belen)', () => {
    expect(anonimizar('¿Cómo va Andres?')).toBe('¿Cómo va EST-002?')
    expect(anonimizar('¿Cómo va Estiven?')).toBe('¿Cómo va EST-003?')
    expect(anonimizar('¿Cómo va Maria?')).toBe('¿Cómo va EST-006?')
    expect(anonimizar('¿Cómo va Belen?')).toBe('¿Cómo va EST-006?')
  })

  // 3. Anonimización de apellidos con ñ y sin ñ
  it('3. Debe reconocer apellidos con ñ y sin ñ (Peña y Pena)', () => {
    expect(anonimizar('Notas de Peña')).toBe('Notas de EST-002')
    expect(anonimizar('Notas de Pena')).toBe('Notas de EST-002')
  })

  // 4. Reconocimiento de nombres y apellidos combinados
  it('4. Debe reconocer primer nombre y primer apellido combinados', () => {
    expect(anonimizar('Consulta sobre Cesar Carrasco')).toBe('Consulta sobre EST-001')
    expect(anonimizar('Consulta sobre Carrasco Cesar')).toBe('Consulta sobre EST-001')
  })

  // 5. Reconocimiento de nombres que contengan segundo nombre
  it('5. Debe reconocer segundo nombre aislado o con apellido', () => {
    expect(anonimizar('¿Qué nota tiene Steven?')).toBe('¿Qué nota tiene EST-001?')
    expect(anonimizar('¿Qué nota tiene Steven Carrasco?')).toBe('¿Qué nota tiene EST-001?')
  })

  // 6. Sustitución correcta por identificadores como EST-001
  it('6. Debe sustituir exactamente por el código correspondiente a cada alumno', () => {
    expect(anonimizar('Cesar Steven')).toBe('EST-001')
    expect(anonimizar('Andrés Peña')).toBe('EST-002')
    expect(anonimizar('Estivén Chiluisa')).toBe('EST-003')
  })

  // 7. Reutilización del mismo identificador para una misma persona
  it('7. Debe reutilizar el mismo identificador para múltiples menciones de la misma persona', () => {
    const texto = 'Andrés entregó el taller pero Peña no dio el examen final.'
    expect(anonimizar(texto)).toBe('EST-002 entregó el taller pero EST-002 no dio el examen final.')
  })

  // 8. Ausencia de identificadores duplicados (Evitar EST-002 EST-002)
  it('8. No debe producir identificadores duplicados ante nombres y apellidos contiguos', () => {
    // Caso crítico reportado en la revisión: "Andrés Peña" -> "EST-002", NO "EST-002 EST-002"
    expect(anonimizar('Andrés Peña')).toBe('EST-002')
    expect(anonimizar('Andres Pena')).toBe('EST-002')
    expect(anonimizar('Cesar Steven Carrasco Manotoa')).toBe('EST-001')
    expect(anonimizar('Estiven Chiluisa')).toBe('EST-003')
  })

  // 9. Conservación de signos de puntuación
  it('9. Debe conservar intactos los signos de puntuación vecinos (¿?, ¡!, comas, puntos)', () => {
    expect(anonimizar('¿Cómo va Cesar? ¿Y Carrasco? ¡Atención con Peña!'))
      .toBe('¿Cómo va EST-001? ¿Y EST-001? ¡Atención con EST-002!')
  })

  // 10. Conservación de espacios y saltos de línea
  it('10. Debe conservar exactamente los espacios, tabulaciones y saltos de línea', () => {
    const texto = 'Reporte:\n  * Andres Pena\n  * Estiven Chiluisa\nFin del reporte.'
    const esperado = 'Reporte:\n  * EST-002\n  * EST-003\nFin del reporte.'
    expect(anonimizar(texto)).toBe(esperado)
  })

  // 11. Textos sin nombres personales que deben permanecer intactos
  it('11. Textos sin nombres personales deben permanecer 100% idénticos', () => {
    const textoInmune = '¿Cuál es el promedio general del curso de Metodologías Ágiles en APE?'
    expect(anonimizar(textoInmune)).toBe(textoInmune)
  })

  // 12. Casos con nombres parcialmente coincidentes y homónimos ([ESTUDIANTE])
  it('12. Debe resolver homónimos compartidos como [ESTUDIANTE] y específicos con su código', () => {
    // Dos estudiantes llamados "Carlos" (Carlos Alberto Gómez y Carlos Pérez)
    expect(anonimizar('¿Cómo va Carlos?')).toBe('¿Cómo va [ESTUDIANTE]?')
    // Con apellido específico se desambigua exactamente
    expect(anonimizar('¿Cómo va Carlos Pérez?')).toBe('¿Cómo va EST-005?')
    expect(anonimizar('¿Cómo va Carlos Perez?')).toBe('¿Cómo va EST-005?')
    expect(anonimizar('¿Cómo va Carlos Gomez?')).toBe('¿Cómo va EST-004?')
  })

  // 13. Desanonimización al recibir respuesta de IA
  it('13. Debe restaurar los códigos por el nombre del alumno para la lectura del docente', () => {
    const respuestaIa = 'El estudiante EST-001 tiene un promedio de 8.50 y EST-002 tiene 5.40.'
    const restaurado = desanonimizar(respuestaIa)
    expect(restaurado).toContain('Carrasco Manotoa Cesar Steven')
    expect(restaurado).toContain('Peña Andrés')
    expect(restaurado).not.toContain('EST-001')
    expect(restaurado).not.toContain('EST-002')
  })

  // 14. Insensibilidad a mayúsculas y minúsculas mixtas
  it('14. Debe ser insensible a mayúsculas y minúsculas mixtas', () => {
    expect(anonimizar('cEsAr StEvEn CaRrAsCo')).toBe('EST-001')
    expect(anonimizar('ANDRES PENA')).toBe('EST-002')
    expect(anonimizar('estiven chiluisa')).toBe('EST-003')
  })

  // 15. Nombres con espacios múltiples intermedios
  it('15. Debe reconocer nombres con espacios múltiples intermedios', () => {
    expect(anonimizar('Andres    Pena')).toBe('EST-002')
    expect(anonimizar('Cesar  Carrasco')).toBe('EST-001')
  })
})
