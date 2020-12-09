// @ts-check

class CodeObject {
  constructor(/** @type {Object<name: string, type: string, location: string, static: boolean>} */ data, /** @type {CodeObject} */ parent) {
    this.data = data;
    this.parent = parent;
    this.children = [];
    if ( this.parent ) {
      this.parent.children.push(this);
    }
  }

  get id() {
    const tokens = this.buildId();

    if ( this.parent && this.type === 'function' ) {
      const separator = this.static ? '.' : '#';
      tokens[tokens.length - 2] = separator;
    }

    return tokens.join('');
  }

  get name() {
    return this.data.name;
  }

  get type() {
    return this.data.type;
  }

  get static() {
    return this.data.static;
  }

  get location() {
    return this.data.location;
  }

  /**
   * Gets the source locations for this code object. For a package, no source locations are returned
   * (there would be too many to be useful). For a class, the paths to all files which add methods to the class are 
   * returned. For a function, the path and line number is returned.
   * 
   * @returns {Array<String>}
   */
  get locations() {
    switch ( this.type ) {
    case 'package':
      return [];
    case 'class':
      return Array.from(this.classLocations()).sort();
    case 'function':
      return [ this.location ];
    }
  }

  /**
   * @returns {String}
   */
  get packageOf() {
    const tokens = this.collectAncestors('package');
    if ( tokens.length === 0 ) {
      return null;
    }
    return tokens.join('/');
  }

  /**
   * @returns {String}
   */
  get classOf() {
    const tokens = this.collectAncestors('class');
    if ( tokens.length === 0 ) {
      return null;
    }
    return tokens.join('::');
  }

  /**
   * @param {Array<String>} tokens 
   * @returns {Array<String>}
   */
  buildId(tokens = []) {
    if ( this.parent ) {
      this.parent.buildId(tokens);

      let separator;
      switch (this.parent.type) {
      case 'package':
        separator = '/';
        break;
      case 'class':
        separator = '::';
        break;
      }
      tokens.push(separator);    
    }
    tokens.push(this.name);
    return tokens;
  }

  /**
   * @param {String} type
   * @param {Array<String>} tokens 
   * @returns {Array<String>}
   */
  collectAncestors(type, tokens = []) {
    if ( this.parent ) {
      this.parent.collectAncestors(type, tokens);
    }
    if ( this.type === type ) {
      tokens.push(this.name);
    }
    return tokens;
  }

  /**
   * @param {Set<string>} paths 
   * @returns {Set<string>}
   */
  classLocations(paths = new Set()) {
    this.children.forEach((child) => child.classLocations(paths));

    if ( this.type === 'function' ) {
      const tokens = this.data.location.split(':', 2);
      paths.add(tokens[0]);
    }
    return paths;
  }
}

export default class ClassMap {
  /**
   * @param {Array<{type: string, name: string, location: string, static: boolean}>} classMap 
   */
  constructor(classMap) {
    this.codeObjectsByLocation = /** @type {Object<string:Array<CodeObject>>} */ [];
    this.codeObjects = /** @type {Array<CodeObject>} */ [];
    this.codeObjectsById = /** @type {Object<string:CodeObject>} */ {};

    /**
     * @param {*} data 
     * @param {CodeObject} parent 
     * @returns {CodeObject}
     */
    function buildCodeObject(data, parent = null) {
      const co = new CodeObject(data, parent);
      this.codeObjects.push(co);
      this.codeObjectsById[co.id] = co;

      (data.children || []).forEach((child) => {
        buildCodeObject.bind(this)(child, co);
      });

      if ( co.type !== 'package' ) {
        co.locations.forEach((location) => {
          let codeObjects = this.codeObjectsByLocation[location];
          if ( !codeObjects ) {
            codeObjects = [];
            this.codeObjectsByLocation[location] = codeObjects;
          }
          codeObjects.push(co);
        });
      }

      return co;
    }

    this.roots = classMap.map((root) => buildCodeObject.bind(this)(root));

    console.log(Object.keys(this.codeObjectsById))
    console.log(Object.keys(this.codeObjectsByLocation))
  }

  /**
   * @param {string} query 
   */
  search(query) {
    const queryLower = query.toLowerCase();
    return this.codeObjects.filter((co) => co.id.toLowerCase().indexOf(queryLower) !== -1);
  }

  /**
   * @param {String} id 
   * @returns {CodeObject}
   */
  codeObjectFromId(id) {
    return this.codeObjectsById[id];
  }

  /**
   * @param {String} location
   * @returns {Array<string>}
   */
  codeObjectsAtLocation(location) {
    return this.codeObjectsByLocation[location];
  }
}

// module.exports = ClassMap;