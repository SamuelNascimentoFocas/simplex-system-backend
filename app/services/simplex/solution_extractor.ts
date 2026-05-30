import { isZero, round } from './matrix_utils.js'
import { InfeasibleProblemException } from './exceptions.js'

type SolutionContext = {
  basisVarIndices: number[]
  numConstraints: number
  totalVars: number
  variableNames: string[]
  numOriginalVars: number
  isMinimization: boolean
  artificialVarIndices: number[]
  hasArtificialVars: boolean
}

export default class SolutionExtractor {
  extract(tableau: number[][], context: SolutionContext) {
    const {
      basisVarIndices,
      numConstraints,
      totalVars,
      variableNames,
      numOriginalVars,
      isMinimization,
      artificialVarIndices,
      hasArtificialVars,
    } = context

    const objectiveRowIndex = numConstraints
    const rhsColumn = totalVars

    if (hasArtificialVars) {
      for (let rowIndex = 0; rowIndex < numConstraints; rowIndex++) {
        const basicVariable = basisVarIndices[rowIndex]

        if (artificialVarIndices.includes(basicVariable)) {
          const value = tableau[rowIndex][rhsColumn]

          if (!isZero(value)) {
            throw new InfeasibleProblemException(
              `Variável artificial "${variableNames[basicVariable]}" permanece na base com valor ${value}. Problema inviável.`
            )
          }
        }
      }
    }

    const allValues = new Array(totalVars).fill(0)

    for (let rowIndex = 0; rowIndex < numConstraints; rowIndex++) {
      const basicVariable = basisVarIndices[rowIndex]
      allValues[basicVariable] = round(tableau[rowIndex][rhsColumn])
    }

    const variables: Record<string, number> = {}

    for (let columnIndex = 0; columnIndex < numOriginalVars; columnIndex++) {
      variables[variableNames[columnIndex]] = allValues[columnIndex]
    }

    let objectiveValue = round(tableau[objectiveRowIndex][rhsColumn], 6)

    if (isMinimization) {
      objectiveValue = -objectiveValue
    }

    const nonBasicZeroCoefficientVariables: string[] = []
    const basisSet = new Set(basisVarIndices)

    for (let columnIndex = 0; columnIndex < numOriginalVars; columnIndex++) {
      if (!basisSet.has(columnIndex) && isZero(tableau[objectiveRowIndex][columnIndex])) {
        nonBasicZeroCoefficientVariables.push(variableNames[columnIndex])
      }
    }

    const hasMultipleSolutions = nonBasicZeroCoefficientVariables.length > 0

    return {
      status: 'optimal',
      objectiveValue,
      variables,
      hasMultipleSolutions,
      multipleSolutionsHint: hasMultipleSolutions
        ? `Múltiplas soluções ótimas detectadas. Variáveis com coeficiente zero na linha Z: ${nonBasicZeroCoefficientVariables.join(', ')}.`
        : null,
      basisVarIndices: [...basisVarIndices],
      basisVarNames: basisVarIndices.map((index) => variableNames[index]),
    }
  }
}
