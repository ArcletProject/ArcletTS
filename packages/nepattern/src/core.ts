import { MatchFailed, Empty, Constructor, isConstructor } from "./utils";

function _accept(
  input: any,
  patterns: Pattern<any>[] | null = null,
  types: string[] | null = null
): boolean {
  let res_p = patterns ? (patterns.filter((v) => { return v.exec(input).isSuccess() })).length > 0 : false;
  let res_t = types ? (types.filter((v) => { return input.constructor.name.toLowerCase() == v.toLowerCase() })).length > 0 : false
  return res_p || res_t
}

enum PatternMode {
  KEEP,
  REGEX_MATCH,
  TYPE_CONVERT,
  REGEX_CONVERT
}

enum ResultFlag {
  VALID = "valid",
  ERROR = "error",
  DEFAULT = "default"
}


class ValidateResult<TVOrigin> {
  private readonly _value?: TVOrigin;
  private readonly _error?: Error;
  public flag: ResultFlag;
  constructor(value: TVOrigin | Error, flag: ResultFlag) {
    if (value instanceof Error)
      this._error = value
    else
      this._value = value;
    this.flag = flag;
  }

  toString() {
    return `ValidateResult(${this.value}, ${this.flag})`
  }

  get value() {
    if (this.flag == ResultFlag.ERROR || this._value == undefined)
      throw new Error("cannot access value")
    return this._value
  }

  get error(): Error | null {
    if (this.flag == ResultFlag.ERROR && this._error != undefined) {
      return this._error;
    }
    return null;
  }

  isSuccess(): boolean {
    return this.flag === ResultFlag.VALID
  }

  isFailed(): boolean {
    return this.flag === ResultFlag.ERROR
  }

  orDefault(): boolean {
    return this.flag == ResultFlag.DEFAULT
  }

  step<T>(other: T | Constructor<T>): T;
  step<T>(other: (_: TVOrigin) => T): T | this;
  step<T>(other: Pattern<T>): ValidateResult<T | Error>;
  step(other: ((_: any) => any) | Constructor<any> | any): any {
    if (other == Boolean)
      return this.isSuccess();
    if (other instanceof Function && isConstructor(other) && this.isSuccess())
      return new other(this.value);
    if (other instanceof Function && this.isSuccess())
      return other(this.value)
    if (other instanceof Pattern && this.isSuccess())
      return other.exec(this.value);
    if (this.isSuccess()) {
      try {
        // @ts-ignore
        return this.value() | other;
      }
      catch (msg) {

      }
    }
    return this;
  }

  toBoolean() {
    return this.isSuccess();
  }
}

class Pattern<TOrigin, TSource = any> {
  regex: RegExp;
  pattern: string;
  mode: PatternMode;
  origin: Constructor<TOrigin>;
  converter: (self: this, value: any) => TOrigin | null;
  validators: Array<(res: TOrigin) => boolean>;

  anti: boolean;
  pattern_accepts: Pattern<any>[];
  type_accepts: string[];
  alias: string | null;
  readonly previous: Pattern<any> | null;

  constructor(
    origin: Constructor<TOrigin>,
    pattern: RegExp | string,
    mode: number | PatternMode = PatternMode.REGEX_MATCH,
    converter: ((self: Pattern<TOrigin, TSource>, value: any) => TOrigin | null) | null = null,
    alias: string | null = null,
    previous: Pattern<any> | null = null,
    accepts: Array<string | Pattern<any>> | null = null,
    validators: Array<(res: TOrigin) => boolean> | null = null,
    anti: boolean = false
  ) {
    if (pattern instanceof RegExp) {
      if (pattern.source.startsWith("^") || pattern.source.endsWith("$"))
        throw Error(`不允许正则表达式 ${pattern} 头尾部分使用 '^' 或 '$' `)
      this.pattern = pattern.source;
      this.regex = new RegExp(`^${pattern.source}$`, pattern.flags);
    } else {
      if (pattern.startsWith("^") || pattern.endsWith("$"))
        throw Error(`不允许正则表达式 ${pattern} 头尾部分使用 '^' 或 '$' `)
      this.pattern = pattern;
      this.regex = new RegExp(`^${pattern}$`);
    }
    this.mode = mode;
    this.origin = origin;
    this.alias = alias;
    this.previous = previous;
    let _accepts = accepts || [];
    //@ts-ignore
    this.pattern_accepts = _accepts.filter((v) => { return v instanceof Pattern });
    //@ts-ignore
    this.type_accepts = _accepts.filter((v) => { return !(v instanceof Pattern) });

    this.converter = converter || (
      (_, x) => { return mode == PatternMode.TYPE_CONVERT ? (new origin(x)) : eval(x) }
    );
    this.validators = validators || [];
    this.anti = anti;
  }

  acceptsRepr(): string {
    let type_strings = this.type_accepts.copyWithin(this.type_accepts.length, 0);
    let pat_strings = this.pattern_accepts.map((v) => { return v.toString() })
    type_strings.push(...pat_strings)
    return type_strings.join("|")
  }

