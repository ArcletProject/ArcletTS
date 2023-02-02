import { Action, Option, Subcommand } from "./base";
import { Args, Arg } from "./args";
import { Namespace, config } from "./config";
import { DataCollection } from "./typing";

type Header = Array<string | object> | Array<[object, string]>

export interface TCommandMeta {
  description: string,
  usage?: string,
  examples?: string[],
  author?: string | null,
  fuzzy_match?: boolean,
  raise_error?: boolean,
  hide?: boolean,
  keep_crlf?: boolean,
}

export class CommandMeta implements TCommandMeta {
  constructor(
    public description: string = "Untitled",
    public usage?: string,
    public examples: string[] = [],
    public author: string | null = null,
    public fuzzy_match: boolean = false,
    public raise_error: boolean = false,
    public hide: boolean = false,
    public keep_crlf: boolean = false,
  ) {
    this.description = description;
    this.usage = usage;
    this.examples = examples;
    this.author = author;
    this.fuzzy_match = fuzzy_match;
    this.raise_error = raise_error;
    this.hide = hide;
    this.keep_crlf = keep_crlf;
  }
}

export class Command extends Subcommand {
  headers: Header;
  command: any;
  namespace: string;
  _meta: TCommandMeta;
  constructor(
    name: any | null = null,
    headers: Header | null = null,
    args: Arg<any>[] | Args = new Args(),
    options: (Option | Subcommand)[] = [],
    action: Action | ((data: any) => any) | null = null,
    meta: TCommandMeta = new CommandMeta(),
    namespace: string | Namespace | null = null,
    separators: string[] = [" "],
  ) {
    if (!namespace) {
      namespace = config.default_namespace;
    } else if (namespace instanceof Namespace) {
      namespace = config.setdefault(namespace.name, namespace);
    } else {
      namespace = config.setdefault(namespace, new Namespace(namespace));
    }
    let _args = args instanceof Args ? args : new Args(...args);
    super("ALCONNA:", _args, options, null, action, separators);
    this.headers = headers || namespace.headers;
    this.command = name || (this.headers.length > 0 ? "" : "Alconna");
    this.namespace = namespace.name;
    this._meta = meta;
    this._meta.fuzzy_match = this._meta.fuzzy_match || namespace.fuzzy_match;
    this._meta.raise_error = this._meta.raise_error || namespace.raise_error;
    this._options.push(
      new Option(
        namespace.option_name.help.join("|")
        ).help(config.lang.require("builtin.option_help")),
      new Option(
        namespace.option_name.shortcut.join("|"),
        Args.from("delete;?", "delete")
        .from("name", String)
        .from("command", String, "$")
        ).help(config.lang.require("builtin.option_shortcut")),
      new Option(
        namespace.option_name.completion.join("|")
        ).help(config.lang.require("builtin.option_completion")),
    )
    this.name = `${this.command || this.headers[0]}`.replace("ALCONNA:", "");
  }

  meta(data: TCommandMeta): this {
    this._meta = data;
    return this;
  }

  get path() {
    return `${this.namespace}:${this.name}`;
  }

  get nsConfig() {
    return config.namespace[this.namespace];
  }

  option(arg: Option): this {
    this._options.splice(this._options.length - 3, 0, arg);
    return this;
  }
  subcommand(arg: Subcommand):this {
    this._options.splice(this._options.length - 3, 0, arg);
    return this;
  }
  push(...args: (Option | Subcommand)[]): this {
    this._options.splice(this._options.length - 3, 0, ...args);
    return this;
  }

  parse<T extends DataCollection>(message: T) {

  }
}
