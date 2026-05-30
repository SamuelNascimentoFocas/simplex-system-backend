type ConstraintOperator = '<=' | '>=' | '='
type ProblemType = 'max' | 'min'

export type SimplexConstraint = {
  coefficients: number[]
  operator: ConstraintOperator
  value: number
}

export type SimplexProblem = {
  type: ProblemType
  objective: number[]
  constraints: SimplexConstraint[]
}

type StandardConstraint = {
  coefficients: number[]
  extraVars: Record<number, number>
  rhs: number
  originalOperator: ConstraintOperator
}

export type StandardForm = {
  type: ProblemType
  isMinimization: boolean
  objective: number[]
  numOriginalVars: number
  numConstraints: number
  totalVars: number
  variableNames: string[]
  standardConstraints: StandardConstraint[]
  artificialVarIndices: number[]
  surplusToArtificial: Record<number, number>
  hasArtificialVars: boolean
}

export default class StandardFormConverter {
  convert(problem: SimplexProblem): StandardForm {
    const { type, objective, constraints } = problem

    const numOriginalVars = objective.length
    const numConstraints = constraints.length
    const isMinimization = type === 'min'

    const variableNames = this.buildOriginalVarNames(numOriginalVars)
    const standardConstraints: StandardConstraint[] = []
    const artificialVarIndices: number[] = []
    const surplusToArtificial: Record<number, number> = {}

    let extraVarOffset = numOriginalVars

    for (let i = 0; i < numConstraints; i++) {
      const { coefficients, operator, value } = constraints[i]

      let rhs = value
      let row = [...coefficients]
      const extraVars: Record<number, number> = {}
      let effectiveOperator = operator

      if (rhs < 0) {
        row = row.map((coefficient) => -coefficient)
        rhs = -rhs

        if (operator === '<=') effectiveOperator = '>='
        else if (operator === '>=') effectiveOperator = '<='
      }

      if (effectiveOperator === '<=') {
        const slackIndex = extraVarOffset++
        extraVars[slackIndex] = 1
        variableNames.push(`s${i + 1}`)
      } else if (effectiveOperator === '>=') {
        const surplusIndex = extraVarOffset++
        extraVars[surplusIndex] = -1
        variableNames.push(`e${i + 1}`)

        const artificialIndex = extraVarOffset++
        extraVars[artificialIndex] = 1
        variableNames.push(`a${i + 1}`)

        artificialVarIndices.push(artificialIndex)
        surplusToArtificial[surplusIndex] = artificialIndex
      } else if (effectiveOperator === '=') {
        const artificialIndex = extraVarOffset++
        extraVars[artificialIndex] = 1
        variableNames.push(`a${i + 1}`)

        artificialVarIndices.push(artificialIndex)
      }

      standardConstraints.push({
        coefficients: row,
        extraVars,
        rhs,
        originalOperator: operator,
      })
    }

    const totalVars = extraVarOffset

    return {
      type,
      isMinimization,
      objective,
      numOriginalVars,
      numConstraints,
      totalVars,
      variableNames,
      standardConstraints,
      artificialVarIndices,
      surplusToArtificial,
      hasArtificialVars: artificialVarIndices.length > 0,
    }
  }

  private buildOriginalVarNames(n: number) {
    return Array.from({ length: n }, (_, index) => `x${index + 1}`)
  }
}
