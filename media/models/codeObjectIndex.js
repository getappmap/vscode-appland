// @ts-check

export class CodeObjectIndex {
  /**
   * @param {Array<{type: string, name: string, static: boolean}>} classMap 
   */
  constructor(classMap) {
    this.names = /** @type {Array<string>} */ [];
    this.types = /** @type {Object<string: string>} */ {};
    this.classes = /** @type {Object<string: string>} */ {};

    const tokens = [];
    function indexObject(item) {
      let separator;
      if ( tokens.length > 0 ) {
        switch (item.type) {
        case 'package':
          separator = '/';
          break;
        case 'class':
          separator = '::';
          break;
        case 'function':
          separator = item.static ? '.' : '#';
          break;
        }
        tokens.push(separator);  
      }

      tokens.push(item.name);
      const name = tokens.join('');
      this.names.push(name);
      this.types[name] = item.type;
      if ( item.type == 'function' ) {
        const classTokens = [...tokens];
        // Pop the function name and the separator to get the class name
        classTokens.pop();
        classTokens.pop();
        this.classes[name] = classTokens.join('');
      }

      if ( item.children ) {
        item.children.forEach(indexObject.bind(this));
      }

      tokens.pop();
      if ( separator ) {
        tokens.pop();
      }
    };

    classMap.forEach(indexObject.bind(this));
  }

  /**
   * @param {string} query 
   */
  search(query) {
    return this.names.filter((name) => name.indexOf(query) !== -1);
  }

  /**
   * @param {string} name
   */
  typeOf(name) {
    return this.types[name];
  }

  /**
   * @param {string} functionName
   */
  classOfFunction(functionName) {
    return this.classes[functionName];
  }
}
