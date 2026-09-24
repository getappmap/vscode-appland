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
  // Running under one of the test harnesses that drives a real VS Code instance.
  static get isTest(): boolean {
    return this.isIntegrationTest || this.isSystemTest;
  }
  static get isDevelopmentExtension(): boolean {
    return process.env.APPMAP_DEV_EXTENSION !== undefined;
  }
}
