import { EPSILON, isNegative, isPositive, isZero } from './matrix_utils.js'
import { UnboundedProblemException } from './exceptions.js'

export default class PivotOperations {
  isOptimal(tableau: number[][], objectiveRowIndex: number, totalVars: number) {
    for (let columnIndex = 0; columnIndex < totalVars; columnIndex++) {
      if (isNegative(tableau[objectiveRowIndex][columnIndex])) {
        return false
      }
    }

    return true
  }

  selectPivotColumn(tableau: number[][], objectiveRowIndex: number, totalVars: number) {
    let mostNegative = -EPSILON
    let pivotColumn = -1

    for (let columnIndex = 0; columnIndex < totalVars; columnIndex++) {
      if (tableau[objectiveRowIndex][columnIndex] < mostNegative) {
        mostNegative = tableau[objectiveRowIndex][columnIndex]
        pivotColumn = columnIndex
      }
    }

    return pivotColumn
  }

  selectPivotRow(
    tableau: number[][],
    pivotColumn: number,
    numConstraints: number,
    rhsColumn: number
  ) {
    let minRatio = Infinity
    let pivotRow = -1

    for (let rowIndex = 0; rowIndex < numConstraints; rowIndex++) {
      const element = tableau[rowIndex][pivotColumn]

      if (isPositive(element)) {
        const ratio = tableau[rowIndex][rhsColumn] / element

        if (ratio < minRatio - EPSILON) {
          minRatio = ratio
          pivotRow = rowIndex
        }
      }
    }

    if (pivotRow === -1) {
      throw new UnboundedProblemException()
    }

    return pivotRow
  }

  pivot(tableau: number[][], pivotRow: number, pivotColumn: number, numCols: number) {
    const pivotElement = tableau[pivotRow][pivotColumn]

    for (let columnIndex = 0; columnIndex < numCols; columnIndex++) {
      tableau[pivotRow][columnIndex] /= pivotElement
    }

    for (let rowIndex = 0; rowIndex < tableau.length; rowIndex++) {
      if (rowIndex !== pivotRow) {
        const factor = tableau[rowIndex][pivotColumn]

        if (!isZero(factor)) {
          for (let columnIndex = 0; columnIndex < numCols; columnIndex++) {
            tableau[rowIndex][columnIndex] -= factor * tableau[pivotRow][columnIndex]
          }
        }
      }
    }
  }
}
