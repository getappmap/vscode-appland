import assert from 'node:assert';
import { log, warn } from 'node:console';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { debuglog } from 'node:util';
import { isNativeError } from 'node:util/types';

import vscode, {
  CancellationTokenSource,
  Disposable,
  ExtensionContext,
  LanguageModelChat,
  LanguageModelChatMessage,
  LanguageModelChatResponse,
  lm,
} from 'vscode';

import ExtensionSettings from '../configuration/extensionSettings';

const debug = debuglog('appmap-vscode:chat-completion');

interface Message {
  content: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
}

let instance: Promise<ChatCompletion> | undefined;

export default class ChatCompletion implements Disposable {
  public readonly server: Server;

  constructor(private portNumber = 0, public readonly key = randomKey()) {
    this.server = createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res);
        if (debug.enabled || res.statusCode !== 200)
          log(`Chat completion request: ${req.method} ${req.url} ${res.statusCode}`);
      } catch (e) {
        warn(`Error handling request: ${e}`);
        if (isNativeError(e)) {
          warn(e.stack);
        }
        res.writeHead(500);
        res.end(isNativeError(e) && e.message);
      }
    });
    this.server.listen(portNumber);
    const listening = new Promise<ChatCompletion>((resolve, reject) =>
      this.server
        .on('listening', () => {
          const address = this.server.address();
          assert(address && typeof address !== 'string');
          log(`Chat completion server listening on ${address.port}`);
          this.portNumber ||= address.port;
          resolve(this);
        })
        .on('error', reject)
    );
    this.server.on('error', (e) => warn(`Chat completion server error: ${e}`));
    instance ??= listening;
  }

  get ready(): Promise<void> {
    return this.server.listening
      ? Promise.resolve()
      : new Promise((resolve) => this.server.on('listening', resolve));
  }

  get port(): number {
    return this.portNumber;
  }

  get url(): string {
    return `http://localhost:${this.port}/vscode/copilot`;
  }

  static get instance(): Promise<ChatCompletion | undefined> {
    if (!instance) return Promise.resolve(undefined);
    return instance;
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      warn(`Invalid method: ${req.method}`);
      return;
    }

    const bearer = req.headers.authorization?.split(' ')[1];
    if (!bearer || !timingSafeEqual(Buffer.from(bearer), Buffer.from(this.key))) {
      res.writeHead(401);
      res.end();
      warn('Invalid authorization');
      return;
    }

    const chunks: Buffer[] = [];

    for await (const chunk of req) chunks.push(chunk);

    const body = Buffer.concat(chunks).toString('utf-8');
    let request: unknown;
    try {
      request = JSON.parse(body);
      assert(
        request &&
          typeof request === 'object' &&
          'messages' in request &&
          Array.isArray(request.messages)
      );
      assert(
        request.messages.every(
          (m: unknown) => m && typeof m === 'object' && 'content' in m && 'role' in m
        )
      );
      assert('model' in request && typeof request.model === 'string');
    } catch (e) {
      res.writeHead(400);
      res.end(isNativeError(e) && e.message);
      warn(`Invalid request: ${e}`);
      return;
    }

    const model =
      (await lm.selectChatModels({ family: request.model }))[0] ??
      (await lm.selectChatModels({ version: request.model }))[0];
    if (!model) {
      res.writeHead(404);
      const availableModels = await lm.selectChatModels();
      const message = `Model ${request.model} not found. Available models: ${JSON.stringify(
        availableModels
      )}`;
      warn(message);
      res.end(message);
      return;
    }

    debug(`Processing request: ${JSON.stringify(request)}`);

    let result: LanguageModelChatResponse;
    try {
      const cancellation = new CancellationTokenSource();
      req.on('close', () => cancellation.cancel());
      res.on('close', () => cancellation.cancel());
      result = await model.sendRequest(toVSCodeMessages(request.messages), {}, cancellation.token);
    } catch (e) {
      res.writeHead(422);
      res.end(isNativeError(e) && e.message);
      warn(`Error processing request: ${e}`);
      return;
    }

    if ('stream' in request && request.stream) streamChatCompletion(res, model, result);
    else sendChatCompletionResponse(res, model, result);
  }

  async dispose(): Promise<void> {
    if ((await instance) === this) instance = undefined;
    this.server.close();
  }

  private static settingsChanged = new vscode.EventEmitter<void>();
  static onSettingsChanged = ChatCompletion.settingsChanged.event;

  static initialize(context: ExtensionContext) {
    // TODO: make the messages and handling generic for all LM extensions

    const hasLM = 'lm' in vscode && 'selectChatModels' in vscode.lm;

    if (ExtensionSettings.useVsCodeLM && checkAvailability())
      context.subscriptions.push(new ChatCompletion());

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('appMap.navie.useVSCodeLM')) {
          const instance = await ChatCompletion.instance;
          if (!ExtensionSettings.useVsCodeLM && instance) await instance.dispose();
          else if (ExtensionSettings.useVsCodeLM && checkAvailability())
            context.subscriptions.push(new ChatCompletion());
          this.settingsChanged.fire();
        }
      })
    );

    function checkAvailability() {
      if (!hasLM)
        vscode.window.showErrorMessage(
          'AppMap: VS Code LM backend for Navie is enabled, but the LanguageModel API is not available.\nPlease update your VS Code to the latest version.'
        );
      else if (!vscode.extensions.getExtension('github.copilot')) {
        vscode.window
          .showErrorMessage(
            'AppMap: VS Code LM backend for Navie is enabled, but the GitHub Copilot extension is not installed.\nPlease install it from the marketplace and reload the window.',
            'Install Copilot'
          )
          .then((selection) => {
            if (selection === 'Install Copilot') {
              vscode.lm.onDidChangeChatModels(
                () => {
                  context.subscriptions.push(new ChatCompletion());
                  ChatCompletion.settingsChanged.fire();
                },
                undefined,
                context.subscriptions
              );
              vscode.commands.executeCommand(
                'workbench.extensions.installExtension',
                'github.copilot'
              );
            }
          });
      } else return true;
    }
  }
}

