import { CodeObjectEntry } from './services/classMapIndex';

export interface ClassMapService {
  classMap: () => Promise<CodeObjectEntry[]>;

  onChanged(listener: () => void): void;
}
