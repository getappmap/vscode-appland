import AppMapLoader from './services/appmapLoader';

export interface AppMapsService {
  findByName: (name: string) => AppMapLoader | undefined;
  appMaps: () => AppMapLoader[];
}
