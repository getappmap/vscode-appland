export interface Installer {
  // Whether or not this installer can install the agent for the given language.
  canInstall(language: string, projectPath: string): Promise<boolean> | boolean;

  // The main logic to perform the installation.
  execute(
    cliCommand: string,
    projectPath: string,
    env?: { [key: string]: string | null | undefined }
  ): Promise<void> | void;
}
