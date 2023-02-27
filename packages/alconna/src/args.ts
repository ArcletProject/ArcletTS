import {Pattern, AllParam, Empty, parser, Union, ANY} from "@arcletjs/nepattern";
import {InvalidParam} from "./errors";
import {KeyWordVar, MultiVar} from "./typing";
import {config} from "./config";

export enum ArgFlag {
  OPTIONAL = "?",
  HIDDEN = "/",
  ANTI = "!"
}

export class Field<T> {
  constructor(
    public default_: T = null as any,
    public defaultGetter: (() => T) | null = null,
    public alias: string | null = null,
    public completion: (() => string | string[]) | null = null,
  ) {
    this.default_ = default_;
    this.defaultGetter = defaultGetter;
    this.alias = alias;
    this.completion = completion;
  }

  toString(): string {
    return `Field(${this.default_}, ${this.defaultGetter}, ${this.alias}, ${this.completion})`;
  }

  get default(): T {
    return this.defaultGetter ? this.defaultGetter() : this.default_;
  }

  get display(): any {
    return this.alias || this.default;
  }
}

type TAValue = string | number | boolean | object | Pattern<any> | typeof AllParam;

export class Arg<T> {
  public name: string;
  public value: TAValue;
  public field: Field<T>;
  public notice: string | null = null;
  public flag: ArgFlag[];
  public separators: string[];

  constructor(
    name: string,
    value: TAValue | null = null,
    field: Field<T> | T | null = null,
    seps: string | Iterable<string> = " ",
    notice: string | null = null,
    flags: ArgFlag[] = [],
  ) {
    if (name.startsWith("$")) {
      throw new InvalidParam(config.lang.require("args.name_error"));
    }
    if (name.trim() == "") {
      throw new InvalidParam(config.lang.require("args.name_empty"));
    }
    this.name = name;
    let _value = parser(value || name);
    let _default = field instanceof Field ? field : new Field(field as T);
    if (_value instanceof Union && _value.optional) {
      //@ts-ignore
      _default.default_ = _default.default_ === null ? Empty : _default.default_;
    }
    if (<string><unknown>_default.default_ === "...") {
      //@ts-ignore
      _default.default_ = Empty;
    }
    //@ts-ignore
    if (_value === Empty) {
      throw new InvalidParam(config.lang.replaceKeys("args.value_error", {target: name}));
    }
    this.value = _value;
    this.field = _default;
    this.notice = notice;
    this.separators = typeof seps === "string" ? [seps] : Array.from(seps);
    let _flags = flags || [];
    let mat1 = name.match("^.+?#([^;?!/#]+)");
    if (mat1) {
      this.notice = mat1[1];
      this.name = name.replace(`#${mat1[1]}`, "");
    }
    let mat2 = name.match("^.+?;([?!/]+)");
    if (mat2) {
      this.name = name.replace(`;${mat2[1]}`, "");
      _flags = _flags.concat(mat2[1].split("").map((x) => x as ArgFlag));
    }
    this.flag = _flags;
  }

  toString(): string {
    let n = `"${this.name}"`;
    let v = this.value.toString();
    return ((n == v) ? n : `${n}: ${v}`) + (this.field.display != null ? ` = ${this.field.display}` : "");
  }

  get optional(): boolean {
    return this.flag.includes(ArgFlag.OPTIONAL);
  }

  get hidden(): boolean {
    return this.flag.includes(ArgFlag.HIDDEN);
  }
}

export class Args {
  static push(...args: Arg<any>[]): Args
  static push(...args: ConstructorParameters<typeof Arg>): Args
  static push(...args: any[]): Args {
    if (args.length < 1) {
      return new Args();
    }
    if (args[0] instanceof Arg) {
      return new Args(...args as Arg<any>[]);
    }
    return new Args(new Arg(...args as ConstructorParameters<typeof Arg>));
  }

  argument: Arg<any>[];
  varPositional: string | null;
  varKeyword: string | null;
  keywordOnly: string[];
  optionalCount: number;
  private visited: Set<string>;

