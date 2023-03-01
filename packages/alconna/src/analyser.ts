import { Pattern, Constructor } from "@arcletjs/nepattern";
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
import { handleHelp, handleShortcut } from "./handlers";

export class SubAnalyser<T extends DataCollectionContainer = DataCollectionContainer> {
  command: Subcommand;
  container: T;

  fuzzyMatch: boolean;
  defaultMainOnly: boolean;
  partLength: number;
  needMainArgs: boolean;

  compileParams: Map<string, Sentence|Option[]|SubAnalyser<T>>;
  selfArgs: Args;
  subcommandResults: Map<string, SubcommandResult>;
  optionResults: Map<string, OptionResult>;
  argsResult: Map<string, any>;
  headResult: [any, any, boolean, object];
  valueResult: any;
  sentences: string[]

  special: Map<string, (...args: any[]) => any>;
  completionNames: string[];

  constructor(
    command: Subcommand,
    container: T,
    namespace: Namespace,
    fuzzyMatch: boolean = false,
    defaultMainOnly: boolean = false,
    partLength: number = 0,
    needMainArgs: boolean = false,
    compileParams: Map<string, Sentence|Option[]|SubAnalyser<T>> = new Map(),
  ) {
    this.command = command;
    this.container = container;
    this.fuzzyMatch = fuzzyMatch;
    this.defaultMainOnly = defaultMainOnly;
    this.partLength = partLength;
    this.needMainArgs = needMainArgs;
    this.compileParams = compileParams;

    [this.argsResult, this.optionResults, this.subcommandResults] = [new Map(), new Map(), new Map()];
    [this.sentences, this.valueResult, this.headResult] = [[], null, [null, null, false, {}]];
    this.container.reset();
    this.special = new Map()
    for (let key of namespace.optionName.help) {
      this.special.set(key, handleHelp);
    }
    for (let key of namespace.optionName.completion) {
      //this.special.set(key, handleCompletion);
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
    [this.sentences, this.valueResult, this.headResult] = [[], null, [null, null, false, {}]];
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
}


export class Analyser<TC extends DataCollectionContainer = DataCollectionContainer, TD extends DataCollection<any> = DataCollection<any>> extends SubAnalyser<TC> {
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
      new Map(), "text", command.separators, [], true, !command._meta.keepCRLF, command.nsConfig.enableMessageCache,
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
}


import { Command } from "./core";
