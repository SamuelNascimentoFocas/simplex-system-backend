import type { HttpContext } from '@adonisjs/core/http'
import SimplexService from '#services/simplex_service'
import type { ConstraintInput, ConstraintOperator } from '#services/simplex_service'
import GraphService from '#services/graph_service'

const VALID_OPERATORS: ConstraintOperator[] = ['<=', '>=', '=']

export default class SimplexController {
  async solve({ request, response }: HttpContext) {
    const data = request.body()

    const { objective, constraints, type } = data

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

    if (type !== 'max' && type !== 'min') {
      return response.badRequest({
        error: 'O tipo do problema deve ser "max" ou "min"',
      })
    }

    const simplexService = new SimplexService()

    const standardForm = simplexService.createInitialTableauWithMeta({
      objective,
      constraints: constraints as ConstraintInput[],
      type,
    })

    let result

    try {
      result = simplexService.solve(standardForm.tableau)
    } catch (error) {
      return response.badRequest({
        message: 'Não foi possível resolver o problema',
        status: 'unbounded',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }

    if (simplexService.isInfeasible(result.finalTableau, standardForm.artificialVarIndices)) {
      return response.badRequest({
        message: 'Não foi possível resolver o problema',
        status: 'infeasible',
        error: 'O problema não possui solução viável. As restrições são incompatíveis entre si.',
      })
    }

    const extractedResult = simplexService.extractSolution(
      result.finalTableau,
      objective.length
    )

    const hasMultipleSolutions = simplexService.hasMultipleOptimalSolutions(
      result.finalTableau,
      objective.length
    )

    const graphService = new GraphService()

    const graphConstraintCoefficients = (constraints as ConstraintInput[]).map(
      (c) => c.coefficients
    )
    const graphRhs = (constraints as ConstraintInput[]).map((c) => c.rhs)

    const graphData = graphService.compute(
      objective,
      graphConstraintCoefficients,
      graphRhs,
      type,
      extractedResult.solution,
      extractedResult.optimalValue
    )

    return response.ok({
      message: 'Simplex executado com sucesso',
      data: {
        objective,
        constraints,
        type,
        status: 'optimal',
        solution: extractedResult.solution,
        optimalValue: extractedResult.optimalValue,
        hasMultipleSolutions,
        iterationsCount: result.iterations.length - 1,
        initialTableau: standardForm.tableau,
        finalTableau: result.finalTableau,
        iterations: result.iterations,
        graphData,
      },
    })
  }
}