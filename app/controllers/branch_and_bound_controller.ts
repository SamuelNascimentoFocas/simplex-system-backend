import type { HttpContext } from '@adonisjs/core/http'
import type { ConstraintInput, ConstraintOperator } from '#services/simplex_service'
import { BranchAndBoundSolver } from '#branch_and_bound/index'

const VALID_OPERATORS: ConstraintOperator[] = ['<=', '>=', '=']

export default class BranchAndBoundController {
  async solve({ request, response }: HttpContext) {
    const data = request.body()

    const { objective, constraints, type } = data

    // ─── Validação: função objetivo ──────────────────────────────────────────

    if (!Array.isArray(objective) || objective.length === 0) {
      return response.badRequest({
        error: 'A função objetivo deve ser um array com pelo menos um número',
      })
    }

    if (!objective.every((value: unknown) => typeof value === 'number')) {
      return response.badRequest({
        error: 'Todos os coeficientes da função objetivo devem ser números',
      })
    }

    // ─── Validação: restrições ───────────────────────────────────────────────

    if (!Array.isArray(constraints) || constraints.length === 0) {
      return response.badRequest({
        error: 'As restrições devem ser um array com pelo menos uma restrição',
      })
    }

    if (!constraints.every((c: any) => typeof c === 'object' && c !== null)) {
      return response.badRequest({
        error: 'Cada restrição deve ser um objeto com os campos "coefficients", "operator" e "rhs"',
      })
    }

    if (
      !constraints.every(
        (c: any) => Array.isArray(c.coefficients) && c.coefficients.length === objective.length
      )
    ) {
      return response.badRequest({
        error: 'Cada restrição deve ter um campo "coefficients" com a mesma quantidade de coeficientes da função objetivo',
      })
    }

    if (
      !constraints.every((c: any) =>
        c.coefficients.every((value: unknown) => typeof value === 'number')
      )
    ) {
      return response.badRequest({
        error: 'Todos os coeficientes de cada restrição devem ser números',
      })
    }

    if (!constraints.every((c: any) => VALID_OPERATORS.includes(c.operator))) {
      return response.badRequest({
        error: 'O campo "operator" de cada restrição deve ser "<=", ">=" ou "="',
      })
    }

    if (!constraints.every((c: any) => typeof c.rhs === 'number' && isFinite(c.rhs))) {
      return response.badRequest({
        error: 'O campo "rhs" de cada restrição deve ser um número',
      })
    }

    // ─── Validação: tipo do problema ─────────────────────────────────────────

    if (type !== 'max' && type !== 'min') {
      return response.badRequest({
        error: 'O tipo do problema deve ser "max" ou "min"',
      })
    }

    // ─── Resolução inteira (Branch and Bound) ────────────────────────────────

    const solver = new BranchAndBoundSolver()

    const result = solver.solve({
      objective,
      constraints: constraints as ConstraintInput[],
      type,
    })

    // ─── Resposta: inviável ──────────────────────────────────────────────────

    if (result.status === 'infeasible') {
      return response.badRequest({
        message: 'Não foi possível resolver o problema',
        status: 'infeasible',
        error: 'O problema não possui solução inteira viável.',
        data: {
          nodesVisited: result.nodesVisited,
          nodesPruned: result.nodesPruned,
          tree: result.tree,
        },
      })
    }

    // ─── Resposta: ótimo ─────────────────────────────────────────────────────

    return response.ok({
      message: 'Branch and Bound executado com sucesso',
      data: {
        objective,
        constraints,
        type,
        status: result.status,
        bestSolution: result.bestSolution,
        bestObjectiveValue: result.bestObjectiveValue,
        nodesVisited: result.nodesVisited,
        nodesPruned: result.nodesPruned,
        tree: result.tree,
      },
    })
  }
}