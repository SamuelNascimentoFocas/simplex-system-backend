import type { ConstraintInput } from '#services/simplex_service'

export type ProblemType = 'max' | 'min'

export interface BranchAndBoundInput {
  objective: number[]
  constraints: ConstraintInput[]
  type: ProblemType
}

// Uma restrição adicional gerada pelo branching:
// representa x_j <= bound (type: 'leq') ou x_j >= bound (type: 'geq')
export interface BranchCut {
  variableIndex: number
  bound: number
  type: 'leq' | 'geq'
}

export type NodeStatus =
  | 'pending'
  | 'fractional'
  | 'integer'
  | 'infeasible'
  | 'unbounded'
  | 'pruned'

export interface BranchNode {
  id: string
  level: number
  parentId: string | null
  childrenIds: string[]
  cuts: BranchCut[]
  status: NodeStatus
  solution: number[] | null
  objectiveValue: number | null
}

export interface BranchAndBoundResult {
  status: 'optimal' | 'infeasible' | 'unbounded'
  bestSolution: number[] | null
  bestObjectiveValue: number | null
  nodesVisited: number
  nodesPruned: number
  tree: BranchNode[]
}