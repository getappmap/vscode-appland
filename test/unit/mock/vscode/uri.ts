import { URI, Utils } from 'vscode-uri';

export const Uri = URI;
Uri.prototype.joinPath = function (...paths) {
  return Utils.joinPath(this, ...paths);
};
