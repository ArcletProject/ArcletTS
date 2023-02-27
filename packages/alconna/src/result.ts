import { Empty, Dict } from "@arcletjs/nepattern";
import { DataCollection } from "./typing";
import { config } from "./config";
import { SubcommandResult, OptionResult, HeadResult } from "./model";
import { BehaveCancelled, OutBoundsBehave } from "./errors";

function handleOpt(
  prefix: string,
  parts: string[],
  opts: Map<string, OptionResult>
): [Map<string, any> | OptionResult, string] {
  if (prefix === "options") {
    prefix = parts[0];
    parts = parts.slice(1);
  }
  if (parts.length === 0) {
    return [opts, prefix];
  }
  let src = opts.get(prefix);
  if (!src) {
    return [opts, prefix];
  }
  let end = parts[0];
  parts = parts.slice(1);
  if (end === "value") {
    return [src, end];
  }
  if (end === "args"){
    return parts.length > 0 ? [src.args, parts[0]] : [src, end];
  }
  return [src.args, end];
}

function handleSub(
  prefix: string,
  parts: string[],
  subs: Map<string, SubcommandResult>
): [Map<string, any> | OptionResult | SubcommandResult, string] {
  if (prefix === "subcommands") {
    prefix = parts[0];
    parts = parts.slice(1);
  }
  if (parts.length === 0) {
    return [subs, prefix];
  }
  let src = subs.get(prefix);
  if (!src) {
    return [subs, prefix];
  }
  let end = parts[0];
  parts = parts.slice(1);
  if (end === "args") {
    return parts.length > 0 ? [src.args, parts[0]] : [src, end];
  }
  if (end === "options" && (src.options.has(end) || parts.length < 1)) {
    throw new Error(config.lang.replaceKeys("arpamar.ambiguous_name", {target: `${prefix}.${end}`}))
  }
  if (end === "options" || src.options.has(end)) {
    return handleOpt(end, parts, src.options);
  }
  if (end === "subcommands" && (src.subcommands.has(end) || parts.length < 1)) {
    throw new Error(config.lang.replaceKeys("arpamar.ambiguous_name", {target: `${prefix}.${end}`}))
  }
  if (end === "subcommands" || src.subcommands.has(end)) {
    return handleSub(end, parts, src.subcommands);
  }
  return [src.args, end];
}


export class ParseResult<T extends DataCollection<any>> {
  mainArgs: Map<string, any>;
  otherArgs: Map<string, any>;
  options: Map<string, OptionResult>;
  subcommands: Map<string, SubcommandResult>;
  head: HeadResult;

  constructor(
    private readonly _source: string,
    public origin: T,
    public matched: boolean = false,
    head: HeadResult | null = null,
    public errorInfo: Error | string = "",
    public errorData: any[] | null = null,
  ) {
    this._source = _source;
    this.origin = origin;
    this.matched = matched;
    this.head = head || new HeadResult();
    this.errorInfo = errorInfo;
    this.errorData = errorData;
    this.mainArgs = new Map();
    this.otherArgs = new Map();
    this.options = new Map();
    this.subcommands = new Map();
  }

  clear() {
    this.mainArgs.clear();
    this.otherArgs.clear();
    this.options.clear();
    this.subcommands.clear();
  }

  get source() {
    return manager.get(this._source);
  }

  get header() {
    return this.head.groups;
  }

  get head_matched() {
    return this.head.matched;
  }

  get head_result() {
    return this.head.result;
  }

  get emptyComponent() {
    return this.options.size === 0 && this.subcommands.size === 0;
  }

  get component() {
    let res = new Map<string, SubcommandResult | OptionResult>();
    for (let [key, value] of this.options) {
      res.set(key, value);
    }
    for (let [key, value] of this.subcommands) {
      res.set(key, value);
    }
    return res;
  }

  get allArgs() {
    let res = new Map<string, any>();
    for (let [key, value] of this.mainArgs) {
      res.set(key, value);
    }
    for (let [key, value] of this.otherArgs) {
      res.set(key, value);
    }
    return res;
  }

  get token() {
    return manager.getToken(this)
  }

  private unpackOpts(data: Map<string, OptionResult>) {
    for (let value of data.values()) {
      value.args.forEach((v, k) => {
        this.otherArgs.set(k, v);
      });
    }
  }

  private unpackSubs(data: Map<string, SubcommandResult>) {
    for (let value of data.values()) {
      value.args.forEach((v, k) => {
        this.otherArgs.set(k, v);
      });
      if (value.options.size > 0) {
        this.unpackOpts(value.options);
      }
      if (value.subcommands.size > 0) {
        this.unpackSubs(value.subcommands);
      }
    }
  }

  encapsulate(
    mainArgs: Map<string, any>,
    options: Dict<OptionResult>,
    subcommands: Dict<SubcommandResult>,
  ) {
    this.mainArgs = new Map(mainArgs);
    this.options = new Map(Object.entries(options));
    this.subcommands = new Map(Object.entries(subcommands));
    this.unpackOpts(this.options);
    this.unpackSubs(this.subcommands);
  }

