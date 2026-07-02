type ProblemType = 'max' | 'min'

interface Point {
  x1: number
  x2: number
}

interface Intercepts {
  interceptX1: Point | null
  interceptX2: Point | null
}

interface ConstraintGraphData extends Intercepts {
  index: number
  coefficients: [number, number]
  rhs: number
  validSide: 'origin'
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

const EPSILON = 1e-9
const VIEWPORT_MARGIN = 1.1
const LEVEL_CURVE_COUNT = 5

export default class GraphService {
  compute(
    objective: number[],
    constraints: number[][],
    rhs: number[],
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

    const constraintData = this.computeConstraints(
      constraints as [number, number][],
      rhs
    )

    const feasibleRegion = this.computeFeasibleRegion(
      constraints as [number, number][],
      rhs
    )

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

  private computeConstraints(
    constraints: [number, number][],
    rhs: number[]
  ): ConstraintGraphData[] {
    return constraints.map((row, index) => {
      const [a1, a2] = row
      const b = rhs[index]

      const interceptX1: Point | null =
        Math.abs(a1) > EPSILON ? { x1: b / a1, x2: 0 } : null

      const interceptX2: Point | null =
        Math.abs(a2) > EPSILON ? { x1: 0, x2: b / a2 } : null

      return {
        index,
        coefficients: [a1, a2],
        rhs: b,
        interceptX1,
        interceptX2,
        validSide: 'origin' as const,
      }
    })
  }

  private computeFeasibleRegion(
    constraints: [number, number][],
    rhs: number[]
  ): FeasibleRegion {
    const augmentedConstraints: [number, number][] = [
      ...constraints,
      [-1, 0],
      [0, -1],
    ]
    const augmentedRhs: number[] = [...rhs, 0, 0]

    const candidates: Point[] = []
    const n = augmentedConstraints.length

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const point = this.solveSystem(
          augmentedConstraints[i],
          augmentedRhs[i],
          augmentedConstraints[j],
          augmentedRhs[j]
        )

        if (point === null) continue
        if (!this.isFeasible(point, augmentedConstraints, augmentedRhs)) continue

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

  private isFeasible(
    point: Point,
    constraints: [number, number][],
    rhs: number[]
  ): boolean {
    return constraints.every((row, index) => {
      const lhs = row[0] * point.x1 + row[1] * point.x2
      return lhs <= rhs[index] + EPSILON
    })
  }

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

  private round(value: number): number {
    return Math.round(value * 1e6) / 1e6
  }
}
