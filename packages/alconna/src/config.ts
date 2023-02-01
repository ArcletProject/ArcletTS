import * as fs from "fs"

type OptionNames = {
  help: string[],
  shortcut: string[],
  completion: string[],
}

class Namespace {
  constructor(
    public name: string,
    public headers: Array<string | object> | Array<[object, string]> = [],
    public separators: string[] = [" "],
    public behaviors: any[] = [],
    public formatter_type: (() => any) | null = null,
    public fuzzy_match: boolean = false,
    public raise_error: boolean = false,
    public option_name: OptionNames = {
      help: ["--help", "-h"],
      shortcut: ["--shortcut", "-s"],
      completion: ["--comp", "-c"]
    },
  ) {
    this.name = name;
    this.headers = headers;
    this.separators = separators;
    this.behaviors = behaviors;
    this.formatter_type = formatter_type;
    this.fuzzy_match = fuzzy_match;
    this.raise_error = raise_error;
    this.option_name = option_name;
  }

  equals(other: Namespace): boolean {
    return this.name === other.name;
  }

  toString(): string {
    return `Namespace(${this.name}, ${this.headers}, ${this.separators}, ${this.formatter_type}, ${this.fuzzy_match}, ${this.raise_error}, ${this.option_name})`;
  }
}


class Lang {
  public path = `${__dirname}/lang/default.json`;
  private file: object;
  private config: { [key: string]: string };

  constructor() {
    this.file = require(this.path);
    this.config = this.file[this.file["$default"]];
  }

  get types(): string[] {
    let out: string[] = [];
    for (let key in this.file) {
      if (key.startsWith("$")) continue;
      out.push(key);
    }
    return out;
  }

  replace(key: string, ...value: any[]) {
    let text: string = this.config[key];
    if (text == undefined) throw new Error(`Key ${key} not found`);
    for (let i = 0; i < value.length; i++) {
      text = text.replace(`{${i}}`, value[i].toString());
    }
    return text;
  }

  replaceKeys(key: string, value: { [key: string]: any }) {
    let text: string = this.config[key];
    if (text == undefined) throw new Error(`Key ${key} not found`);
    for (let k in value) {
      text = text.replace(`{${k}}`, value[k].toString());
    }
    return text;
  }

  changeType(type: string) {
    if (type != "$default" && !this.types.includes(type)) {
      this.config = this.file[type];
      this.file["$default"] = type;
      fs.writeFileSync(this.path, JSON.stringify(this.file, null, 2));
      return undefined;
    }
    throw new Error(this.replaceKeys("lang.type_error", {target: type}));
  }

  reload(path: string, lang: string | null = null) {
    let content = require(path);
    if (lang == null) {
      for (let key in content) {
        this.config[key] = content[key];
      }
    } else if (lang in this.file) {
      for (let key in content) {
        this.file[lang][key] = content[key];
      }
      this.config = this.file[lang];
    } else {
      this.file[lang] = content;
      this.config = content;
    }
  }

  require(name: string): string {
    return this.config[name] || name;
  }

  set(key: string, value: string) {
    if (key in this.config) {
      this.config[key] = value;
    } else {
      throw new Error(this.replaceKeys("lang.name_error", {target: key}));
    }
  }
}

class AlconnaConfig {
  lang: Lang = new Lang();
  command_max_count: number = 200;
  message_max_count: number = 100;
  fuzzy_threshold: number = 0.6;
  _default_namespace: string = "Alconna";
  namespace: { [np: string]: Namespace } = {Alconna: new Namespace("Alconna")};

  get default_namespace(): Namespace {
    return this.namespace[this._default_namespace];
  }

  set default_namespace(ns: string | Namespace) {
    if (typeof ns == "string") {
      if (!(ns in this.namespace)) {
        let old = this.namespace[this._default_namespace];
        old.name = ns;
        this.namespace[ns] = old;
      }
      this._default_namespace = ns;
    } else {
      this.namespace[ns.name] = ns;
      this._default_namespace = ns.name;
    }
  }
}

const config = new AlconnaConfig();
let load_lang = config.lang.reload;


function withNamespace(name: string | Namespace, callbackFn: (ns: Namespace) => void) {
  let ns = name instanceof Namespace ? name : new Namespace(name);
  let nm = ns.name;
  let old = config.default_namespace;
  config.default_namespace = ns;
  callbackFn(ns);
  config.default_namespace = old;
  config.namespace[nm] = ns;
  return ns;
}

export {config, load_lang, withNamespace, Namespace, Lang};