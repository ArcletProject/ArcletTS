import { Empty, Dict } from "@arcletjs/nepattern";
import { DataCollection } from "./typing";
import { config } from "./config";
import { manager } from "./manager";
import { SubcommandResult, OptionResult, HeadResult } from "./model";
import { BehaveCancelled, OutBoundsBehave } from "./errors";

export class ParseResult<T extends DataCollection<any>> {
  mainArgs: Map<string, any>;
  otherArgs: Map<string, any>;
  options: Map<string, OptionResult>;
  subcommands: Map<string, SubcommandResult>;
  head: HeadResult;

  constructor(
    private _source: string,
    public origin: T,
    public matched: boolean = false,
    head: HeadResult | null = null,
    public error_info: Error | string = "",
    public error_data: any[] | null = null,
  ) {
    this._source = _source;
    this.origin = origin;
    this.matched = matched;
    this.head = head || new HeadResult();
    this.error_info = error_info;
    this.error_data = error_data;
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
}
