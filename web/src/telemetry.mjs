import { CodeObjectType, AppMap } from '@appland/models';

// eslint-disable-next-line import/prefer-default-export
export function getAppMapMetrics(appmap) {
  const metrics = {
    'appmap.data.num_classes': 0,
    'appmap.data.num_events': 0,
    'appmap.data.num_functions': 0,
    'appmap.data.num_http_client_events': 0,
    'appmap.data.num_http_server_events': 0,
    'appmap.data.num_labels': 0,
    'appmap.data.num_labeled_events': 0,
    'appmap.data.num_packages': 0,
    'appmap.data.num_sql_events': 0,
  };

  if (appmap instanceof AppMap) {
    metrics['appmap.data.num_events'] = appmap.events.length;
    metrics['appmap.data.num_labels'] = Object.keys(appmap.labels).length;

    appmap.events
      .filter((e) => e.isCall())
      .forEach((e) => {
        if (e.httpServerRequest) {
          metrics['appmap.data.num_http_server_events'] += 1;
        } else if (e.http_client_request /* As of now, there's no httpClientRequest accessor */) {
          metrics['appmap.data.num_http_client_events'] += 1;
        } else if (e.sql) {
          metrics['appmap.data.num_sql_events'] += 1;
        }

        if (e.labels.size) {
          metrics['appmap.data.num_labeled_events'] += 1;
        }
      });

    appmap.classMap.codeObjects.forEach((codeObject) => {
      if (codeObject.type === CodeObjectType.FUNCTION) {
        metrics['appmap.data.num_functions'] += 1;
      } else if (codeObject.type === CodeObjectType.CLASS) {
        metrics['appmap.data.num_classes'] += 1;
      } else if (codeObject.type === CodeObjectType.PACKAGE) {
        metrics['appmap.data.num_packages'] += 1;
      }
    });
  }

  return metrics;
}
