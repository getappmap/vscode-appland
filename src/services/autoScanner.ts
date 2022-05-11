import extensionSettings from '../extensionSettings';
import ProcessService from './processService';

export default class AutoScanner extends ProcessService {
  async start(): Promise<void> {
    const command = extensionSettings.scanCommand();
    let commandArgs: [string, string[]];
    if (typeof command === 'string') {
      const tokens = command.split(' ');
      commandArgs = [tokens[0], tokens.slice(1)];
    } else {
      commandArgs = command;
    }

    this.runProcess(commandArgs[0], commandArgs[1], {
      cwd: this.dir,
    });
  }
}
