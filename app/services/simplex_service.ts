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
}
