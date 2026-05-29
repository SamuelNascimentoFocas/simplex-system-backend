type SimplexInput = {
  objective: number[]
  constraints: number[][]
  rhs: number[]
  type: 'max' | 'min'
}

export default class SimplexService {
  createInitialTableau({ objective, constraints, rhs, type }: SimplexInput) {
    const numberOfConstraints = constraints.length

    const tableau = constraints.map((row, index) => {
      const slackVariables = Array(numberOfConstraints).fill(0)
      slackVariables[index] = 1

      return [...row, ...slackVariables, rhs[index]]
    })

    const objectiveRow =
      type === 'max' ? objective.map((value) => -value) : objective.map((value) => value)

    const zRow = [...objectiveRow, ...Array(numberOfConstraints).fill(0), 0]

    tableau.push(zRow)

    return tableau
  }

  findPivotColumn(tableau: number[][]) {
    const objectiveRow = tableau[tableau.length - 1]
    const lastColumnIndex = objectiveRow.length - 1

    let pivotColumnIndex = -1
    let mostNegativeValue = 0

    for (let columnIndex = 0; columnIndex < lastColumnIndex; columnIndex++) {
      const value = objectiveRow[columnIndex]

      if (value < mostNegativeValue) {
        mostNegativeValue = value
        pivotColumnIndex = columnIndex
      }
    }

    return pivotColumnIndex
  }

  findPivotRow(tableau: number[][], pivotColumn: number) {
    const lastRowIndex = tableau.length - 1
    let pivotRowIndex = -1
    let smallestRatio = Infinity

    for (let rowIndex = 0; rowIndex < lastRowIndex; rowIndex++) {
      const row = tableau[rowIndex]
      const pivotColumnValue = row[pivotColumn]
      const rhs = row[row.length - 1]

      if (pivotColumnValue > 0) {
        const ratio = rhs / pivotColumnValue

        if (ratio < smallestRatio) {
          smallestRatio = ratio
          pivotRowIndex = rowIndex
        }
      }
    }

    return pivotRowIndex
  }

  pivot(tableau: number[][], pivotRow: number, pivotColumn: number) {
    const newTableau = tableau.map((row) => [...row])
    const pivotElement = newTableau[pivotRow][pivotColumn]

    newTableau[pivotRow] = newTableau[pivotRow].map((value) => value / pivotElement)

    for (let rowIndex = 0; rowIndex < newTableau.length; rowIndex++) {
      if (rowIndex !== pivotRow) {
        const factor = newTableau[rowIndex][pivotColumn]

        newTableau[rowIndex] = newTableau[rowIndex].map((value, columnIndex) => {
          return value - factor * newTableau[pivotRow][columnIndex]
        })
      }
    }

    return newTableau
  }

  solve(tableau: number[][]) {
    const iterations = [tableau]
    let currentTableau = tableau

    while (true) {
      const pivotColumn = this.findPivotColumn(currentTableau)

      if (pivotColumn === -1) {
        break
      }

      const pivotRow = this.findPivotRow(currentTableau, pivotColumn)

      if (pivotRow === -1) {
        throw new Error('Problema ilimitado: não foi possível encontrar linha pivô')
      }

      currentTableau = this.pivot(currentTableau, pivotRow, pivotColumn)
      iterations.push(currentTableau)
    }

    return {
      finalTableau: currentTableau,
      iterations,
    }
  }

  extractSolution(finalTableau: number[][], numberOfVariables: number) {
    const solution = Array(numberOfVariables).fill(0)
    const lastColumnIndex = finalTableau[0].length - 1
    const objectiveRowIndex = finalTableau.length - 1

    for (let columnIndex = 0; columnIndex < numberOfVariables; columnIndex++) {
      const column = finalTableau.map((row) => row[columnIndex])

      const oneIndex = column.findIndex((value, rowIndex) => {
        return rowIndex !== objectiveRowIndex && value === 1
      })

      const isBasicColumn =
        oneIndex !== -1 &&
        column.every((value, rowIndex) => {
          if (rowIndex === oneIndex) return value === 1
          if (rowIndex === objectiveRowIndex) return value === 0
          return value === 0
        })
      if (isBasicColumn) {
        solution[columnIndex] = finalTableau[oneIndex][lastColumnIndex]
      }
    }

    const optimalValue = finalTableau[objectiveRowIndex][lastColumnIndex]

    return {
      solution,
      optimalValue,
    }
  }
}
