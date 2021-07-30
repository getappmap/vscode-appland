import { CodeObjectType, AppMap } from '@appland/models';

// eslint-disable-next-line import/prefer-default-export
export function getAppMapMetrics(appmap) {
  const metrics = {
    'appmap.json.num_classes': 0,
    'appmap.json.num_events': 0,
    'appmap.json.num_functions': 0,
    'appmap.json.num_http_client_events': 0,
    'appmap.json.num_http_server_events': 0,
    'appmap.json.num_labels': 0,
    'appmap.json.num_labeled_events': 0,
    'appmap.json.num_packages': 0,
    'appmap.json.num_sql_events': 0,
  };

  if (appmap instanceof AppMap) {
    metrics['appmap.json.num_events'] = appmap.events.length;
    metrics['appmap.json.num_labels'] = Object.keys(appmap.labels).length;

    appmap.events
      .filter((e) => e.isCall())
      .forEach((e) => {
        if (e.httpServerRequest) {
          metrics['appmap.json.num_http_server_events'] += 1;
        } else if (e.http_client_request /* As of now, there's no httpClientRequest accessor */) {
          metrics['appmap.json.num_http_client_events'] += 1;
        } else if (e.sql) {
          metrics['appmap.json.num_sql_events'] += 1;
        }

        if (e.labels.size) {
          metrics['appmap.json.num_labeled_events'] += 1;
        }
      });

    appmap.classMap.codeObjects.forEach((codeObject) => {
      if (codeObject.type === CodeObjectType.FUNCTION) {
        metrics['appmap.json.num_functions'] += 1;
      } else if (codeObject.type === CodeObjectType.CLASS) {
        metrics['appmap.json.num_classes'] += 1;
      } else if (codeObject.type === CodeObjectType.PACKAGE) {
        metrics['appmap.json.num_packages'] += 1;
      }
    });
  }

  return metrics;
}
