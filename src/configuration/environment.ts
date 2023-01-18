export default class Environment {
  static get appMapTestApiKey(): string | undefined {
    return process.env.APPMAP_TEST_API_KEY;
  }
  static get isIntegrationTest(): boolean {
    return process.env.APPMAP_INTEGRATION_TEST !== undefined;
  }
  static get isSystemTest(): boolean {
    return process.env.APPMAP_SYSTEM_TEST !== undefined;
  }
}
