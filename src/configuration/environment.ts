export default class Environment {
  static get isSmokeTest(): boolean {
    return process.env.APPMAP_TEST !== undefined;
  }
}
