import { URI } from 'vscode-uri';
import Range from './Range';

export default class Location {
  constructor(public readonly uri: URI, public readonly range: Range) {}
}
