enum ErrorCode {
  Unknown,
  DependencyInstallFailure,
  DependencyPathNotResolved,
  DependencyLockFailure,
  ProcessFailure,
  AuthenticationFailure,
  InitializationFailure,
  GenerateOpenApiFailure,
  CommandFailure,
  RestoreFailure,
  SequenceDiagramFailure,
  SidebarSignInFailure,
  ExportSvgError,
  SeqDiagramFeedbackCtaError,
  GenerateMapStatsError,
  PruneLargeMapError,
  ConfigUpdateError,
  AssetAcquisitionFailure,
}

export default ErrorCode;
