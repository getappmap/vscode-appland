import { CodeObjectEntry } from './lib/CodeObjectEntry';

export interface ClassMapService {
  classMap: () => Promise<CodeObjectEntry[]>;

  onChanged(listener: () => void): void;
}