  static behaveCancelled() {
    throw new BehaveCancelled("cancelled");
  }

  static outBoundsBehave() {
    throw new OutBoundsBehave("out bounds");
  }

  execute(behaviors: Behavior[] = []): this {
    let data = this.source._behaviors.slice(1);
    data.push(...behaviors);
    if (data.length < 1) {
      return this;
    }
    let excs: Behavior[] = [];
    for (let behavior of data) {
      excs.push(...requirementHandler(behavior));
    }
    for (let behavior of excs) {
      behavior.beforeExecute(this);
    }
    for (let behavior of excs) {
      try {
        behavior.execute(this);
      } catch (e) {
        if (e instanceof BehaveCancelled) {
          continue;
        } else if (e instanceof OutBoundsBehave) {
          //@ts-ignore
          return this.fail(e);
        } else {
          throw e;
        }
      }
    }
    return this;
  }

  fail(errorInfo: Error | string) {
    return new ParseResult(this._source, this.origin, false, this.head, errorInfo);
  }

  require(parts: string[]): [Map<string, any> | OptionResult | SubcommandResult | null, string] {
    if (parts.length === 1) {
      let prefix = parts[0];
      for (let src of [this.mainArgs, this.otherArgs, this.options, this.subcommands]) {
        if (src.has(prefix)) {
          return [src, prefix];
        }
      }
      if (["options", "subcommands", "mainArgs", "otherArgs"].includes(prefix)) {
        return [this[prefix], ""];
      }
      return prefix === "args" ? [this.allArgs, ""] : [null, prefix];
    }
    let [prefix, ...rest] = parts;
    if (["options", "subcommands"].includes(prefix) && this.component.has(prefix)) {
      throw new Error(config.lang.replaceKeys("arpamar.ambiguous_name", {target: prefix}));
    }
    if (prefix === "options" || this.options.has(prefix)) {
      return handleOpt(prefix, rest, this.options);
    }
    if (prefix === "subcommands" || this.subcommands.has(prefix)) {
      return handleSub(prefix, rest, this.subcommands);
    }
    prefix = prefix.replace(/\$main/g, "mainArgs").replace(/\$other/g, "otherArgs");
    if (["mainArgs", "otherArgs"].includes(prefix)) {
      return [this[prefix], rest[0]];
    }
    return [null, prefix];
  }

  query(path: string): Map<string, any> | any | null;
  query<T>(path: string, defaultValue: T): Map<string, any> | any | T;
  query(path: string, defaultValue: any = null) {
    let [src, end] = this.require(path.split("."));
    if (src === null) {
      return defaultValue;
    }
    if (src instanceof OptionResult || src instanceof SubcommandResult) {
      return end && end !== "" ? src[end] || defaultValue : src
    }
    return end && end !== "" ? src.get(end) || defaultValue : new Map(src);
  }

  find(path: string): boolean {
    return this.query(path, Empty) !== Empty;
  }
}


export abstract class Behavior {
  private record: Map<number, Map<string, [any, any]>>
  protected constructor(
    public requires: Behavior[] = [],
  ) {
    this.record = new Map();
    this.requires = requires;
  }

  beforeExecute(result: ParseResult<any>) {
    if (this.record.size < 1) {
      return;
    }
    if (!this.record.has(result.token)) {
      return;
    }
    let _record = this.record.get(result.token)!;
    for (let [key, value] of _record) {
      let [past, current] = value;
      let [src, end] = result.require(key.split("."));
      if (src === null) {
        continue;
      }
      if (src instanceof Map) {
        if (past !== Empty) {
          src.set(end, past);
        } else if ((src.get(end) || Empty) !== current) {
          src.delete(end);
        }
      } else if (past !== Empty) {
        src[end] = past;
      } else if ((src[end] || Empty) !== current) {
        delete src[end];
      }
    }
    _record.clear();
  }

  abstract execute(result: ParseResult<any>): any;

  private _update(token: number, src: any, path: string, end: string, value: any) {
    if (!this.record.has(token)) {
      this.record.set(token, new Map());
    }
    let _record = this.record.get(token)!;
    _record[path] = [src[end], value];
    src[end] = value;
  }

  update(result: ParseResult<any>, path: string, value: any) {
    let [src, end] = result.require(path.split("."));
    if (src === null) {
      return;
    }
    if (end && end !== "") {
      this._update(result.token, src, path, end, value);
    } else if (src instanceof Map) {
      for (let [key, value] of src) {
        this._update(result.token, src, path, `${path}.${key}`, value);
      }
    }
  }
}

function requirementHandler(behavior: Behavior) {
  let res: Behavior[] = [];
  for (let value of behavior.requires) {
    res.push(...requirementHandler(value));
  }
  res.push(behavior);
  return res;
}

import { manager } from "./manager";
