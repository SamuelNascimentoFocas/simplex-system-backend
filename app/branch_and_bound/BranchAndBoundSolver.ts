import SimplexService from '#services/simplex_service'
import type { ConstraintInput } from '#services/simplex_service'
import { createNode, resetNodeCounter } from './BranchNode.js'
import {
  BranchAndBoundInput,
  BranchAndBoundResult,
  BranchCut,
  BranchNode,
} from './types.js'

const EPSILON = 1e-6

export default class BranchAndBoundSolver {
  private simplexService: SimplexService
  private nodeMap: Map<string, BranchNode>

  constructor() {
    this.simplexService = new SimplexService()
    this.nodeMap = new Map()
  }

  solve(input: BranchAndBoundInput): BranchAndBoundResult {
    resetNodeCounter()
    this.nodeMap = new Map()

    const { objective, constraints, type } = input
    const numDecisionVars = objective.length

    let bestSolution: number[] | null = null
    let bestObjectiveValue: number | null = null
    let nodesVisited = 0
    let nodesPruned = 0

    const queue: BranchNode[] = []

    const root = createNode(null, 0, [])
    this.nodeMap.set(root.id, root)
    queue.push(root)

    while (queue.length > 0) {
      const node = queue.shift()!
      nodesVisited++

      // Monta as restrições do nó: originais + cortes de branching acumulados
      const nodeConstraints = this.buildNodeConstraints(
        constraints,
        node.cuts,
        numDecisionVars
      )

      // Usa createInitialTableauWithMeta para obter artificialVarIndices,
      // necessários para detectar inviabilidade corretamente com Big M.
      let standardForm: ReturnType<SimplexService['createInitialTableauWithMeta']>
      let result: ReturnType<SimplexService['solve']>

      try {
        standardForm = this.simplexService.createInitialTableauWithMeta({
          objective,
          constraints: nodeConstraints,
          type,
        })
        result = this.simplexService.solve(standardForm.tableau)
      } catch {
        // solve() lança erro apenas para problema ilimitado
        node.status = 'unbounded'
        nodesPruned++
        continue
      }

      // Detecta inviabilidade via SimplexService, que verifica se alguma
      // variável artificial permaneceu na base com valor positivo.
      // Essa é a verificação correta para Big M — a heurística de RHS
      // negativo no tableau final não é mais adequada.
      if (this.simplexService.isInfeasible(result.finalTableau, standardForm.artificialVarIndices)) {
        node.status = 'infeasible'
        nodesPruned++
        continue
      }

      const extracted = this.simplexService.extractSolution(
        result.finalTableau,
        numDecisionVars,
        type
      )

      const objValue = extracted.optimalValue
      const solution = extracted.solution

      node.solution = solution
      node.objectiveValue = objValue

      // Poda por bound
      if (bestObjectiveValue !== null) {
        const pruneByBound =
          type === 'max'
            ? objValue <= bestObjectiveValue - EPSILON
            : objValue >= bestObjectiveValue + EPSILON

        if (pruneByBound) {
          node.status = 'pruned'
          nodesPruned++
          continue
        }
      }

      // Verifica integralidade
      const fractionalIndex = this.findFractionalVariable(solution)

      if (fractionalIndex === -1) {
        // Solução inteira — candidata ao ótimo
        node.status = 'integer'

        const isBetter =
          bestObjectiveValue === null ||
          (type === 'max' && objValue > bestObjectiveValue + EPSILON) ||
          (type === 'min' && objValue < bestObjectiveValue - EPSILON)

        if (isBetter) {
          bestSolution = [...solution]
          bestObjectiveValue = objValue
        }
        continue
      }

      // Ramificação: cria dois filhos com cortes sobre a variável fracionária
      node.status = 'fractional'
      const fractionalValue = solution[fractionalIndex]

      const floorCut: BranchCut = {
        variableIndex: fractionalIndex,
        bound: Math.floor(fractionalValue),
        type: 'leq',
      }

      const ceilCut: BranchCut = {
        variableIndex: fractionalIndex,
        bound: Math.ceil(fractionalValue),
        type: 'geq',
      }

      const leftChild = createNode(node.id, node.level + 1, [...node.cuts, floorCut])
      const rightChild = createNode(node.id, node.level + 1, [...node.cuts, ceilCut])

      node.childrenIds = [leftChild.id, rightChild.id]

      this.nodeMap.set(leftChild.id, leftChild)
      this.nodeMap.set(rightChild.id, rightChild)

      queue.push(leftChild, rightChild)
    }

    if (bestSolution === null) {
      return {
        status: 'infeasible',
        bestSolution: null,
        bestObjectiveValue: null,
        nodesVisited,
        nodesPruned,
        tree: Array.from(this.nodeMap.values()),
      }
    }

    return {
      status: 'optimal',
      bestSolution,
      bestObjectiveValue,
      nodesVisited,
      nodesPruned,
      tree: Array.from(this.nodeMap.values()),
    }
  }

  /**
   * Constrói a lista de restrições do nó combinando as restrições originais
   * com os cortes de branching acumulados desde a raiz.
   *
   * Cada corte é expresso diretamente como ConstraintInput com o operador
   * correto, eliminando o workaround anterior de coeficiente negativo + RHS
   * negado. O SimplexService trata os operadores >= e = via Big M.
   *
   * Corte leq: x_j <= floor(v)  →  operator: '<='
   * Corte geq: x_j >= ceil(v)   →  operator: '>='
   */
  private buildNodeConstraints(
    originalConstraints: ConstraintInput[],
    cuts: BranchCut[],
    numDecisionVars: number
  ): ConstraintInput[] {
    const nodeConstraints: ConstraintInput[] = originalConstraints.map((c) => ({ ...c }))

    for (const cut of cuts) {
      const coefficients = Array(numDecisionVars).fill(0)
      coefficients[cut.variableIndex] = 1

      const cutConstraint: ConstraintInput = {
        coefficients,
        operator: cut.type === 'leq' ? '<=' : '>=',
        rhs: cut.bound,
      }

      nodeConstraints.push(cutConstraint)
    }

    return nodeConstraints
  }

  /**
   * Retorna o índice da primeira variável de decisão com valor fracionário.
   * Retorna -1 se todas forem inteiras (dentro de EPSILON).
   */
  private findFractionalVariable(solution: number[]): number {
    for (let i = 0; i < solution.length; i++) {
      const value = solution[i]
      const fractionalPart = Math.abs(value - Math.round(value))

      if (fractionalPart > EPSILON) {
        return i
      }
    }
    return -1
  }
}