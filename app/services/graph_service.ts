import type { ConstraintInput, ConstraintOperator } from '#services/simplex_service'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProblemType = 'max' | 'min'

interface Point {
  x1: number
  x2: number
}

interface Intercepts {
  interceptX1: Point | null  // ponto onde a reta cruza o eixo x2 = 0
  interceptX2: Point | null  // ponto onde a reta cruza o eixo x1 = 0
}

// validSide indica ao frontend qual lado da reta sombrear:
//   'origin'   → o semiplano que contém a origem (restrições <=  com rhs >= 0)
//   'opposite' → o semiplano oposto à origem     (restrições >= com rhs >  0)
//   'line'     → não há semiplano; a restrição define uma reta (restrições =)
type ValidSide = 'origin' | 'opposite' | 'line'

interface ConstraintGraphData extends Intercepts {
  index: number
  coefficients: [number, number]
  operator: ConstraintOperator
  rhs: number
  validSide: ValidSide
}

interface Vertex extends Point {
  id: string
}

interface FeasibleRegion {
  vertices: Vertex[]
  polygon: string[]
}

interface LevelCurve {
  z: number
  label: string
}

interface ObjectiveFunctionGraphData {
  coefficients: [number, number]
  type: ProblemType
  levelCurves: LevelCurve[]
}

interface OptimalPointGraphData {
  x1: number
  x2: number
  optimalValue: number
  vertexId: string
}

interface Viewport {
  xMax: number
  yMax: number
}

export interface GraphDataAvailable {
  available: true
  viewport: Viewport
  constraints: ConstraintGraphData[]
  feasibleRegion: FeasibleRegion
  objectiveFunction: ObjectiveFunctionGraphData
  optimalPoint: OptimalPointGraphData
}

export interface GraphDataUnavailable {
  available: false
  unavailableReason: string
}

export type GraphData = GraphDataAvailable | GraphDataUnavailable

// ─── Constantes ───────────────────────────────────────────────────────────────

const EPSILON = 1e-9
const VIEWPORT_MARGIN = 1.1
const LEVEL_CURVE_COUNT = 5

// ─── Serviço ──────────────────────────────────────────────────────────────────

export default class GraphService {
  /**
   * Ponto de entrada principal.
   *
   * Recebe ConstraintInput[] com operator por restrição, necessário para
   * calcular corretamente a região viável e o semiplano válido de cada reta.
   */
  compute(
    objective: number[],
    constraints: ConstraintInput[],
    type: ProblemType,
    solution: number[],
    optimalValue: number
  ): GraphData {
    if (objective.length !== 2) {
      return {
        available: false,
        unavailableReason: `O método gráfico está disponível apenas para problemas com 2 variáveis de decisão. Este problema possui ${objective.length} variáveis.`,
      }
    }

    const constraintData = this.computeConstraints(constraints)

    const feasibleRegion = this.computeFeasibleRegion(constraints)

    const optimalPoint = this.findOptimalVertex(
      feasibleRegion.vertices,
      solution,
      optimalValue
    )

    const objectiveFunction = this.computeObjectiveFunction(
      objective as [number, number],
      type,
      optimalValue
    )

    const viewport = this.computeViewport(constraintData, feasibleRegion.vertices)

    return {
      available: true,
      viewport,
      constraints: constraintData,
      feasibleRegion,
      objectiveFunction,
      optimalPoint,
    }
  }

  // ─── Restrições ─────────────────────────────────────────────────────────────

  /**
   * Calcula os interceptos e o semiplano válido de cada restrição.
   *
   * validSide é determinado pelo operador:
   *   <=  →  'origin'   (semiplano que contém a origem, pois 0 <= rhs quando rhs >= 0)
   *   >=  →  'opposite' (semiplano oposto à origem, pois 0 >= rhs só quando rhs <= 0)
   *   =   →  'line'     (não há semiplano — é uma igualdade)
   *
   * Caso especial: se rhs < 0 em uma restrição <=, a origem não satisfaz a
   * restrição e validSide seria 'opposite'. O SimplexService normaliza rhs < 0
   * internamente, mas o GraphService recebe os valores originais — portanto
   * é necessário verificar o sinal do rhs para <= também.
   */
  private computeConstraints(constraints: ConstraintInput[]): ConstraintGraphData[] {
    return constraints.map((constraint, index) => {
      const [a1, a2] = constraint.coefficients as [number, number]
      const { operator, rhs } = constraint

      const interceptX1: Point | null =
        Math.abs(a1) > EPSILON ? { x1: rhs / a1, x2: 0 } : null

      const interceptX2: Point | null =
        Math.abs(a2) > EPSILON ? { x1: 0, x2: rhs / a2 } : null

      const validSide = this.computeValidSide(operator, rhs)

      return {
        index,
        coefficients: [a1, a2],
        operator,
        rhs,
        interceptX1,
        interceptX2,
        validSide,
      }
    })
  }