  constructor(
    ...args: Array<Arg<any> | string | string[]>
  ) {
    this.argument = args.filter((x) => x instanceof Arg).map((x) => x as Arg<any>);
    this.varPositional = null;
    this.varKeyword = null;
    this.keywordOnly = [];
    this.optionalCount = 0;
    this.visited = new Set();
    this._parse();
    this.separate(...args.filter((x) => typeof x === "string" || x instanceof Array).map((x) => x as string | string[]).flat());
  }

  add(
    name: string,
    value: any,
    default_: any = null,
    flags: ArgFlag[] = [],
  ): this {
    if (this.visited.has(name)) {
      return this;
    }
    this.argument.push(new Arg(name, value, default_, " ", null, flags));
    this._parse();
    return this;
  }

  separate(...sep: string[]): this {
    this.argument.forEach((x) => x.separators = sep);
    return this;
  }

  private _parse(): void {
    let _tmp: Arg<any>[] = [];
    let _visited = new Set();
    for (let arg of this.argument) {
      if (_visited.has(arg.name)) {
        continue;
      }
      _tmp.push(arg);
      _visited.add(arg.name);
      if (this.visited.has(arg.name)) {
        continue;
      }
      this.visited.add(arg.name);
      let _limit = false;
      if (arg.flag.includes(ArgFlag.ANTI) && arg.value instanceof Pattern && arg.value != ANY) {
        arg.value = (Object.assign({}, arg.value)).reverse();
      }
      if (arg.value instanceof MultiVar && !_limit) {
        if (arg.value.base instanceof KeyWordVar) {
          if (this.varKeyword) {
            throw new InvalidParam(config.lang.require("args.duplicate_kwargs"));
          }
          this.varKeyword = arg.name;
        } else if (this.varPositional) {
          throw new InvalidParam(config.lang.require("args.duplicate_varargs"));
        } else {
          this.varPositional = arg.name;
        }
        _limit = true;
      }
      if (arg.value instanceof KeyWordVar) {
        if (this.varKeyword || this.varPositional) {
          throw new InvalidParam(config.lang.require("args.exclude_mutable_args"));
        }
        this.keywordOnly.push(arg.name);
        if (arg.separators.includes(arg.value.sep)) {
          let _arg = new Arg(`_key_${arg.name}`, `-*${arg.name}`);
          _tmp.splice(-1, 0, _arg);
          _tmp[_tmp.length - 1].value = arg.value.base
        }
      }
      if (arg.flag.includes(ArgFlag.OPTIONAL)) {
        if (this.varPositional || this.varKeyword) {
          throw new InvalidParam(config.lang.require("args.exclude_mutable_args"));
        }
        this.optionalCount++;
      }
    }
    this.argument = _tmp;
    _visited.clear();
  }

  get length(): number {
    return this.argument.length;
  }

  push(...args: Arg<any>[]): this
  push(...args: ConstructorParameters<typeof Arg>): this
  push(...args: any[]): this {
    if (args.length < 1) {
      return this;
    }
    if (args[0] instanceof Arg) {
      this.argument.push(...args as Arg<any>[]);
    } else {
      this.argument.push(new Arg(...(args as ConstructorParameters<typeof Arg>)));
    }
    this._parse();
    return this;
  }

  merge(other: any): this {
    if (other instanceof Args) {
      this.argument.push(...other.argument);
      this._parse();
      this.keywordOnly = [...new Set(this.keywordOnly.concat(other.keywordOnly))];
    } else if (other instanceof Arg) {
      this.argument.push(other);
      this._parse();
    } else if (other instanceof Array) {
      this.push(...other);
    }
    return this;
  }

  toString(): string {
    return this.argument.length > 0 ?
      `Args(${this.argument.filter((x) => !x.name.startsWith("_key_")).map((x) => x.toString()).join(", ")})` :
      "Empty";
  }

  get empty(): boolean {
    return this.argument.length < 1;
  }
}
