export class BrandNotFoundError extends Error {
  constructor(id: number) {
    super(`Brand not found: ${id}`)
    this.name = 'BrandNotFoundError'
  }
}

export class BrandInUseError extends Error {
  constructor(id: number) {
    super(`Brand is in use by models and cannot be deleted: ${id}`)
    this.name = 'BrandInUseError'
  }
}

export class MeterModelNotFoundError extends Error {
  constructor(id: number) {
    super(`Meter model not found: ${id}`)
    this.name = 'MeterModelNotFoundError'
  }
}

export class MeterModelInUseError extends Error {
  constructor(id: number) {
    super(`Meter model is in use by devices and cannot be deleted: ${id}`)
    this.name = 'MeterModelInUseError'
  }
}

export class DeviceNotFoundError extends Error {
  constructor(id: number) {
    super(`Device not found: ${id}`)
    this.name = 'DeviceNotFoundError'
  }
}

export class InvalidRegisterMapError extends Error {
  constructor(message: string) {
    super(`Invalid register map: ${message}`)
    this.name = 'InvalidRegisterMapError'
  }
}

export class InvalidConnectionError extends Error {
  constructor(message: string) {
    super(`Invalid connection config: ${message}`)
    this.name = 'InvalidConnectionError'
  }
}

export class TransportMismatchError extends Error {
  constructor(transport: string) {
    super(`Connection config does not match transport: ${transport}`)
    this.name = 'TransportMismatchError'
  }
}
