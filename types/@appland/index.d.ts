declare module '@appland/models' {
  class AppMap {}
  class AppMapBuilder {
    normalize(): AppMapBuilder;
    build(): AppMap;
  }

  function buildAppMap(data: string | Record<string, unknown>): AppMapBuilder;
}
