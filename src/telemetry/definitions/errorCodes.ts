enum ErrorCode {
  Unknown,
  DependencyInstallFailure,
  DependencyPathNotResolved,
  DependencyLockFailure,
  ProcessFailure,
  AuthenticationFailure,
  InitializationFailure,
  GenerateOpenApiFailure,
  SidebarSignInFailure,
  ExportSvgError,
}

export default ErrorCode;
