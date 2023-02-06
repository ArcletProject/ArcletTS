import { Action, Option, Subcommand } from "./base";
import { Args, Arg } from "./args";
import { Namespace, config } from "./config";
import { DataCollection } from "./typing";
import { manager } from "./manager";
import { TextFormatter } from "./formatter";

type Header = Array<string | object> | Array<[object, string]>

export interface TCommandMeta {
  description: string,
  usage: string | null,
  examples: string[],
  author: string | null,
  fuzzy_match: boolean,
  raise_error: boolean,
  hide: boolean,
  keep_crlf: boolean,
}

export class CommandMeta implements TCommandMeta {
  constructor(
    public description: string = "Untitled",
    public usage: string | null = null,
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
  formatter_gen: (cmd: Command) => TextFormatter;
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
    formatter_gen: ((cmd: Command) => TextFormatter) | null = null
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
    this.headers = headers || Array.from(namespace.headers);
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
        Args.push("delete;?", "delete")
        .push("name", String)
        .push("command", String, "$")
        ).help(config.lang.require("builtin.option_shortcut")),
      new Option(
        namespace.option_name.completion.join("|")
        ).help(config.lang.require("builtin.option_completion")),
    )
    this.formatter_gen = formatter_gen || config.default_namespace.formatter_gen || ((cmd: Command) => {return new TextFormatter(cmd)});
    this.name = `${this.command || this.headers[0]}`.replace(/ALCONNA:/g, "");
    manager.register(this);
  }

  meta(data: CommandMeta): this
  meta(data: Partial<TCommandMeta>): this
  meta(data: TCommandMeta): this {
    if (data instanceof CommandMeta) {
      this._meta = data;
    } else {
      Object.assign(this._meta, data);
    }
    return this;
  }

  get path() {
    return `${this.namespace}:${this.name}`;
  }

  get nsConfig() {
    return config.namespace[this.namespace];
  }

  resetNamespace(ns: string | Namespace, header: boolean = true): this {
    manager.delete(this);
    let namespace: Namespace
    if (typeof ns == "string") {
      namespace = config.setdefault(ns, new Namespace(ns))
    } else {
      namespace = ns
    }
    this.namespace = namespace.name
    if (header) {
      this.headers.splice(0, this.headers.length)
      //@ts-ignore
      this.headers.push(...namespace.headers)
    }
    this.formatter_gen = namespace.formatter_gen || this.formatter_gen
    this._options.splice(this._options.length - 3, 3)
    this._options.push(
      new Option(
        namespace.option_name.help.join("|")
        ).help(config.lang.require("builtin.option_help")),
      new Option(
        namespace.option_name.shortcut.join("|"),
        Args.push("delete;?", "delete")
        .push("name", String)
        .push("command", String, "$")
        ).help(config.lang.require("builtin.option_shortcut")),
      new Option(
        namespace.option_name.completion.join("|")
        ).help(config.lang.require("builtin.option_completion")),
    )
    this._meta.fuzzy_match = namespace.fuzzy_match || this._meta.fuzzy_match
    this._meta.raise_error = namespace.raise_error || this._meta.raise_error
    manager.register(this)
    return this
  }

  option(...args: ConstructorParameters<typeof Option>): this
  option(args: Option): this
  option(...args: any[]): this {
    manager.delete(this)
    let opt = (args[0] instanceof Option) ? args[0] : new Option(...args as ConstructorParameters<typeof Option>);
    this._options.splice(this._options.length - 3, 0, opt);
    manager.register(this)
    return this;
  }

  subcommand(...args: ConstructorParameters<typeof Subcommand>): this
  subcommand(args: Subcommand): this
  subcommand(...args: any[]): this {
    manager.delete(this)
    let sub = (args[0] instanceof Subcommand) ? args[0] : new Subcommand(...args as ConstructorParameters<typeof Subcommand>);
    this._options.splice(this._options.length - 3, 0, sub);
    manager.register(this)
    return this;
  }

  push(...args: (Option | Subcommand)[]): this {
    manager.delete(this)
    this._options.splice(this._options.length - 3, 0, ...args);
    manager.register(this)
    return this;
  }

  getHelp(): string {
    return this.formatter_gen(this).format()
  }

  parse<T extends DataCollection<any>>(message: T): ParseResult<T> | void {
    let ana = manager.require(this)
  }
}

import { ParseResult } from "./result";
