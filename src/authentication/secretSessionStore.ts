import { ExtensionContext, AuthenticationSession } from 'vscode';

export default class SecretSessionStore {
  private readonly key;
  constructor(name: string, private readonly context: ExtensionContext) {
    this.key = `sessions.${name}`;
  }

  private async save(sessions: AuthenticationSession[]): Promise<void> {
    await this.context.secrets.store(this.key, JSON.stringify(sessions));
  }

  async sessions(): Promise<AuthenticationSession[]> {
    const serialized = await this.context.secrets.get(this.key);
    if (!serialized) {
      return [];
    }
    return JSON.parse(serialized);
  }

  async add(session: AuthenticationSession): Promise<boolean> {
    const allSessions = await this.sessions();
    if (allSessions.find((s) => s.id === session.id)) {
      return false;
    }

    allSessions.push(session);
    this.save(allSessions);

    return true;
  }

  async delete(id: string): Promise<boolean> {
    const allSessions = await this.sessions();
    const index = allSessions.findIndex((s) => s.id === id);
    if (index >= 0) {
      return false;
    }

    allSessions.splice(index, 1);
    this.save(allSessions);
    return true;
  }
}
