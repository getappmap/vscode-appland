export interface QuickStartItems {
  [key: string]: {
    label: string;
  };
}

export default {
  INSTALL_EXTENSION: {
    label: 'Install AppMap extension',
  },
  SETUP_AGENT: {
    label: 'Setup AppMap agent',
  },
  CREATE_APPMAPS: {
    label: 'Create AppMaps',
  },
  VIEW_APPMAPS: {
    label: 'View your AppMaps',
  },
} as QuickStartItems;
