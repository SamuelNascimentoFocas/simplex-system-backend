export const EPSILON = 1e-10

export function createZeroMatrix(rows: number, cols: number) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

export function copyMatrix(matrix: number[][]) {
  return matrix.map((row) => [...row])
}

export function isZero(value: number) {
  return Math.abs(value) < EPSILON
}

export function isPositive(value: number) {
  return value > EPSILON
}

export function isNegative(value: number) {
  return value < -EPSILON
}

export function round(value: number, decimals = 10) {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
