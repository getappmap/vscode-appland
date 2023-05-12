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
  GenerateMapStatsError,
  PruneLargeMapError,
  ArchiveAppMapsFailure,
  RestoreAppMapsFailure,
  CompareAppMapsFailure,
  CompareReportAppMapsFailure,
}

export default ErrorCode;