async function sendChatCompletionResponse(
  res: ServerResponse<IncomingMessage>,
  model: LanguageModelChat,
  result: LanguageModelChatResponse
) {
  try {
    let content = '';
    for await (const c of result.text) content += c;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(makeChatCompletion(model, content)));
  } catch (e) {
    warn(`Error streaming response: ${e}`);
    if (isNativeError(e)) warn(e.stack);
    res.writeHead(422);
    res.end(isNativeError(e) && e.message);
  }
}

async function streamChatCompletion(
  res: ServerResponse,
  model: LanguageModelChat,
  result: LanguageModelChatResponse
) {
  try {
    const chunk = prepareChatCompletionChunk(model);
    for await (const content of result.text) {
      if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      else res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      chunk.choices[0].delta = { content };
      debug(`Sending chunk: ${content}`);
    }
    chunk.choices[0].finish_reason = 'stop';
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    warn(`Error streaming response: ${e}`);
    if (isNativeError(e)) warn(e.stack);
    if (!res.headersSent) {
      res.writeHead(422);
      res.end(isNativeError(e) && e.message);
    } else res.end(`data: ${JSON.stringify({ error: e })}`);
  }
}

interface OpenAIChatCompletion {
  id: string;
  choices: {
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call';
    index: number;
    // logprobs: Choice.Logprobs | null;
    message: {
      content?: string | null;
      refusal?: string | null;
      role: 'assistant';
      /*
    function_call?: ChatCompletionMessage.FunctionCall | null;
    tool_calls?: Array<ChatCompletionMessageToolCall>;
  */
    };
  }[];
  created: number;
  model: string;
  object: 'chat.completion';
  service_tier?: 'scale' | 'default' | null;
  system_fingerprint?: string;
  // usage?: CompletionsAPI.CompletionUsage;
}

interface OpenAIChatCompletionChunk {
  id: string;
  choices: {
    delta: {
      content?: string | null;
      // function_call?: Delta.FunctionCall;
      refusal?: string | null;
      role?: 'system' | 'user' | 'assistant' | 'tool';
      // tool_calls?: Array<Delta.ToolCall>;
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' | null;
    index: number;
    // logprobs?: Choice.Logprobs | null;
  }[];
  created: number;
  model: string;
  object: 'chat.completion.chunk';
  service_tier?: 'scale' | 'default' | null;
  system_fingerprint?: string;
  // usage?: CompletionsAPI.CompletionUsage;
}

function makeChatCompletion(model: LanguageModelChat, content: string): OpenAIChatCompletion {
  return {
    id: randomKey(),
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    created: new Date().getTime() / 1000,
    model: model.version,
    system_fingerprint: model.id,
    object: 'chat.completion',
  };
}

function prepareChatCompletionChunk(model: LanguageModelChat): OpenAIChatCompletionChunk {
  return {
    id: randomKey(),
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          content: '',
        },
      },
    ],
    created: new Date().getTime() / 1000,
    model: model.version,
    system_fingerprint: model.id,
    object: 'chat.completion.chunk',
  };
}

let seenSystem = false; // so we don't spam the console with warnings
function toVSCodeMessages(messages: Message[]): LanguageModelChatMessage[] {
  const result: LanguageModelChatMessage[] = [];
  for (const { role, content } of messages)
    switch (role) {
      case 'system':
        if (!seenSystem) warn("System messages are not supported directly, using 'user' instead.");
        seenSystem = true;
      // fallthrough
      case 'user':
        result.push(LanguageModelChatMessage.User(content));
        break;
      case 'assistant':
        result.push(LanguageModelChatMessage.Assistant(content));
        break;
      default:
        warn(`Unknown role: ${role}`);
    }

  return result;
}

function randomKey(): string {
  return randomBytes(16).toString('hex');
}
