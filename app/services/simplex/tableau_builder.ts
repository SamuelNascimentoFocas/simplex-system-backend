import { createZeroMatrix } from './matrix_utils.js'
import type { StandardForm } from './standard_form_converter.js'

const BIG_M = 1e7

export type TableauData = {
  tableau: number[][]
  basisVarIndices: number[]
  numConstraints: number
  totalVars: number
  numCols: number
  variableNames: string[]
  artificialVarIndices: number[]
  hasArtificialVars: boolean
  BIG_M: number
}

export default class TableauBuilder {
  build(standardForm: StandardForm): TableauData {
    const {
      isMinimization,
      objective,
      numOriginalVars,
      numConstraints,
      totalVars,
      variableNames,
      standardConstraints,
      artificialVarIndices,
      hasArtificialVars,
    } = standardForm

    const numRows = numConstraints + 1
    const numCols = totalVars + 1

    const tableau = createZeroMatrix(numRows, numCols)
    const basisVarIndices = new Array<number>(numConstraints)

    for (let rowIndex = 0; rowIndex < numConstraints; rowIndex++) {
      const { coefficients, extraVars, rhs } = standardConstraints[rowIndex]

      for (let columnIndex = 0; columnIndex < numOriginalVars; columnIndex++) {
        tableau[rowIndex][columnIndex] = coefficients[columnIndex]
      }

      for (const [columnIndex, coefficient] of Object.entries(extraVars)) {
        tableau[rowIndex][Number(columnIndex)] = coefficient
      }

      tableau[rowIndex][totalVars] = rhs

      const basicVariable = this.findBasicVariable(extraVars)
      basisVarIndices[rowIndex] = basicVariable
    }

    const objectiveRowIndex = numConstraints

    if (isMinimization) {
      for (let columnIndex = 0; columnIndex < numOriginalVars; columnIndex++) {
        tableau[objectiveRowIndex][columnIndex] = objective[columnIndex]
      }
    } else {
      for (let columnIndex = 0; columnIndex < numOriginalVars; columnIndex++) {
        tableau[objectiveRowIndex][columnIndex] = -objective[columnIndex]
      }
    }

    if (hasArtificialVars) {
      for (const artificialIndex of artificialVarIndices) {
        tableau[objectiveRowIndex][artificialIndex] = BIG_M
      }

      this.adjustObjectiveForArtificialVariables(
        tableau,
        basisVarIndices,
        artificialVarIndices,
        objectiveRowIndex,
        totalVars
      )
    }

    return {
      tableau,
      basisVarIndices,
      numConstraints,
      totalVars,
      numCols,
      variableNames,
      artificialVarIndices,
      hasArtificialVars,
      BIG_M,
    }
  }

  private findBasicVariable(extraVars: Record<number, number>) {
    for (const [columnIndex, coefficient] of Object.entries(extraVars)) {
      if (coefficient === 1) {
        return Number(columnIndex)
      }
    }

    throw new Error('Não foi possível determinar a variável básica inicial para uma restrição.')
  }

  private adjustObjectiveForArtificialVariables(
    tableau: number[][],
    basisVarIndices: number[],
    artificialVarIndices: number[],
    objectiveRowIndex: number,
    totalVars: number
  ) {
    for (const [rowIndex, basicVariable] of basisVarIndices.entries()) {
      if (artificialVarIndices.includes(basicVariable)) {
        const factor = tableau[objectiveRowIndex][basicVariable]

        if (factor !== 0) {
          for (let columnIndex = 0; columnIndex <= totalVars; columnIndex++) {
            tableau[objectiveRowIndex][columnIndex] -= factor * tableau[rowIndex][columnIndex]
          }
        }
      }
    }
  }
}
