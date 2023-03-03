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
  SeqDiagramFeedbackCtaError,
}

export default ErrorCode;
