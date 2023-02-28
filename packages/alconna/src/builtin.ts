import { Action } from "./base";
import { ParseResult,Behavior } from "./result";
import { BehaveCancelled } from "./errors";
import { OptionResult, SubcommandResult } from "./model";

const MISSING = Symbol("missing");

class StoreValue extends Action {
  constructor(value: any) {
    super(() => value)
  }
}

export function storeValue(value: any) {
  return new StoreValue(value)
}

export const storeTrue = new StoreValue(true)
export const storeFalse = new StoreValue(false)

class SetDefault extends Behavior {
  constructor(
    public default_: any = MISSING,
    public defaultFn: (() => any) | typeof MISSING = MISSING,
    public arg: string | null = null,
    public option: string | null = null,
    public subcommand: string | null = null,
  ) {
    super();
    this.default_ = default_;
    this.defaultFn = defaultFn;
    this.arg = arg;
    this.option = option;
    this.subcommand = subcommand;
  }

  get defaultVal() {
    if (this.default_ !== MISSING) {
      return this.default_;
    } else if (this.defaultFn !== MISSING) {
      return this.defaultFn();
    } else {
      throw new Error("Cannot specify both default and defaultFn");
    }
  }


  execute(result: ParseResult<any>) {
    if (!this.option && !this.subcommand) {
      throw new BehaveCancelled("Cannot set default value for args")
    }
    if (this.arg && !result.otherArgs.has(this.arg)) {
      this.update(result, `otherArgs.${this.arg}`, this.defaultVal)
    }
    if (this.option && !this.subcommand) {
      if (!result.query(`options.${this.option}`)) {
        this.update(
          result,
          `options.${this.option}`,
          this.arg ? new OptionResult(
            null,
            new Map([[this.arg, this.defaultVal]])
            ) : new OptionResult(this.defaultVal, null)
          )
      } else if (this.arg && !result.query(`options.${this.option}.${this.arg}`)) {
        this.update(
          result,
          `options.${this.option}.${this.arg}`,
          this.defaultVal
        )
      }
    }
    if (this.subcommand && !this.option) {
      if (!result.query(`subcommands.${this.subcommand}`)) {
        this.update(
          result,
          `subcommands.${this.subcommand}`,
          this.arg ? new SubcommandResult(
            null,
            new Map([[this.arg, this.defaultVal]])
          ) : new SubcommandResult(this.defaultVal, null)
        )
      } else if (this.arg && !result.query(`subcommands.${this.subcommand}.${this.arg}`)) {
        this.update(
          result,
          `subcommands.${this.subcommand}.${this.arg}`,
          this.defaultVal
        )
      }
    }
    if (this.option && this.subcommand) {
      if (!result.query(`subcommands.${this.subcommand}.options.${this.option}`)) {
        this.update(
          result,
          `subcommands.${this.subcommand}.options.${this.option}`,
          this.arg ? new OptionResult(
            null,
            new Map([[this.arg, this.defaultVal]])
          ) : new OptionResult(this.defaultVal, null)
        )
      } else if (this.arg && !result.query(`subcommands.${this.subcommand}.options.${this.option}.${this.arg}`)) {
        this.update(
          result,
          `subcommands.${this.subcommand}.options.${this.option}.${this.arg}`,
          this.defaultVal
        )
      }
    }
  }
}

export function setDefault(value: any, arg: string | null, option: string | null, subcommand: string | null): SetDefault;
export function setDefault(fn: () => any, arg: string | null, option: string | null, subcommand: string | null): SetDefault;
export function setDefault(value: any | (() => any) = MISSING, arg: string | null = null, option: string | null = null, subcommand: string | null = null): SetDefault {
  if (value == MISSING) {
    throw new Error("Must specify a default value or default function");
  }
  if (typeof value === "function") {
    return new SetDefault(MISSING, value, arg, option, subcommand);
  }
  return new SetDefault(value, MISSING, arg, option, subcommand);
}
