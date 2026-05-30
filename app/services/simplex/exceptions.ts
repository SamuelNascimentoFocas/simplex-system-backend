export class SimplexException extends Error {
  status: string

  constructor(message: string, status = 'simplex_error') {
    super(message)
    this.name = 'SimplexException'
    this.status = status
  }
}

export class InfeasibleProblemException extends SimplexException {
  constructor(message = 'O problema não possui solução viável.') {
    super(message, 'infeasible')
    this.name = 'InfeasibleProblemException'
  }
}

export class UnboundedProblemException extends SimplexException {
  constructor(message = 'O problema possui solução ilimitada.') {
    super(message, 'unbounded')
    this.name = 'UnboundedProblemException'
  }
}

export class InvalidInputException extends SimplexException {
  constructor(message: string) {
    super(message, 'invalid_input')
    this.name = 'InvalidInputException'
  }
}
