import SimplexService from '#services/simplex_service'
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

    const { objective, constraints, rhs, type } = input
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

      const { nodeConstraints, nodeRhs } = this.buildNodeConstraints(
        constraints,
        rhs,
        node.cuts,
        numDecisionVars
      )

      let tableau: number[][]
      let result: ReturnType<SimplexService['solve']> | undefined

      try {
        tableau = this.simplexService.createInitialTableau({
          objective,
          constraints: nodeConstraints,
          rhs: nodeRhs,
          type,
        })
        result = this.simplexService.solve(tableau)
      } catch {
        node.status = 'unbounded'
        nodesPruned++
        continue
      }

      const extracted = this.simplexService.extractSolution(
        result.finalTableau,
        numDecisionVars
      )

      if (this.isInfeasible(result.finalTableau, nodeRhs)) {
        node.status = 'infeasible'
        nodesPruned++
        continue
      }

      const objValue = extracted.optimalValue
      const solution = extracted.solution

      node.solution = solution
      node.objectiveValue = objValue

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

      const fractionalIndex = this.findFractionalVariable(solution)

      if (fractionalIndex === -1) {
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

  private buildNodeConstraints(
    originalConstraints: number[][],
    originalRhs: number[],
    cuts: BranchCut[],
    numDecisionVars: number
  ): { nodeConstraints: number[][]; nodeRhs: number[] } {
    const nodeConstraints = originalConstraints.map((row) => [...row])
    const nodeRhs = [...originalRhs]

    for (const cut of cuts) {
      const cutRow = Array(numDecisionVars).fill(0)

      if (cut.type === 'leq') {
        cutRow[cut.variableIndex] = 1
        nodeConstraints.push(cutRow)
        nodeRhs.push(cut.bound)
      } else {
        cutRow[cut.variableIndex] = -1
        nodeConstraints.push(cutRow)
        nodeRhs.push(-cut.bound)
      }
    }

    return { nodeConstraints, nodeRhs }
  }

  private isInfeasible(finalTableau: number[][], nodeRhs: number[]): boolean {
    const lastRowIndex = finalTableau.length - 1
    const lastColIndex = finalTableau[0].length - 1

    for (let rowIndex = 0; rowIndex < lastRowIndex; rowIndex++) {
      const rhsValue = finalTableau[rowIndex][lastColIndex]
      if (rhsValue < -EPSILON) {
        return true
      }
    }

    return false
  }

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