  toString(): string {
    if (this.mode == PatternMode.KEEP) {
      return this.alias ? this.alias :
        this.type_accepts.length === 0 && this.pattern_accepts.length === 0 ? 'Any' :
          this.acceptsRepr();
    }
    let text: string
    if (this.alias)
      text = this.alias;
    else {
      if (this.mode == PatternMode.REGEX_MATCH) {
        text = this.pattern;
      }
      else if (
        this.mode == PatternMode.REGEX_CONVERT ||
        (this.type_accepts.length === 0 && this.pattern_accepts.length === 0)
      )
        text = this.origin.name;
      else
        text = this.acceptsRepr() + " -> " + this.origin.name;
    }
    return `${this.previous ? this.previous.toString() + ' -> ' : ''}${this.anti ? '!' : ''}${text}`
  }

  static of<T>(type: Constructor<T>): Pattern<T, T> {
    return new Pattern<T, T>(
      type,
      "",
      PatternMode.KEEP,
      (_, x) => { return new type(x) },
      type.name,
      null,
      [type.name]
    )
  }

  static on<T>(obj: T): Pattern<T, T> {
    return new Pattern<T, T>(
      (<any>obj).constructor,
      "",
      PatternMode.KEEP,
      (_, x) => { return eval(x) },
      String(obj),
      null, null,
      [(x) => { return x === obj }]
    )
  }

  reverse(): this {
    this.anti = !this.anti
    return this
  }

  match(input: TSource): TOrigin {
    if (this.mode > 0 && this.origin.name != "String" && (<any>input).constructor == this.origin)
      //@ts-ignore
      return input
    if (
      (this.type_accepts.length > 0 || this.pattern_accepts.length > 0)
      && !_accept(input, this.pattern_accepts, this.type_accepts)
    ) {
      if (this.previous == null)
        throw new MatchFailed(`参数 ${input} 的类型不正确`)
      input = this.previous.match(input)
      if (!_accept(input, this.pattern_accepts, this.type_accepts))
        throw new MatchFailed(`参数 ${input} 的类型不正确`)
    }
    if (this.mode == PatternMode.KEEP)
      return <TOrigin><unknown>input;
    if (this.mode == PatternMode.TYPE_CONVERT) {
      let res = this.converter(this, input);
      if (res == null || (<any>res).constructor !== this.origin) {
        if (this.previous == null)
          throw new MatchFailed(`参数 ${input} 不正确`)
        res = this.converter(this, this.previous.match(input))
        if ((<any>res).constructor !== this.origin)
          throw new MatchFailed(`参数 ${input} 不正确`)
      }
      return res as TOrigin;
    }
    if (!(typeof input == "string")) {
      if (this.previous == null)
        throw new MatchFailed(`参数 ${input} 的类型不正确`)
      input = this.previous.match(input)
      if (!(typeof input == "string"))
        throw new MatchFailed(`参数 ${input} 的类型不正确`)
    }
    let mat = (<string>input).match(this.regex)
    if (mat != null) {
      // @ts-ignore
      return (
        this.mode == PatternMode.REGEX_CONVERT ? this.converter(this, mat.length < 2 ? mat[0] : mat.slice(1)) :
          mat.length < 2 ? mat[0] : mat[1]
      )
    }
    throw new MatchFailed(`参数 ${input} 不正确`)
  }

  validate(input: any): ValidateResult<TOrigin>
  validate<TD>(input: any, _default: TD): ValidateResult<TOrigin | TD>
  validate(input: any, _default: any = null): ValidateResult<any> {
    try {
      let res = this.match(input)
      for (let val of this.validators) {
        if (!val(res))
          throw new MatchFailed(`参数 ${input} 不正确`)
      }
      return new ValidateResult(res, ResultFlag.VALID)
    }
    catch (e) {
      if (!_default)
        // @ts-ignore
        return new ValidateResult(<Error>e, ResultFlag.ERROR)
      // @ts-ignore
      return new ValidateResult(
        // @ts-ignore
        _default === Empty ? null : _default, ResultFlag.DEFAULT
      )
    }
  }
  invalidate<TI>(input: TI): ValidateResult<TI>
  invalidate<TI, TD>(input: TI, _default: TD): ValidateResult<TD | TI>
  invalidate(input: any, _default: any = null): ValidateResult<any> {
    let res: any
    try {
      res = this.match(input)
    } catch (e) {
      return new ValidateResult(input, ResultFlag.VALID)
    }
    for (let val of this.validators) {
      if (!val(res))
        return new ValidateResult(input, ResultFlag.VALID)
    }
    if (!_default) {
      // @ts-ignore
      return new ValidateResult(
        new MatchFailed(`参数 ${input} 不正确`),
        ResultFlag.ERROR
      )
    }
    // @ts-ignore
    return new ValidateResult(
      // @ts-ignore
      _default === Empty ? null : _default, ResultFlag.DEFAULT
    )
  }

  exec<TI>(input: TI): ValidateResult<TOrigin>
  exec<TI, TD>(input: TI, _default: TD): ValidateResult<TOrigin | TD>
  exec(input: any, _default?: any) {
    return this.anti ? this.invalidate(input, _default) : this.validate(input, _default)
  }

  with(name: string): this {
    this.alias = name;
    return this
  }
}

export { PatternMode, Pattern, ValidateResult }

