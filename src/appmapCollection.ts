import { Event } from 'vscode';
import AppMapDescriptor from './appmapDescriptor';

export default interface AppMapCollection {
  readonly onUpdated: Event<AppMapCollection>;
  appmapDescriptors(): AppMapDescriptor[];
}
