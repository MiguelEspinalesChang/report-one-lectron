export const DomainErrorNames = {
  InvalidCredentialsError: 'InvalidCredentialsError',
  InactiveUserError: 'InactiveUserError',
  WeakPasswordError: 'WeakPasswordError',
  RoleNotFoundError: 'RoleNotFoundError',
  UserNotFoundError: 'UserNotFoundError',
  CannotDeactivateSelfError: 'CannotDeactivateSelfError',
  CannotResetAdminPasswordError: 'CannotResetAdminPasswordError',
  NotAuthenticatedError: 'NotAuthenticatedError',
  PermissionDeniedError: 'PermissionDeniedError',
  BrandInUseError: 'BrandInUseError',
  BrandNotFoundError: 'BrandNotFoundError',
  MeterModelInUseError: 'MeterModelInUseError',
  MeterModelNotFoundError: 'MeterModelNotFoundError',
  InvalidRegisterMapError: 'InvalidRegisterMapError',
  DeviceNotFoundError: 'DeviceNotFoundError',
  TransportMismatchError: 'TransportMismatchError',
  InvalidConnectionError: 'InvalidConnectionError',
} as const

export type DomainErrorName = (typeof DomainErrorNames)[keyof typeof DomainErrorNames]
