import { CodeObjectEntry } from './services/classMapIndex';

export interface ClassMapService {
  classMap: () => Promise<CodeObjectEntry[]>;
}
