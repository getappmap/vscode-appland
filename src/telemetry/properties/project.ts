import { PathLike, promises as fs } from 'fs';
import { extname, join } from 'path';
import GitProperties from './versionControlGit';

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
    extensions: ['.cjs', '.es6', '.js', '.jsx', '.mjs'],
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

const LANGUAGE_EXTENSIONS = LANGUAGES.reduce((memo, lang) => {
  const extensions = lang.extensions || [];

  extensions.forEach((ext) => {
    memo[ext] = lang.id;
  });

  return memo;
}, {});

export async function getDirectoryLanguage(dir: PathLike): Promise<string> {
  const directories = [dir];
  const extensions: Record<string, number> = {};
  const gitProperties = new GitProperties();
  await gitProperties.initialize();

  for (;;) {
    const currentDirectory = directories.pop() as string;
    if (!currentDirectory) {
      break;
    }

    const files = await fs.readdir(currentDirectory, { withFileTypes: true });

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

  let bestFitLanguage = UNKNOWN_LANGUAGE;
  let maxCount = 0;

  Object.entries(extensions).forEach(([lang, count]) => {
    if (count > maxCount) {
      bestFitLanguage = LANGUAGE_EXTENSIONS[lang];
      maxCount = count;
    }
  });

  return bestFitLanguage;
}

export async function getProjectProperties(dir: PathLike): Promise<Record<string, string>> {
  return {
    'appmap.project.language': await getDirectoryLanguage(dir),
  };
}
