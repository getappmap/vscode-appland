import * as vscode from 'vscode';
import { extname } from 'path';
import backgroundJob from '../lib/backgroundJob';
import GitProperties from '../telemetry/properties/versionControlGit';

export const SUPPORTED_LANGUAGES = ['ruby', 'python', 'java', 'javascript'] as const;
export const UNKNOWN_LANGUAGE = 'unknown';

export type LanguageId = typeof SUPPORTED_LANGUAGES[number] | typeof UNKNOWN_LANGUAGE;

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

type LanguageStats = Record<string, number>;

const LANGUAGE_CACHE: Record<string, LanguageStats> = {};
const LANGUAGE_CACHE_EXPIRY = 60 * 1000;
const LANGUAGE_DISTRIBUTION_CACHE: Record<string, LanguageStats> = {};

function folderPath(folder: vscode.WorkspaceFolder | string): string {
  return typeof folder === 'string' ? folder : folder.uri.fsPath;
}

/**
 * Provides language identification APIs.
 */
export default class LanguageResolver {
  static clearCache(): void {
    Object.keys(LANGUAGE_DISTRIBUTION_CACHE).forEach(
      (key) => delete LANGUAGE_DISTRIBUTION_CACHE[key]
    );
    Object.keys(LANGUAGE_CACHE).forEach((key) => delete LANGUAGE_CACHE[key]);
  }

  static async getLanguageDistribution(
    folder: vscode.WorkspaceFolder | string
  ): Promise<LanguageStats> {
    const cachedValue = LANGUAGE_DISTRIBUTION_CACHE[folderPath(folder)];
    if (cachedValue) {
      return cachedValue;
    }

    const extensions: LanguageStats = {};
    const gitProperties = new GitProperties();
    await gitProperties.initialize(folderPath(folder));

    const searchPattern = new vscode.RelativePattern(folderPath(folder), '**');

    // VSCode will already respect the user's ignore list. We can supplement that with the .gitignore files.
    await vscode.workspace.findFiles(searchPattern).then((files) => {
      files
        .filter((file) => !gitProperties.isIgnored(file.fsPath))
        .forEach((file) => {
          const fileExtension = extname(file.fsPath);
          if (fileExtension !== '' && LANGUAGE_EXTENSIONS[fileExtension]) {
            extensions[fileExtension] = (extensions[fileExtension] || 0) + 1;
          }
        });
    });

    const languages = Object.entries(extensions).reduce((memo, [ext, count]) => {
      const language = LANGUAGE_EXTENSIONS[ext];
      memo[language] = memo[language] + count || count;
      return memo;
    }, {} as LanguageStats);

    const totalFiles = Object.values(languages).reduce((a, b) => a + b, 0);
    if (totalFiles > 0) {
      Object.keys(languages).forEach((key) => {
        languages[key] /= totalFiles;
      });
    }

    LANGUAGE_DISTRIBUTION_CACHE[folderPath(folder)] = languages;

    return languages;
  }

  /**
   * Retrieve the most frequently used language id for a given directory. The language returned must be supported (i.e.,
   * it must be registered in LANGUAGE_AGENTS). If the language is not supported, returns 'unknown'.
   */
  private static async identifyLanguage(
    folder: vscode.WorkspaceFolder | string
  ): Promise<LanguageId> {
    let languageStats = LANGUAGE_CACHE[folderPath(folder)];
    if (!languageStats) {
      languageStats = await backgroundJob<LanguageStats>(
        `appmap.languageDistribution.${folderPath(folder)}`,
        LanguageResolver.getLanguageDistribution.bind(null, folder),
        250
      );

      console.log(
        `[language-resolver] Detected languages ${JSON.stringify(
          languageStats
        )} in project ${folderPath(folder)}`
      );

      LANGUAGE_CACHE[folderPath(folder)] = languageStats;
      setTimeout(() => delete LANGUAGE_CACHE[folderPath(folder)], LANGUAGE_CACHE_EXPIRY);
    }

    const best = Object.entries(languageStats).sort((a, b) => b[1] - a[1])?.[0]?.[0];
    return toSupported(best);
  }

  /**
   * Recursively inspects a folder for known source code files and returns the best-guess SUPPORTED
   * language for the full directory tree. Ignores files and directories that are Git-ignored.
   *
   * @returns unknown if the most used language is not supported
   */
  public static async getLanguage(folder: vscode.WorkspaceFolder | string): Promise<LanguageId> {
    return await this.identifyLanguage(folder);
  }
}

function toSupported(lang: string): LanguageId {
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
    return lang as LanguageId;
  }
  return UNKNOWN_LANGUAGE;
}
