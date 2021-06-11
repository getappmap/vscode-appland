export default interface LanguageConfiguration {
  getAppMapAgentVersionLocal(): Promise<string>;
  getAppMapAgentVersionGlobal(): Promise<string>;
}
