import { BranchCut, BranchNode, NodeStatus } from './types.js'

let nodeCounter = 0

export function createNode(
  parentId: string | null,
  level: number,
  cuts: BranchCut[]
): BranchNode {
  nodeCounter++
  return {
    id: `node_${nodeCounter}`,
    level,
    parentId,
    childrenIds: [],
    cuts,
    status: 'pending',
    solution: null,
    objectiveValue: null,
  }
}

export function resetNodeCounter() {
  nodeCounter = 0
}