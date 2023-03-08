import { Pattern, Constructor, Ellipsis } from "@arcletjs/nepattern";
import { manager, ShortcutArgs } from "./manager";
import { ParamsUnmatched, ArgumentMissing, FuzzyMatchSuccess, PauseTriggered, SpecialOptionTriggered, NullMessage } from "./errors";
import { Args } from "./args";
import { handleHeader, Pair, Double } from "./header";
import { Option, Subcommand } from "./base";
import { Sentence, OptionResult, SubcommandResult, HeadResult} from "./model";
import { ParseResult } from "./result";
import { DataCollection } from "./typing";
import { config, Namespace } from "./config";
import { outputManager } from "./output";
import { DataCollectionContainer } from "./container";
import { analyseArgs, analyseParam, analyseHeader, handleHelp, handleShortcut, handleCompletion } from "./handlers";

function compileOpts(option: Option, data: Map<string, Sentence|Option[]|SubAnalyser<any>>) {
  for (let alias of option.aliases) {
    let li = data.get(alias);
    if (li && li instanceof Array) {
      li.push(option);
      // sort by priority, less priority first
      li.sort((a, b) => a._priority - b._priority);
    } else {
      data.set(alias, [option]);
    }
  }
}

export function defaultCompiler(analyser: SubAnalyser, ns: Namespace) {
  let requireLength = 0;
  for (let opts of analyser.command._options) {
    if (opts instanceof Option) {
      compileOpts(opts, analyser.compileParams);
      opts.aliases.forEach(alias => {analyser.container.paramIds.add(alias);});
    } else if (opts instanceof Subcommand) {
      let sub = new SubAnalyser(opts, analyser.container, ns, analyser.fuzzyMatch);
      analyser.compileParams.set(opts.name, sub);
      analyser.container.paramIds.add(opts.name);
      defaultCompiler(sub, ns);
    }
    let separatorSet = new Set(analyser.container.separators);
    if (opts.separators.some(s => !separatorSet.has(s))) {
      analyser.container.defaultSeparate = false;
    }
    if (opts.requires.length > 0) {
      opts.requires.forEach(r => { analyser.container.paramIds.add(r); });
      requireLength = Math.max(requireLength, opts.requires.length);
      for (let k of opts.requires) {
        if (!analyser.compileParams.has(k)) {
          analyser.compileParams.set(k, new Sentence(k));
        }
      }
    }
  }
  analyser.partLength = requireLength + analyser.command._options.length + (analyser.needMainArgs ? 1 : 0);
}




export class SubAnalyser<TC extends DataCollectionContainer = DataCollectionContainer> {
  command: Subcommand;
  container: TC;

  fuzzyMatch: boolean;
  defaultMainOnly: boolean;
  partLength: number;
  needMainArgs: boolean;

  compileParams: Map<string, Sentence|Option[]|SubAnalyser<TC>>;
  selfArgs: Args;
  subcommandResults: Map<string, SubcommandResult>;
  optionResults: Map<string, OptionResult>;
  argsResult: Map<string, any>;
  headResult: HeadResult | null;
  valueResult: any;
  sentences: string[]

  special: Map<string, (...args: any[]) => any>;
  completionNames: string[];

  constructor(
    command: Subcommand,
    container: TC,
    namespace: Namespace,
    fuzzyMatch: boolean = false,
    defaultMainOnly: boolean = false,
    partLength: number = 0,
    needMainArgs: boolean = false,
    compileParams: Map<string, Sentence|Option[]|SubAnalyser<TC>> = new Map(),
  ) {
    this.command = command;
    this.container = container;
    this.fuzzyMatch = fuzzyMatch;
    this.defaultMainOnly = defaultMainOnly;
    this.partLength = partLength;
    this.needMainArgs = needMainArgs;
    this.compileParams = compileParams;

    [this.argsResult, this.optionResults, this.subcommandResults] = [new Map(), new Map(), new Map()];
    [this.sentences, this.valueResult, this.headResult] = [[], null, null];
    this.container.reset();
    this.special = new Map()
    for (let key of namespace.optionName.help) {
      this.special.set(key, handleHelp);
    }
    for (let key of namespace.optionName.completion) {
      this.special.set(key, handleCompletion);
    }
    for (let key of namespace.optionName.shortcut) {
      this.special.set(key, handleShortcut);
    }
    this.completionNames = namespace.optionName.completion;
    this.selfArgs = this.command.args;
    this.handleArgs();
  }

  export(): SubcommandResult {
    let res = new SubcommandResult(
      this.valueResult,
      new Map(this.argsResult),
      new Map(this.optionResults),
      new Map(this.subcommandResults),
    )
    this.reset();
    return res;
  }

  reset() {
    [this.argsResult, this.optionResults, this.subcommandResults] = [new Map(), new Map(), new Map()];
    [this.sentences, this.valueResult, this.headResult] = [[], null, null];
  }

