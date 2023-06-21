#!/usr/bin/env python

if __name__ == '__main__':
  try:
    import appmap
    # By loading the appmap module, we've verified that it's installed.
    # It'll also create a valid appmap.yml file if one doesn't already exist.
    print('AppMap is successfully installed.')
  except ImportError:
    print('The `appmap` module was not found. Please use your dependency management tool to install it.')
    exit(1)
