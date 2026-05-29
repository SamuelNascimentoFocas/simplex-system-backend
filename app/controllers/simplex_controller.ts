import type { HttpContext } from '@adonisjs/core/http'
import SimplexService from '#services/simplex_service'

export default class SimplexController {
  async solve({ request, response }: HttpContext) {
    const data = request.body()

    const { objective, constraints, rhs, type } = data

    if (!Array.isArray(objective) || objective.length === 0) {
      return response.badRequest({
        error: 'A função objetivo deve ser um array com pelo menos um número',
      })
    }

    if (!objective.every((value) => typeof value === 'number')) {
      return response.badRequest({
        error: 'Todos os coeficientes da função objetivo devem ser números',
      })
    }

    if (!Array.isArray(constraints) || constraints.length === 0) {
      return response.badRequest({
        error: 'As restrições devem ser uma matriz com pelo menos uma linha',
      })
    }

    if (!constraints.every((row) => Array.isArray(row))) {
      return response.badRequest({
        error: 'Cada restrição deve ser um array de coeficientes',
      })
    }

    if (!constraints.every((row) => row.length === objective.length)) {
      return response.badRequest({
        error: 'Cada restrição deve ter a mesma quantidade de coeficientes da função objetivo',
      })
    }

    if (!constraints.every((row) => row.every((value) => typeof value === 'number'))) {
      return response.badRequest({
        error: 'Todos os coeficientes das restrições devem ser números',
      })
    }

    if (!Array.isArray(rhs) || rhs.length !== constraints.length) {
      return response.badRequest({
        error: 'O vetor rhs deve ter a mesma quantidade de valores que o número de restrições',
      })
    }

    if (!rhs.every((value) => typeof value === 'number')) {
      return response.badRequest({
        error: 'Todos os valores de rhs devem ser números',
      })
    }

    if (type !== 'max' && type !== 'min') {
      return response.badRequest({
        error: 'O tipo do problema deve ser "max" ou "min"',
      })
    }

    const simplexService = new SimplexService()

    const tableau = simplexService.createInitialTableau({
      objective,
      constraints,
      rhs,
      type,
    })

    const pivotColumn = simplexService.findPivotColumn(tableau)

    const pivotRow = simplexService.findPivotRow(tableau, pivotColumn)

    const nextTableau = simplexService.pivot(tableau, pivotRow, pivotColumn)

    return response.ok({
      message: 'Tableau inicial criado com sucesso',
      data: {
        objective,
        constraints,
        rhs,
        type,
        tableau,
        pivotColumn,
        pivotRow,
        nextTableau,
      },
    })
  }
}