  private handleArgs() {
    if (this.command.nargs > 0 && this.command.nargs > this.selfArgs.optionalCount)
    {
      this.needMainArgs = true;
    }
    let defCount = 0
    for (let arg of this.selfArgs.argument) {
      if (arg.field.defaultGetter !== null) {
        defCount++;
      }
    }
    if (defCount > 0 && defCount === this.command.nargs) {
      this.defaultMainOnly = true;
    }
  }

  process(): this {
    let param = this.command;
    this.container.context = param;
    if (param.requires.length > 0 && !param.requires.every(r => this.sentences.includes(r))) {
      throw new ParamsUnmatched(`${param.name}'s requires not satisfied ${this.sentences.join(" ")}`)
    }
    this.sentences = [];
    if (param.isCompact) {
      let [name, _] = this.container.popitem();
      if (!name.startsWith(param.name)) {
        throw new ParamsUnmatched(`${name} does not match with ${param.name}`)
      }
      this.container.pushback(name.replace(param.name, ""), true);
    } else {
      let [name, _] = this.container.popitem(param.separators);
      if (name !== param.name) {
        throw new ParamsUnmatched(`${name} does not match with ${param.name}`)
      }
    }
    if (this.partLength < 1) {
      this.valueResult = Ellipsis;
      return this;
    }
    return this.analyse();
  }

  analyse(): this {
    for (let i = 0; i < this.partLength; i++) {
      analyseParam(this, ...this.container.popitem(this.command.separators, false))
    }
    if (this.defaultMainOnly && this.argsResult.size === 0) {
      this.argsResult = analyseArgs(this, this.selfArgs, this.command.nargs)
    }
    if (this.argsResult.size == 0 && this.needMainArgs) {
      throw new ArgumentMissing(config.lang.replaceKeys("subcommand.args_missing", {name: this.command._dest}))
    }
    return this;
  }

  getSubAnalyser(subcommand: Subcommand): SubAnalyser<TC> | undefined {
    if (subcommand === this.command) {
      return this;
    }
    for (let sub of this.subcommandResults.values()) {
      if (sub instanceof SubAnalyser) {
        return sub.getSubAnalyser(subcommand);
      }
    }
  }
}


export class Analyser<TC extends DataCollectionContainer = DataCollectionContainer, TD extends DataCollection = TDC<TC>> extends SubAnalyser<TC> {
  //@ts-ignore
  command: Command;
  usedTokens: Set<number>;
  commandHeader: RegExp | Pattern<any> | Pair[] | Double;
  private static globalContainerType: Constructor<DataCollectionContainer> = DataCollectionContainer;

  static defaultContainer<_TC extends DataCollectionContainer = DataCollectionContainer>(t: Constructor<_TC>): typeof Analyser<_TC> {
    Analyser.globalContainerType = t;
    return Analyser;
  }

  constructor(
    command: Command,
    containerType: Constructor<TC> | null = null
  ) {
    let construct = containerType || Analyser.globalContainerType;
    super(
      command,
      new construct(
      new Map(), command.nsConfig.toText, command.separators, [], true, !command._meta.keepCRLF, command.nsConfig.enableMessageCache,
      ),
      command.nsConfig
    )
    this.command = command;
    this.fuzzyMatch = command._meta.fuzzyMatch;
    this.usedTokens = new Set();
    this.commandHeader = handleHeader(command.command, command.headers)
  }

  converter(command: string): TD {
    return <TD><unknown>command
  }

  toString() {
    return `<${this.constructor.name} of ${this.command.path}>`
  }

  static compile<TA extends Analyser>(
    command: Command<TA>,
    compiler: (analyser: SubAnalyser, ns: Namespace) => void = defaultCompiler
  ): TA {
    let analyser = new command.analyserType(command);
    compiler(analyser, command.nsConfig);
    return analyser;
  }

  shortcut(data: any[], short: ParseResult<TD> | ShortcutArgs, reg: RegExpMatchArray | null): ParseResult<TD> {
    if (short instanceof ParseResult) {
      return short;
    }
    this.container.build(short.command!)
    let dataIndex = 0;
    for (let i = 0; i < this.container.rawData.length; i++) {
      if (data.length < 1) {
        break;
      }
      let unit = this.container.rawData[i];
      if (typeof unit === "string" && unit.includes(`{%${dataIndex}}`)) {
        this.container.rawData[i] = unit.replace(`{%${dataIndex}}`, `${data.shift()!}`);
        dataIndex++;
      } else if (unit === `{%${dataIndex}}`) {
        this.container.rawData[i] = data.shift()!;
        dataIndex++;
      }
    }
    this.container.bakData = Array.from(this.container.rawData);
    this.container.rebuild(...data).rebuild(...short.args || [])
    if (reg) {
      let groups = Array.from(reg).slice(1);
      let gdict = Object.assign({}, reg.groups || {});
      for (let i = 0; i < this.container.rawData.length; i++) {
        let unit = this.container.rawData[i];
        if (typeof unit === "string") {
          for (let j = 0; j < groups.length; j++) {
            unit = unit.replace(`{${j}}`, `${groups[j]}`);
          }
          for (let key in gdict) {
            unit = unit.replace(`{${key}}`, `${gdict[key]}`);
          }
          this.container.rawData[i] = unit;
        }
      }
    }
    if (this.container.cacheMessage) {
      this.container.tempToken = this.container.generateToken(this.container.rawData)
    }
    return this.process(null, false);
  }