  /**
   * Determina o semiplano válido de uma restrição em relação à origem.
   *
   * A origem satisfaz a*0 + b*0 = 0. Portanto:
   *   <=: origem satisfaz se 0 <= rhs, ou seja, rhs >= 0 → 'origin'; senão → 'opposite'
   *   >=: origem satisfaz se 0 >= rhs, ou seja, rhs <= 0 → 'origin'; senão → 'opposite'
   *   = : não há semiplano → 'line'
   */
  private computeValidSide(operator: ConstraintOperator, rhs: number): ValidSide {
    if (operator === '=') return 'line'
    if (operator === '<=') return rhs >= -EPSILON ? 'origin' : 'opposite'
    // operator === '>='
    return rhs <= EPSILON ? 'origin' : 'opposite'
  }

  // ─── Região viável ──────────────────────────────────────────────────────────

  /**
   * Calcula todos os vértices da região viável por enumeração de pares
   * de restrições, incluindo as restrições implícitas de não-negatividade.
   *
   * As restrições de não-negatividade (x1 >= 0, x2 >= 0) são representadas
   * como restrições >= com coeficiente unitário, para que isFeasible as trate
   * corretamente junto com as demais.
   */
  private computeFeasibleRegion(constraints: ConstraintInput[]): FeasibleRegion {
    // Adiciona restrições implícitas de não-negatividade como ConstraintInput
    const augmented: ConstraintInput[] = [
      ...constraints,
      { coefficients: [1, 0], operator: '>=', rhs: 0 },
      { coefficients: [0, 1], operator: '>=', rhs: 0 },
    ]

    const candidates: Point[] = []
    const n = augmented.length

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const point = this.solveSystem(
          augmented[i].coefficients as [number, number],
          augmented[i].rhs,
          augmented[j].coefficients as [number, number],
          augmented[j].rhs
        )

        if (point === null) continue
        if (!this.isFeasible(point, augmented)) continue

        candidates.push(point)
      }
    }

    const deduplicated = this.deduplicatePoints(candidates)
    const sorted = this.sortCounterClockwise(deduplicated)

    const vertices: Vertex[] = sorted.map((point, index) => ({
      id: `v${index}`,
      x1: this.round(point.x1),
      x2: this.round(point.x2),
    }))

    const polygon = vertices.map((v) => v.id)

    return { vertices, polygon }
  }

  /**
   * Resolve o sistema linear 2x2:
   *   a1*x1 + a2*x2 = b1
   *   c1*x1 + c2*x2 = b2
   *
   * Retorna null se o sistema for singular (retas paralelas ou coincidentes).
   */
  private solveSystem(
    row1: [number, number],
    b1: number,
    row2: [number, number],
    b2: number
  ): Point | null {
    const [a1, a2] = row1
    const [c1, c2] = row2

    const det = a1 * c2 - a2 * c1

    if (Math.abs(det) < EPSILON) return null

    const x1 = (b1 * c2 - b2 * a2) / det
    const x2 = (a1 * b2 - c1 * b1) / det

    return { x1, x2 }
  }

  /**
   * Verifica se um ponto satisfaz todas as restrições do sistema,
   * respeitando o operador de cada uma.
   *
   * Antes desta correção, todas as restrições eram testadas como <=,
   * o que eliminava incorretamente vértices válidos para >= e =.
   */
  private isFeasible(point: Point, constraints: ConstraintInput[]): boolean {
    return constraints.every((constraint) => {
      const [a1, a2] = constraint.coefficients
      const lhs = a1 * point.x1 + a2 * point.x2
      const { operator, rhs } = constraint

      if (operator === '<=') return lhs <= rhs + EPSILON
      if (operator === '>=') return lhs >= rhs - EPSILON
      // operator === '='
      return Math.abs(lhs - rhs) <= EPSILON
    })
  }

  /**
   * Remove pontos numericamente duplicados (distância euclidiana < EPSILON).
   */
  private deduplicatePoints(points: Point[]): Point[] {
    const unique: Point[] = []

    for (const candidate of points) {
      const isDuplicate = unique.some(
        (existing) =>
          Math.abs(existing.x1 - candidate.x1) < EPSILON &&
          Math.abs(existing.x2 - candidate.x2) < EPSILON
      )
      if (!isDuplicate) unique.push(candidate)
    }

    return unique
  }

  /**
   * Ordena os pontos em sentido anti-horário em torno do centroide.
   * Necessário para que o frontend possa traçar o polígono sem cruzamentos.
   */
  private sortCounterClockwise(points: Point[]): Point[] {
    if (points.length === 0) return []

    const cx = points.reduce((sum, p) => sum + p.x1, 0) / points.length
    const cy = points.reduce((sum, p) => sum + p.x2, 0) / points.length

    return [...points].sort((a, b) => {
      const angleA = Math.atan2(a.x2 - cy, a.x1 - cx)
      const angleB = Math.atan2(b.x2 - cy, b.x1 - cx)
      return angleA - angleB
    })
  }

  // ─── Função objetivo ────────────────────────────────────────────────────────

  /**
   * Gera LEVEL_CURVE_COUNT valores de Z igualmente espaçados entre 0 e Z*
   * para que o frontend trace retas paralelas mostrando a progressão da
   * função objetivo.
   */
  private computeObjectiveFunction(
    objective: [number, number],
    type: ProblemType,
    optimalValue: number
  ): ObjectiveFunctionGraphData {
    const levelCurves: LevelCurve[] = []

    for (let i = 0; i < LEVEL_CURVE_COUNT; i++) {
      const z = this.round((optimalValue * i) / (LEVEL_CURVE_COUNT - 1))
      levelCurves.push({ z, label: `Z = ${z}` })
    }

    return {
      coefficients: objective,
      type,
      levelCurves,
    }
  }

  // ─── Ponto ótimo ────────────────────────────────────────────────────────────

  /**
   * Identifica qual vértice da região viável corresponde ao ponto ótimo
   * usando distância euclidiana mínima para tolerância numérica.
   */
  private findOptimalVertex(
    vertices: Vertex[],
    solution: number[],
    optimalValue: number
  ): OptimalPointGraphData {
    const [x1Sol, x2Sol] = solution

    let bestVertex = vertices[0]
    let bestDistance = Infinity

    for (const vertex of vertices) {
      const distance = Math.sqrt(
        Math.pow(vertex.x1 - x1Sol, 2) + Math.pow(vertex.x2 - x2Sol, 2)
      )
      if (distance < bestDistance) {
        bestDistance = distance
        bestVertex = vertex
      }
    }

    return {
      x1: this.round(x1Sol),
      x2: this.round(x2Sol),
      optimalValue: this.round(optimalValue),
      vertexId: bestVertex.id,
    }
  }

  // ─── Viewport ───────────────────────────────────────────────────────────────

  /**
   * Calcula os limites sugeridos para o canvas do frontend com margem de 10%.
   */
  private computeViewport(
    constraintData: ConstraintGraphData[],
    vertices: Vertex[]
  ): Viewport {
    const x1Values: number[] = []
    const x2Values: number[] = []

    for (const c of constraintData) {
      if (c.interceptX1) x1Values.push(c.interceptX1.x1)
      if (c.interceptX2) x2Values.push(c.interceptX2.x2)
    }

    for (const v of vertices) {
      x1Values.push(v.x1)
      x2Values.push(v.x2)
    }

    const maxX1 = Math.max(0, ...x1Values)
    const maxX2 = Math.max(0, ...x2Values)

    return {
      xMax: this.round(maxX1 * VIEWPORT_MARGIN),
      yMax: this.round(maxX2 * VIEWPORT_MARGIN),
    }
  }

  // ─── Utilitários ────────────────────────────────────────────────────────────

  private round(value: number): number {
    return Math.round(value * 1e6) / 1e6
  }
}