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
  ConfigUpdateError,
  AssetAcquisitionFailure,
  UpdateSignInStateFailure,
  // A process failed often enough that the watcher gave up restarting it. Distinct from
  // ProcessFailure, which is one failure the watcher expects to recover from.
  ProcessAbort,
}

export default ErrorCode;
