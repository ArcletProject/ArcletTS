import { Constructor } from "@arcletjs/nepattern";
import { Action, Option, Subcommand, execArgs, execData } from "./base";
import { Args, Arg } from "./args";
import { Namespace, config } from "./config";
import { DataCollection, THeader } from "./typing";
import { manager, ShortcutArgs } from "./manager";
import { TextFormatter } from "./formatter";
import { ParseResult, Behavior } from "./result";
import { Analyser, TADC } from "./analyser";

import * as path from "path";
import { PauseTriggered } from "./errors";

class ActionHandler extends Behavior {
  private readonly mainAction: Action | null;
  private readonly options: Map<string, Action>;

  private step(src: Subcommand, prefix: string | null = null) {
    for (let opt of src._options) {
      if (opt._action) {
        this.options.set(prefix ? `${prefix}.${opt._dest}` : opt._dest, opt._action);
      }
      if ("_options" in opt) {
        this.step(opt, prefix ? `${prefix}.${opt._dest}` : opt._dest);
      }
    }
  }

  constructor(source: Command) {
    super();
    this.mainAction = source._action;
    this.options = new Map();
    this.step(source);
  }

  execute(result: ParseResult<any>) {
    this.beforeExecute(result);
    let source = result.source;
    if (this.mainAction) {
      this.update(result, "mainArgs", execArgs(result.mainArgs, this.mainAction, source._meta.throwError))
    }
    for (let [key, action] of this.options) {
      let d = result.query(key, undefined)
      if (d !== undefined) {
        let [end, value] = execData(d, action, source._meta.throwError);
        this.update(result, `${path}.${end}`, value);
      }
    }
  }
}



export interface TCommandMeta {
  description: string,
  usage: string | null,
  examples: string[],
  author: string | null,
  fuzzyMatch: boolean,
  throwError: boolean,
  hide: boolean,
  keepCRLF: boolean,
}

export class CommandMeta implements TCommandMeta {
  constructor(
    public description: string = "Untitled",
    public usage: string | null = null,
    public examples: string[] = [],
    public author: string | null = null,
    public fuzzyMatch: boolean = false,
    public throwError: boolean = false,
    public hide: boolean = false,
    public keepCRLF: boolean = false,
  ) {
    this.description = description;
    this.usage = usage;
    this.examples = examples;
    this.author = author;
    this.fuzzyMatch = fuzzyMatch;
    this.throwError = throwError;
    this.hide = hide;
    this.keepCRLF = keepCRLF;
  }
}




export class Command<T extends Analyser = Analyser, TD extends DataCollection = TADC<T>> extends Subcommand {
  headers: THeader;
  command: any;
  namespace: string;
  formatter: TextFormatter;
  _meta: TCommandMeta;
  _behaviors: Behavior[];
  analyserType: Constructor<T>;
  union: Set<string>;

  private static globalAnalyserType: Constructor<Analyser> = Analyser;

