import { Event } from 'vscode';
import AppMapLoader from './appmapLoader';

export default interface AppMapCollection {
  readonly onUpdated: Event<AppMapCollection>;

  appMaps(): AppMapLoader[];
}
