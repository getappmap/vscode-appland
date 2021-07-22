import { existsSync, PathLike } from 'fs';
import { promises as fsp } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execFile, exec } from '../util';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
} from './appMapAgent';
import { JSDOM } from 'jsdom';
import xmlSerializer from 'w3c-xmlserializer';

interface BuildFramework {
  isInstalled(): Promise<boolean>;
}

class Maven implements BuildFramework {
  path: string;
  mavenCommand: string;

  constructor(path: string, mavenCommand: string) {
    this.path = path;
    this.mavenCommand = mavenCommand;
  }
  async isInstalled() {
    try {
      const { exitCode } = await execFile(this.mavenCommand, ['prepare-agent'], {
        cwd: this.path,
      });
      return exitCode === 0;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

class Gradle implements BuildFramework {
  path: string;
  gradleCommand: string;

  constructor(path: string, gradleCommand: string) {
    this.path = path;
    this.gradleCommand = gradleCommand;
  }

  async isInstalled() {
    try {
      const { exitCode } = await execFile(this.gradleCommand, ['--help', 'appmap'], {
        cwd: this.path,
      });
      return exitCode === 0;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

abstract class Installer {
  path: string;

  constructor(path: string) {
    this.path = path;
  }

  get available() {
    return existsSync(this.buildFilePath);
  }

  abstract get buildFilePath(): string;

  abstract install(): Promise<InstallResult>;
}

class MavenInstaller extends Installer {
  get buildFilePath() {
    return join(this.path, 'pom.xml');
  }

  async install(): Promise<InstallResult> {
    const buildFileSource = (await fsp.readFile(this.buildFilePath)).toString();
    const jsdom = new JSDOM();
    const domParser = new jsdom.window.DOMParser();
    const doc = domParser.parseFromString(buildFileSource, 'text/xml');
    const ns = doc.getRootNode().childNodes[0].namespaceURI;

    const pluginString = `
      <plugin xmlns="${ns}">
          <groupId>com.appland</groupId>
          <artifactId>appmap-maven-plugin</artifactId>
          <version>1.1.2</>
          <executions>
              <execution>
                  <phase>process-test-classes</phase>
                  <goals>
                      <goal>prepare-agent</goal>
                  </goals>
              </execution>
          </executions>
      </plugin>
    `;

    const projectSection = doc.evaluate(
      '/project',
      doc,
      doc.createNSResolver(),
      9 /* FIRST_ORDERED_NODE_TYPE */
    ).singleNodeValue;
    if (!projectSection) {
      doc.appendChild(doc.createElement('project'));
    }
    const buildSection = doc.evaluate('/project/build', doc, doc.createNSResolver(), 9)
      .singleNodeValue;
    if (!buildSection) {
      projectSection?.appendChild(doc.createElement('build'));
    }
    const pluginsSection = doc.evaluate('/project/build/plugins', doc, doc.createNSResolver(), 9)
      .singleNodeValue;
    if (!pluginsSection) {
      projectSection?.appendChild(doc.createElement('plugins'));
    }
    const appmapPlugin = doc.evaluate(
      `/project/build/plugins/plugin[groupId/text() = 'com.appland' and artifactId/text() = 'appmap-maven-plugin']`,
      doc,
      doc.createNSResolver(),
      9
    ).singleNodeValue;
    if (!appmapPlugin) {
      const pluginNode = domParser.parseFromString(pluginString, 'application/xml').getRootNode();
      while (pluginNode.childNodes.length > 0) {
        const node = pluginNode.childNodes[0];
        pluginsSection?.appendChild(node);
      }
      pluginsSection.appendChild(doc.createTextNode('\n'));

      await fsp.writeFile(this.buildFilePath, xmlSerializer(doc.getRootNode()));

      return 'installed';
    }

    return 'none';
  }
}

class GradleInstaller extends Installer {
  get buildFilePath() {
    return join(this.path, 'build.gradle');
  }

  async install(): Promise<InstallResult> {
    const buildFileSource = (await fsp.readFile(this.buildFilePath)).toString();
    const pluginMatch = buildFileSource.match(/plugins\s*\{\s*([^}]*)\}/);
    let updatedBuildFileSource;
    if (pluginMatch) {
      const pluginMatchIndex = buildFileSource.indexOf(pluginMatch[0]);
      const plugins = pluginMatch[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      const appmapPlugin = plugins.find((line) => line.indexOf('com.appland.appmap') !== -1);
      if (!appmapPlugin) {
        plugins.push(`id 'com.appland.appmap' version '1.0.2'`);
        const pluginSection = `plugins {
${plugins.map((plugin) => `  ${plugin}`).join('\n')}
}`;
        updatedBuildFileSource = [
          buildFileSource.substring(0, pluginMatchIndex),
          pluginSection,
          buildFileSource.substring(
            pluginMatchIndex + pluginMatch[0].length,
            buildFileSource.length
          ),
        ].join('');
      }
    } else {
      const pluginSection = `plugins {
  id 'com.appland.appmap'
}`;
      updatedBuildFileSource = [buildFileSource, pluginSection].join('\n');
    }

    if (updatedBuildFileSource) {
      await fsp.writeFile(this.buildFilePath, updatedBuildFileSource);
      return 'installed';
    }

    return 'none';
  }
}

export default class AppMapAgentJava implements AppMapAgent {
  readonly language = 'java';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isInstalled(path: PathLike): Promise<boolean> {
    const buildCommands: Array<BuildFramework> = [];
    if (process.platform === 'win32') {
      buildCommands.push(new Gradle(path as string, './gradlew.bat'));
      buildCommands.push(new Maven(path as string, './mvnw.cmd'));
    } else {
      buildCommands.push(new Gradle(path as string, './gradlew'));
      buildCommands.push(new Maven(path as string, './mvnw'));
    }
    buildCommands.push(new Maven(path as string, 'mvn'));

    return await Promise.all(
      buildCommands.map((framework) => framework.isInstalled())
    ).then((results) => results.some((r) => r));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async install(path: PathLike): Promise<InstallResult> {
    function maybe(list: Array<InstallResult>, value: InstallResult) {
      return list.some((v) => v === value) ? value : null;
    }

    return Promise.all(
      [new GradleInstaller(path as string), new MavenInstaller(path as string)]
        .filter((installer) => installer.available)
        .map((installer) => installer.install())
    ).then(
      (installResults) =>
        maybe(installResults, 'installed') || maybe(installResults, 'upgraded') || 'none'
    );
  }

  get javaAgentPath(): string {
    return join(homedir(), 'lib/appmap.jar');
  }

  async init(path: PathLike): Promise<InitResponse> {
    const { stdout, stderr, exitCode } = await execFile(
      'java',
      ['-jar', this.javaAgentPath, '-d', '.', 'init'],
      {
        cwd: path as string,
      }
    );

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async files(path: PathLike): Promise<FilesResponse> {
    return JSON.parse('{}');
  }

  async status(path: PathLike): Promise<StatusResponse> {
    const { stdout, stderr, exitCode } = await execFile(
      'java',
      ['-jar', this.javaAgentPath, '-d', '.', 'status'],
      {
        cwd: path as string,
      }
    );

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  }

  async test(path: PathLike, command: Array<string>): Promise<void> {
    return await command.forEach(async (row) => {
      await exec(row, {
        cwd: path as string,
        output: true,
        userCanTerminate: true,
        progressMessage: 'Recording tests...',
      });
    });
  }
}
