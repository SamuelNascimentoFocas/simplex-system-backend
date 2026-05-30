import { InvalidInputException } from './exceptions.js'
import type { SimplexProblem } from './standard_form_converter.js'

const VALID_OPERATORS = ['<=', '>=', '=']
const VALID_TYPES = ['max', 'min']

export default function validateProblem(problem: SimplexProblem) {
  if (!problem || typeof problem !== 'object') {
    throw new InvalidInputException('O problema deve ser um objeto.')
  }

  if (!VALID_TYPES.includes(problem.type)) {
    throw new InvalidInputException(
      `O campo "type" deve ser "max" ou "min". Recebido: "${problem.type}".`
    )
  }

  if (!Array.isArray(problem.objective) || problem.objective.length === 0) {
    throw new InvalidInputException(
      'O campo "objective" deve ser um array não vazio de coeficientes.'
    )
  }

  const hasInvalidObjectiveCoefficient = problem.objective.some((coefficient) => {
    return typeof coefficient !== 'number' || !Number.isFinite(coefficient)
  })

  if (hasInvalidObjectiveCoefficient) {
    throw new InvalidInputException(
      'Todos os coeficientes da função objetivo devem ser números finitos.'
    )
  }

  const numberOfVariables = problem.objective.length

  if (!Array.isArray(problem.constraints) || problem.constraints.length === 0) {
    throw new InvalidInputException('O campo "constraints" deve ser um array não vazio.')
  }

  for (const [index, constraint] of problem.constraints.entries()) {
    const prefix = `Restrição [${index}]`

    if (
      !Array.isArray(constraint.coefficients) ||
      constraint.coefficients.length !== numberOfVariables
    ) {
      throw new InvalidInputException(
        `${prefix}: "coefficients" deve ter ${numberOfVariables} elemento(s), igual à função objetivo.`
      )
    }

    const hasInvalidConstraintCoefficient = constraint.coefficients.some((coefficient) => {
      return typeof coefficient !== 'number' || !Number.isFinite(coefficient)
    })

    if (hasInvalidConstraintCoefficient) {
      throw new InvalidInputException(`${prefix}: todos os coeficientes devem ser números finitos.`)
    }

    if (!VALID_OPERATORS.includes(constraint.operator)) {
      throw new InvalidInputException(
        `${prefix}: "operator" deve ser um de ${VALID_OPERATORS.join(', ')}. Recebido: "${constraint.operator}".`
      )
    }

    if (typeof constraint.value !== 'number' || !Number.isFinite(constraint.value)) {
      throw new InvalidInputException(`${prefix}: "value" deve ser um número finito.`)
    }
  }
}
