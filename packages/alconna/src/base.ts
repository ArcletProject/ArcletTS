import {Args, Arg} from "./args";
import { InvalidParam } from "./errors";
import {config} from "./config";
import { Dict } from "@arcletjs/nepattern";
import { OptionResult, SubcommandResult } from "./model";

export class Action {
  static ensure(action: Action | ((data: Dict) => void) | null): Action | null {
    if (!action) {
      return null
    }
    if (action instanceof Action) {
      return action;
    }
    return new Action(action);
  }

  constructor(
    public fn: (...args: any[]) => any,
  ) {
    this.fn = fn;
  }

  exec(
    params: Dict,
    varargs: any[] | null = null,
    kwargs: Dict | null = null,
    raise: boolean = false,
  ): any {
    let vars: any[] = [];
    for (let key in params) {
      vars.push(params[key]);
    }
    vars.push(...(varargs || []));
    if (kwargs) {
      for (let key in kwargs) {
        vars.push(kwargs[key]);
      }
    }
    try {
      let out = this.fn(...vars);
      if (out instanceof Promise) {
        out = out.then((x) => x);
      }
      if (!out || !(out instanceof Object)) {
        return params;
      }
      return out as Dict;
    } catch (e) {
      if (raise) {
        throw e;
      }
      return params;
    }
  }
}

export function execArgs(
  args: Map<string, any>,
  func: Action,
  raise: boolean
) {
  let result = new Map<string, any>(args);
  let [kwargs, kwonly, varargs, kwKey, varKey] = [new Map(), new Map(), [], null, null];
  if (result.has("$kwargs")) {
    [kwargs, kwKey] = result.get("$kwargs");
    result.delete("$kwargs");
    result.delete(<string><unknown>kwKey);
  }
  if (result.has("$varargs")) {
    [varargs, varKey] = result.get("$varargs");
    result.delete("$varargs");
    result.delete(<string><unknown>varKey);
  }
  if (result.has("$kwonly")) {
    kwonly = result.get("$kwonly");
    for (let key of kwonly.keys()) {
      result.delete(key);
    }
  }
  let additions = new Map<string, any>(...kwonly, ...kwargs);
  let res = func.exec(result, varargs, additions, raise);
  if (kwKey) {
    res[kwKey] = kwargs;
  }
  if (varKey) {
    res[varKey] = varargs;
  }
  return res;
}

export function execData(
  data: OptionResult | SubcommandResult,
  func: Action,
  raise: boolean
) {
  return Object.keys(data.args).length > 0 ? ["args", execArgs(data.args, func, raise)] :
  ["value", func.fn()];
}

export class CommandNode {
  name: string;
  _dest: string;
  args: Args;
  separators: string[];
  _action: Action | null;
  helpText: string;
  requires: string[];
  nargs: number;
  isCompact: boolean;

  constructor(
    name: string,
    args: Args | Arg<any> | null = null,
    dest: string | null = null,
    action: ((data: Dict) => void) | Action | null = null,
    separators: string | Iterable<string> = [" "],
    help: string | null = null,
    requires: string[] | Set<string> = [],
  ) {
    if (!name.trim()) {
      throw new InvalidParam(config.lang.require("node.name_empty"));
    }
    let mat = name.match(/^[`~!@#$%^&*()_+=\[\]{}|;:'",<.>/?]+.*$/);
    if (mat) {
      throw new InvalidParam(config.lang.require("node.name_error"));
    }
    let _parts = name.split(" ");
    this.name = _parts[_parts.length - 1];
    this.requires = Array.from(requires);
    this.requires.push(..._parts.slice(0, -1));
    this.args = new Args().merge(args)
    this._action = Action.ensure(action);
    this.separators = typeof separators == "string" ? [separators] : Array.from(separators);
    this.nargs = this.args.length;
    this.isCompact = this.separators.length == 1 && this.separators[0] == "";
    this._dest = (dest || (this.requires.length > 0 ? this.requires.join("_") + "_" + this.name : this.name)).replace(/^-+/, "");
    this.helpText = help || this._dest;
  }
  separate(...seps: string[]):this {
    this.separators = seps;
    return this;
  }
  toString(): string {
    return this._dest + this.args.empty ? "" : `(args=${this.args.toString()})`;
  }

  require(...args: string[]): this {
    this.requires.push(...args);
    return this;
  }

  help(text: string): this {
    this.helpText = text;
    return this;
  }

  action(fn: (data: Dict) => void): this {
    this._action = Action.ensure(fn);
    return this
  }
}

export class Option extends CommandNode {
  _priority: number;
  aliases: string[];

  constructor(
    name: string,
    args: Args | Arg<any> | null = null,
    aliases: string[] = [],
    dest: string | null = null,
    action: ((data: Dict) => void) | Action | null = null,
    separators: string | Iterable<string> = [" "],
    help: string | null = null,
    requires: string[] | Set<string> = [],
    priority: number = 0,
  ) {
    let _name = name.split(" ").at(-1)!;
    if (_name.includes("|")) {
      let _aliases = _name.split("|");
      _aliases = _aliases.sort((a, b) => b.length - a.length);
      name = name.replace(_name, _aliases[0]);
      _name = _aliases[0];
      aliases.push(..._aliases.slice(1));
    }
    aliases.splice(0, 0, _name);
    super(name, args, dest, action, separators, help, requires);
    this._priority = priority;
    this.aliases = aliases;
  }
  alias(...args: string[]): this {
    args = args.sort((a, b) => b.length - a.length).reverse();
    this.aliases = args;
    this.aliases.splice(0, 0, this.name);
    return this;
  }

  priority(level: number): this {
    this._priority = level;
    return this;
  }
}

export class Subcommand extends CommandNode {
  _options: Array<Option | Subcommand>;
  constructor(
    name: string,
    args: Args | Arg<any> | null = null,
    options: Array<Option | Subcommand> = [],
    dest: string | null = null,
    action: ((data: Dict) => void) | Action | null = null,
    separators: string | Iterable<string> = [" "],
    help: string | null = null,
    requires: string[] | Set<string> = [],
  ) {
    super(name, args, dest, action, separators, help, requires);
    this._options = options;
  }

  option(...args: ConstructorParameters<typeof Option>): this
  option(args: Option): this
  option(...args: any[]): this {
    if (args[0] instanceof Option) {
      this._options.push(args[0]);
      return this;
    }
    this._options.push(new Option(...args as ConstructorParameters<typeof Option>));
    return this;
  }
  subcommand(...args: ConstructorParameters<typeof Subcommand>): this
  subcommand(args: Subcommand): this
  subcommand(...args: any[]): this {
    if (args[0] instanceof Subcommand) {
      this._options.push(args[0]);
      return this;
    }
    this._options.push(new Subcommand(...args as ConstructorParameters<typeof Subcommand>));
    return this;
  }


  push(...args: Array<Option | Subcommand>): this {
    this._options.push(...args);
    return this;
  }
}
