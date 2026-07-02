export type ConstraintOperator = '<=' | '>=' | '='

export type ConstraintInput = {
  coefficients: number[]
  operator: ConstraintOperator
  rhs: number
}

export type SimplexInput = {
  objective: number[]
  constraints: ConstraintInput[]
  type: 'max' | 'min'
}

export type SimplexResult = ReturnType<SimplexService['solve']>

type StandardForm = {
  tableau: number[][]
  numOriginalVars: number
  numConstraints: number
  totalVars: number           // variáveis originais + extras (folgas, excessos, artificiais)
  basisVarIndices: number[]   // índice da variável básica de cada linha de restrição
  artificialVarIndices: number[]
  hasArtificialVars: boolean
}

const BIG_M = 1e7

export default class SimplexService {
  createInitialTableau(input: SimplexInput): number[][] {
    const standardForm = this.convertToStandardForm(input)
    return standardForm.tableau
  }

  createInitialTableauWithMeta(input: SimplexInput): StandardForm {
    return this.convertToStandardForm(input)
  }

  findPivotColumn(tableau: number[][]): number {
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

  findPivotRow(tableau: number[][], pivotColumn: number): number {
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

  pivot(tableau: number[][], pivotRow: number, pivotColumn: number): number[][] {
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

  extractSolution(finalTableau: number[][], numberOfVariables: number, type: 'max' | 'min') {
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

    let optimalValue = finalTableau[objectiveRowIndex][lastColumnIndex]

    if (type === 'min') {
      optimalValue = -optimalValue
    }

    return {
      solution,
      optimalValue,
    }
  }

  hasMultipleOptimalSolutions(finalTableau: number[][], numberOfVariables: number): boolean {
    const objectiveRowIndex = finalTableau.length - 1
    const objectiveRow = finalTableau[objectiveRowIndex]

    for (let columnIndex = 0; columnIndex < numberOfVariables; columnIndex++) {
      const column = finalTableau.map((row) => row[columnIndex])

      const onesCount = column.filter((value, rowIndex) => {
        return rowIndex !== objectiveRowIndex && value === 1
      }).length

      const zerosCount = column.filter((value, rowIndex) => {
        return rowIndex !== objectiveRowIndex && value === 0
      }).length

      const isBasicColumn = onesCount === 1 && zerosCount === finalTableau.length - 2
      const isNonBasicColumn = !isBasicColumn
      const hasZeroReducedCost = objectiveRow[columnIndex] === 0

      if (isNonBasicColumn && hasZeroReducedCost) {
        return true
      }
    }

    return false
  }

  isInfeasible(finalTableau: number[][], artificialVarIndices: number[]): boolean {
    if (artificialVarIndices.length === 0) return false

    const lastColumnIndex = finalTableau[0].length - 1
    const objectiveRowIndex = finalTableau.length - 1
    const epsilon = 1e-8

    for (const artIndex of artificialVarIndices) {
      const column = finalTableau.map((row) => row[artIndex])

      // Verifica se a variável artificial está na base (coluna identidade)
      const oneIndex = column.findIndex((value, rowIndex) => {
        return rowIndex !== objectiveRowIndex && Math.abs(value - 1) < epsilon
      })

      const isBasic =
        oneIndex !== -1 &&
        column.every((value, rowIndex) => {
          if (rowIndex === oneIndex) return Math.abs(value - 1) < epsilon
          return Math.abs(value) < epsilon
        })

      if (isBasic) {
        const rhsValue = finalTableau[oneIndex][lastColumnIndex]
        // Artificial na base com valor positivo → inviável
        if (rhsValue > epsilon) return true
      }
    }

    return false
  }

  private convertToStandardForm(input: SimplexInput): StandardForm {
    const { objective, constraints, type } = input
    const numOriginalVars = objective.length
    const numConstraints = constraints.length

    let extraVarCount = 0
    for (const constraint of constraints) {
      const op = constraint.operator
      if (op === '<=') extraVarCount += 1           // folga
      else if (op === '>=') extraVarCount += 2      // excesso + artificial
      else if (op === '=') extraVarCount += 1       // artificial
    }

    const totalVars = numOriginalVars + extraVarCount
    const totalCols = totalVars + 1
    const numRows = numConstraints + 1
    const objRowIndex = numConstraints

    const tableau: number[][] = Array.from({ length: numRows }, () =>
      new Array(totalCols).fill(0)
    )

    const basisVarIndices: number[] = new Array(numConstraints)
    const artificialVarIndices: number[] = []

    let extraVarOffset = numOriginalVars

    for (let i = 0; i < numConstraints; i++) {
      let { coefficients, operator, rhs } = constraints[i]

      if (rhs < 0) {
        coefficients = coefficients.map((v) => -v)
        rhs = -rhs
        if (operator === '<=') operator = '>='
        else if (operator === '>=') operator = '<='
      }

      for (let j = 0; j < numOriginalVars; j++) {
        tableau[i][j] = coefficients[j]
      }

      tableau[i][totalVars] = rhs

      if (operator === '<=') {
        const slackIndex = extraVarOffset++
        tableau[i][slackIndex] = 1
        basisVarIndices[i] = slackIndex
      } else if (operator === '>=') {
        const surplusIndex = extraVarOffset++
        tableau[i][surplusIndex] = -1
        const artificialIndex = extraVarOffset++
        tableau[i][artificialIndex] = 1
        artificialVarIndices.push(artificialIndex)
        basisVarIndices[i] = artificialIndex
      } else if (operator === '=') {
        const artificialIndex = extraVarOffset++
        tableau[i][artificialIndex] = 1
        artificialVarIndices.push(artificialIndex)
        basisVarIndices[i] = artificialIndex
      }
    }

    const hasArtificialVars = artificialVarIndices.length > 0

    for (let j = 0; j < numOriginalVars; j++) {
      tableau[objRowIndex][j] = type === 'max' ? -objective[j] : objective[j]
    }

    if (hasArtificialVars) {
      for (const artIndex of artificialVarIndices) {
        tableau[objRowIndex][artIndex] = BIG_M
      }
      this.adjustObjectiveForArtificials(
        tableau,
        basisVarIndices,
        artificialVarIndices,
        objRowIndex,
        totalVars
      )
    }

    return {
      tableau,
      numOriginalVars,
      numConstraints,
      totalVars,
      basisVarIndices,
      artificialVarIndices,
      hasArtificialVars,
    }
  }

  /**
   * Ajusta a linha objetivo para manter a forma canônica quando variáveis
   * artificiais estão na base inicial.
   */
  private adjustObjectiveForArtificials(
    tableau: number[][],
    basisVarIndices: number[],
    artificialVarIndices: number[],
    objRowIndex: number,
    totalVars: number
  ): void {
    for (let i = 0; i < basisVarIndices.length; i++) {
      const basicVar = basisVarIndices[i]

      if (!artificialVarIndices.includes(basicVar)) continue

      const factor = tableau[objRowIndex][basicVar]
      if (factor === 0) continue

      for (let j = 0; j <= totalVars; j++) {
        tableau[objRowIndex][j] -= factor * tableau[i][j]
      }
    }
  }
}
