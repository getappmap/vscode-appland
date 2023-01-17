export default class Environment {
  static get isSystemTest(): boolean {
    return process.env.APPMAP_SYSTEM_TEST !== undefined;
  }
}
