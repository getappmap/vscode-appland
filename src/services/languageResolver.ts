import { PathLike, promises as fs, Dirent } from 'fs';
import { extname, join } from 'path';
import AppMapAgent from '../agent/appMapAgent';
import GitProperties from '../telemetry/properties/versionControlGit';
import AppMapAgentRuby from '../agent/appMapAgentRuby';
import AppMapAgentDummy from '../agent/AppMapAgentDummy';
import extensionSettings from '../configuration/extensionSettings';
import backgroundJob from '../lib/backgroundJob';

const LANGUAGES = [
  {
    id: 'clojure',
    name: 'Clojure',
    extensions: ['.clj', '.cljc', '.cljs', '.cljx', '.clojure', '.edn'],
  },
  {
    id: 'coffeescript',
    name: 'CoffeeScript',
    extensions: ['.coffee', '.cson', '.iced'],
  },
  {
    id: 'c',
    name: 'C',
    extensions: ['.c'],
  },
  {
    id: 'c++',
    name: 'C++',
    extensions: ['.c++', '.cc', '.cpp', '.cxx', '.h', '.h++', '.hh', '.hpp', '.hxx'],
  },

  {
    id: 'csharp',
    name: 'C#',
    extensions: ['.cake', '.cs', '.csx'],
  },
  {
    id: 'd',
    name: 'D',
    extensions: ['.d', '.di'],
  },
  {
    id: 'dart',
    name: 'Dart',
    extensions: ['.dart'],
  },
  {
    id: 'erlang',
    name: 'Erlang',
    extensions: ['.erl', '.hrl', '.xrl', '.yrl', '.'],
  },
  {
    id: 'fsharp',
    name: 'F#',
    extensions: ['.fs', '.fsi', '.fsscript', '.fsx'],
  },
  {
    id: 'go',
    name: 'Go',
    extensions: ['.go'],
  },
  {
    id: 'groovy',
    name: 'Groovy',
    extensions: ['.gradle', '.groovy', '.gvy'],
  },
  {
    id: 'haskell',
    name: 'Haskell',
    extensions: ['.hs'],
  },
  {
    id: 'haxe',
    name: 'Haxe',
    extensions: ['.hx'],
  },
  {
    id: 'java',
    name: 'Java',
    extensions: ['.jav', '.java'],
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    extensions: ['.cjs', '.es6', '.js', '.jsx', '.mjs', '.ts'],
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    extensions: ['.kt', '.kts'],
  },
  {
    id: 'lisp',
    name: 'Lisp',
    extensions: ['..asd', '..cl', '..el', '..fnl', '..lisp', '..lsp', '..ros'],
  },
  {
    id: 'lua',
    name: 'Lua',
    extensions: ['.lua'],
  },
  {
    id: 'objective-c',
    name: 'Objective-C',
    extensions: ['.m'],
  },
  {
    id: 'objective-cpp',
    name: 'Objective-C++',
    extensions: ['.mm'],
  },
  {
    id: 'ocaml',
    name: 'OCaml',
    extensions: ['.ml', '.mli'],
  },
  {
    id: 'perl',
    name: 'Perl',
    extensions: ['.pl', '.pm', '.pod', '.psgi', '.t'],
  },
  {
    id: 'php',
    name: 'PHP',
    extensions: ['.ctp', '.php', '.php4', '.php5', '.phtml'],
  },
  {
    id: 'python',
    name: 'Python',
    extensions: ['.cpy', '.gyp', '.gpyi', '.ipy', '.py', '.pyi', '.pyw', '.rpy'],
  },
  {
    id: 'reason',
    name: 'Reason',
    extensions: ['.re', '.rei'],
  },
  {
    id: 'rust',
    name: 'Rust',
    extensions: ['.rs'],
  },
  {
    id: 'ruby',
    name: 'Ruby',
    extensions: ['.erb', '.gemspec', '.podspec', '.rake', '.rb', '.rbi', '.rbx', '.rjs', '.ru'],
  },
  {
    id: 'scala',
    name: 'Scala',
    extensions: ['.sbt', '.sc', '.scala'],
  },
  {
    id: 'swift',
    name: 'Swift',
    extensions: ['.swift'],
  },
  {
    id: 'visualbasic',
    name: 'Visual Basic',
    extensions: ['.bas', '.brs', '.vb', '.vbs'],
  },
];

