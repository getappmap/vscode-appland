import vscode from 'vscode';
import RpcProcessService from '../services/rpcProcessService';

interface Thread {
  id: string;
  path: string;
  title?: string;
  created_at: string;
}

interface SuccessResponse {
  result: Thread[];
}

interface ErrorResponse {
  error: {
    code: number;
    message: string;
  };
}

export default class OpenNavieHistoryCommand {
  public static readonly command = 'appmap.navie.history';
  private static rpcService: RpcProcessService;

  public static register(context: vscode.ExtensionContext, rpcService: RpcProcessService): void {
    this.rpcService = rpcService;
    context.subscriptions.push(
      vscode.commands.registerCommand(OpenNavieHistoryCommand.command, () =>
        OpenNavieHistoryCommand.execute()
      )
    );
  }

  private static async execute(): Promise<void> {
    try {
      const client = this.rpcService.rpcClient();
      const response = (await client.request('v1.navie.thread.query', {
        limit: 64,
        orderBy: 'created_at',
      })) as SuccessResponse | ErrorResponse;
      if ('error' in response) {
        throw new Error(response.error.message);
      }
      const selection = await vscode.window.showQuickPick(
        response.result.map((m) => ({
          label: m.title ?? 'Untitled',
          details: m.id,
          description: m.created_at,
          path: m.path,
        }))
      );
      if (!selection) return;
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(selection.path));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(`Failed to retrieve history: ${message}`);
    }
  }
}