  static defaultAnalyser<_T extends Analyser = Analyser>(type: Constructor<Analyser>): typeof Command<_T> {
    Command.globalAnalyserType = type;
    return Command;
  }
  constructor(
    name: any | null = null,
    headers: THeader | null = null,
    args: Arg<any>[] | Args = new Args(),
    options: (Option | Subcommand)[] = [],
    action: Action | ((data: any) => any) | null = null,
    meta: TCommandMeta = new CommandMeta(),
    namespace: string | Namespace | null = null,
    separators: string[] = [" "],
    analyserType: Constructor<T> | null = null,
    formatterType: Constructor<TextFormatter> | null = null,
    behaviors: Behavior[] | null = null,
  ) {
    if (!namespace) {
      namespace = config.defaultNamespace;
    } else if (namespace instanceof Namespace) {
      namespace = config.setdefault(namespace.name, namespace);
    } else {
      namespace = config.setdefault(namespace, new Namespace(namespace));
    }
    let _args = args instanceof Args ? args : new Args(...args);
    super("ALCONNA::", _args, options, null, action, separators);
    this.headers = headers || Array.from(namespace.headers);
    this.command = name || (this.headers.length > 0 ? "" : "Alconna");
    this.namespace = namespace.name;
    this.analyserType = analyserType || Command.globalAnalyserType;
    this._meta = meta;
    this._meta.fuzzyMatch = this._meta.fuzzyMatch || namespace.fuzzyMatch;
    this._meta.throwError = this._meta.throwError || namespace.throwError;
    this._options.push(
      new Option(
        namespace.optionName.help.join("|")
        ).help(config.lang.require("builtin.option_help")),
      new Option(
        namespace.optionName.shortcut.join("|"),
        Args.push("delete;?", "delete")
        .push("name", String)
        .push("command", String, "_")
        ).help(config.lang.require("builtin.option_shortcut")),
      new Option(
        namespace.optionName.completion.join("|")
        ).help(config.lang.require("builtin.option_completion")),
    )
    this._behaviors = behaviors || [];
    this._behaviors.splice(0, 0, new ActionHandler(this));
    this.formatter = new (formatterType || namespace.formatterType || TextFormatter)();
    this.name = `${this.command || this.headers[0]}`.replace(/ALCONNA::/g, "");
    manager.register(this);
    this.union = new Set();
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

  compile(): T {
    //@ts-ignore
    return Analyser.compile(this)
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
    this._options.splice(this._options.length - 3, 3)
    this._options.push(
      new Option(
        namespace.optionName.help.join("|")
        ).help(config.lang.require("builtin.option_help")),
      new Option(
        namespace.optionName.shortcut.join("|"),
        Args.push("delete;?", "delete")
        .push("name", String)
        .push("command", String, "_")
        ).help(config.lang.require("builtin.option_shortcut")),
      new Option(
        namespace.optionName.completion.join("|")
        ).help(config.lang.require("builtin.option_completion")),
    )
    this._meta.fuzzyMatch = namespace.fuzzyMatch || this._meta.fuzzyMatch
    this._meta.throwError = namespace.throwError || this._meta.throwError
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

  resetBehavior(...behaviors: Behavior[]): this {
    this._behaviors.splice(1, this._behaviors.length, ...behaviors);
    return this;
  }

  getHelp(): string {
    return this.formatter.format();
  }

  shortcut(key: string, args?: ShortcutArgs, del: boolean = false) {
    try {
      if (del) {
        manager.deleteShortcut(this, key)
        return config.lang.replaceKeys("shortcut.delete_success", {shortcut: key, target: this.path})
      }
      if (args) {
        manager.addShortcut(this, key, args)
        return config.lang.replaceKeys("shortcut.add_success", {shortcut: key, target: this.path})
      }
      let cmd = manager.recentMessage
      if (cmd) {
        let alc = manager.lastUsing
        if (alc && alc == this) {
          manager.addShortcut(this, key, {command: cmd})
        return config.lang.replaceKeys("shortcut.add_success", {shortcut: key, target: this.path})
        }
        throw new Error(config.lang.replaceKeys(
        "shortcut.recent_command_error",
        {target: this.path, source: alc?.path || "Unknown"}
      ))
      }
      throw new Error(config.lang.require("shortcut.no_recent_command"))
    } catch(e) {
      if (this._meta.throwError) {
        throw e;
      }
      return (<Error>e).message
    }
  }

  unionWith(...commands: Command[]): this {
    commands.forEach(cmd => {this.union.add(cmd.path)})
    return this;
  }

  private _parse(message: TD, interrupt: boolean = false): ParseResult<TD> {
    if (this.union.size > 0) {
      for (let ana of manager.requires(...this.union)) {
        ana.container.build(message);
        let res = ana.process(null, interrupt);
        if (res.matched) {
          return res as ParseResult<TD>;
        }
      }
    }
    //@ts-ignore
    let analyser = manager.require(this)
    analyser.container.build(message);
    return analyser.process(null, interrupt) as ParseResult<TD>;
  }

  parse(message: TD): ParseResult<TD>;
  parse(message: TD, interrupt: true): ParseResult<TD> | T;
  parse(message: TD, interrupt: boolean = false): any {
    let arp: ParseResult<TD>;
    try {
      arp = this._parse(message, interrupt);
    } catch(e) {
      if (e instanceof PauseTriggered) {
        return e.ana as T;
      }
      throw e;
    }
    if (arp.matched) {
      this._behaviors[0].execute(arp);
      arp = arp.execute();
    }
    return arp;
  }
}