export const UNKNOWN_LANGUAGE = 'unknown';

/**
 * Reverse mapping of file extensions to language id
 */
const LANGUAGE_EXTENSIONS = LANGUAGES.reduce((memo, lang) => {
  const extensions = lang.extensions || [];

  extensions.forEach((ext) => {
    memo[ext] = lang.id;
  });

  return memo;
}, {});

/**
 * Register new AppMap agent CLI interfaces here.
 */
export const LANGUAGE_AGENTS = [
  new AppMapAgentRuby(),
  new AppMapAgentDummy('java', 'Java (Spring)'),
  new AppMapAgentDummy('javascript', 'JavaScript (Node & Express)'),
  new AppMapAgentDummy('python', 'Python (Django or Flask)', extensionSettings.pythonEnabled()),
  new AppMapAgentDummy('unknown'),
].reduce((memo, agent) => {
  memo[agent.language] = agent;
  return memo;
}, {});

/**
 * Provides language identification APIs.
 */
export default class LanguageResolver {
  private static readonly LANGUAGE_DISTRIBUTION_CACHE = {};
  private static readonly LANGUAGE_CACHE = {};

  public static async getLanguageDistribution(
    rootDirectory: PathLike
  ): Promise<Record<string, number>> {
    const cachedValue = this.LANGUAGE_DISTRIBUTION_CACHE[rootDirectory as string];
    if (cachedValue) {
      return cachedValue;
    }

    const directories = [rootDirectory];
    const extensions: Record<string, number> = {};
    const gitProperties = new GitProperties();
    await gitProperties.initialize();

    for (;;) {
      const currentDirectory = directories.pop() as string;
      if (!currentDirectory) {
        break;
      }

      let files: Dirent[] = [];
      try {
        files = await fs.readdir(currentDirectory, { withFileTypes: true });
      } catch {
        continue;
      }

      files.forEach((f) => {
        const absPath = join(currentDirectory, f.name);

        if (f.isDirectory()) {
          if (f.name !== '.git' && !gitProperties.isIgnored(absPath)) {
            directories.push(absPath);
          }
          return;
        }

        const fileExtension = extname(f.name);
        if (fileExtension !== '' && LANGUAGE_EXTENSIONS[fileExtension]) {
          extensions[fileExtension] = (extensions[fileExtension] || 0) + 1;
        }
      });
    }

    const languages = Object.entries(extensions).reduce((memo, [ext, count]) => {
      const language = LANGUAGE_EXTENSIONS[ext];
      memo[language] = memo[language] + count || count;
      return memo;
    }, {} as Record<string, number>);

    const totalFiles = Object.values(languages).reduce((a, b) => a + b, 0);
    if (totalFiles > 0) {
      Object.keys(languages).forEach((key) => {
        languages[key] /= totalFiles;
      });
    }

    this.LANGUAGE_DISTRIBUTION_CACHE[rootDirectory as string] = languages;

    return languages;
  }

  /**
   * Retrieve the most frequently used language id for a given directory. The language returned must be supported (i.e.,
   * it must be registered in LANGUAGE_AGENTS). If the language is not supported, returns 'unknown'.
   */
  private static async identifyLanguage(rootDirectory: PathLike): Promise<string> {
    const languages = await this.getLanguageDistribution(rootDirectory);
    const best = Object.entries(languages).sort((a, b) => b[1] - a[1])?.[0]?.[0];
    const agent = LANGUAGE_AGENTS[best];
    if (agent && agent.enabled) return best;
    return UNKNOWN_LANGUAGE;
  }

  /**
   * Recursively walk the given `rootDirectory` for known source code files and returns the best-guess SUPPORTED
   * language for the full directory tree. Ignores files and directories that are Git ignored. Results are cached for
   * each directory for the lifetime of the extension. If the most used language is not supported, returns 'unknown'.
   */
  public static async getLanguage(rootDirectory: PathLike): Promise<string> {
    let language = this.LANGUAGE_CACHE[rootDirectory as string];

    if (!language) {
      language = await this.identifyLanguage(rootDirectory);
      this.LANGUAGE_CACHE[rootDirectory as string] = language;
    }

    return language;
  }

  public static async getAgent(rootDirectory: PathLike): Promise<AppMapAgent> {
    const language = await this.getLanguage(rootDirectory);
    return LANGUAGE_AGENTS[language];
  }
}