  process(): this;
  process(message: TD | null, interrupt: boolean): ParseResult<TD>;
  process(message: TD | null = null, interrupt: boolean = false): ParseResult<TD> | this {
    if (manager.isDisabled(this.command)) {
      return this.export(null, true)
    }
    if (this.container.nData == 0) {
      if (!message) {
        throw new NullMessage(config.lang.replaceKeys("analyser.handle_null_message", {target: message}))
      }
      try {
        this.container.build(message)
      } catch (e) {
        return this.export(e as Error, true)
      }
    }
    if (this.container.cacheMessage && this.usedTokens.has(this.container.tempToken)) {
      let res = manager.getRecord(this.container.tempToken)
      if (res) {
        return res as ParseResult<TD>;
      }
    }
    try {
      this.headResult = analyseHeader(this);
    } catch(e) {
      if (e instanceof FuzzyMatchSuccess) {
        outputManager.send(this.command.name, () => (e as FuzzyMatchSuccess).message);
        return this.export(null, true);
      }
      if (e instanceof ParamsUnmatched) {
        this.container.rawData = Array.from(this.container.bakData);
        this.container.currentIndex = 0;
        let res: [ParseResult<TD>, RegExpMatchArray | null]
        try {
          //@ts-ignore
          res = manager.findShortcut(this.command, this.container.popitem(null, false)[0])
        } catch(e) {
          if (this.command._meta.throwError) {
            throw e;
          }
          return this.export(e as Error, true);
        }
        this.container.popitem();
        let data = this.container.release();
        this.reset();
        this.container.reset();
        return this.shortcut(data, ...res);
      }
      throw e;
    }

    let fail = this.analyse(interrupt);
    if (fail) {
      return fail;
    }
    if (this.container.done && (!this.needMainArgs || this.argsResult.size > 0)) {
      return this.export(null, false);
    }
    let rest = this.container.release();
    let err: Error
    if (rest.length > 0) {
      if (typeof rest.at(-1) == "string" && this.completionNames.includes(rest.at(-1)!)) {
        return handleCompletion(this, rest.at(-2)!) as ParseResult<TD>;
      }
      err = new ParamsUnmatched(config.lang.replaceKeys("analyser.param_unmatched", {target: this.container.popitem(null, false)[0]}))
    } else {
      err = new ArgumentMissing(config.lang.require("analyser.param_missing"))
    }
    if (interrupt && err instanceof ArgumentMissing) {
      throw new PauseTriggered(this);
    }
    if (this.command._meta.throwError) {
      throw err;
    }
    return this.export(err, true);
  }

  analyse(): this;
  analyse(interrupt: boolean): ParseResult<TD> | null;
  analyse(interrupt: boolean = false): ParseResult<TD> | null | this {
    for(let i = 0; i < this.partLength; i++) {
      try {
        analyseParam(this, ...this.container.popitem(null, false));
      } catch(e) {
        if (e instanceof FuzzyMatchSuccess) {
          outputManager.send(this.command.name, () => (e as FuzzyMatchSuccess).message);
          return this.export(null, true);
        }
        if (e instanceof SpecialOptionTriggered) {
          return e.handler(this)
        }
        if (e instanceof ParamsUnmatched || e instanceof ArgumentMissing) {
          let rest = this.container.release();
          if (rest.length > 0 && typeof rest.at(-1) == "string") {
            if (this.completionNames.includes(rest.at(-1)!)) {
              return handleCompletion(this) as ParseResult<TD>;
            }
            if (this.special.has(rest.at(-1))){
              return this.special.get(rest.at(-1))!(this)
            }
          }
          if (interrupt && e instanceof ArgumentMissing) {
            throw new PauseTriggered(this);
          }
          if (this.command._meta.throwError) {
            throw e;
          }
          return this.export(e as Error, true);
        }
      }
      if (this.container.done){
        break;
      }
    }
    if (this.defaultMainOnly && this.argsResult.size < 1) {
      this.argsResult = analyseArgs(this, this.selfArgs, this.command.nargs)
    }
    return null;
  }

  export(): SubcommandResult;
  export(error: Error | null, fail: boolean): ParseResult<TD>;
  export(error: Error | null = null, fail: boolean = false): ParseResult<TD> | SubcommandResult {
    let result = new ParseResult<TD>(this.command.path, this.container.origin as TD, !fail, this.headResult);
    if (fail) {
      result.errorInfo = `${error}`
      result.errorData = this.container.release()
    } else {
      result.encapsulate(this.argsResult, this.optionResults, this.subcommandResults);
      if (this.container.cacheMessage) {
        manager.record(this.container.tempToken, result)
        this.usedTokens.add(this.container.tempToken);
      }
    }
    this.reset();
    return result;
  }

}

export type TDC<DCC> = DCC extends DataCollectionContainer<infer T> ? T : never
export type TADC<TA> = TA extends Analyser<DataCollectionContainer<infer T>> ? T : never;

import { Command } from "./core";
