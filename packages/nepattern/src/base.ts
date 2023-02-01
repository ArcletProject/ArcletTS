import {Pattern, PatternMode} from "./core";
import {Constructor, Empty, MatchFailed, Ellipsis} from "./utils";

type RegexGroup = { [key: string]: string }

export class Regex extends Pattern<RegexGroup | string[]> {
  constructor(
    pattern: string,
    alias: string | null = null
  ) {
    super(Array, pattern, PatternMode.REGEX_MATCH, null, alias || "regex[:group]");
  }

  match(input: any): RegexGroup | string[] {
    if (!(typeof input == "string"))
      throw new MatchFailed(`参数 ${input} 的类型不正确`)
    let mat = this.regex.exec(input)
    if (mat != null) {
      return mat.groups || mat.slice(0, mat.length)
    }
    throw new MatchFailed(`参数 ${input} 不正确`)
  }
}

export class Union<T extends any[]> extends Pattern<T extends (infer B | Pattern<infer B>)[] ? B : never> {
  optional: boolean
  for_validate: Array<Pattern<any>>
  for_equal: Array<any>

  constructor(
    ...base: T
  ) {
    super(String, "", PatternMode.KEEP)
    this.optional = false
    this.for_validate = []
    this.for_equal = []

    for (let arg of base) {
      if (arg == Empty) {
        this.optional = true;
        this.for_equal.push(null);
      } else if (arg instanceof Pattern) {
        this.for_validate.push(arg)
      } else
        this.for_equal.push(arg)
    }
    let _val_reprs = this.for_validate.map((v) => {
      return v.toString()
    })
    let _eql_reprs = this.for_equal.map((v) => {
      return `${v}`
    })
    _val_reprs.push(..._eql_reprs)
    this.alias = _val_reprs.join("|")
  }

  match(input: any): T extends (infer B | Pattern<infer B>)[] ? B : never {
    if (!input) {
      input = null
    }
    if (!(input in this.for_equal)) {
      for (let pat of this.for_validate) {
        let res = pat.exec<any>(input)
        if (res.isSuccess())
          return res.value
      }
      throw new MatchFailed(`参数 ${input} 不正确`)
    }
    return input
  }

  toString(): string {
    return (this.anti ? "!" : "") + this.alias
  }
}

export class Sequence<T extends Array<V> | Set<V>, V> extends Pattern<T> {
  base: Pattern<V>

  constructor(
    form: Constructor<T>,
    base: Pattern<V>
  ) {
    if (form.name == "Set") {
      super(form, "\{(.+?)\}");
      this.base = base
      this.alias = "Set<" + base.toString() + ">"
    } else {
      super(form, "[(.+?)]");
      this.base = base
      this.alias = "Array<" + base.toString() + ">"
    }
  }

  match(input: any): T {
    //@ts-ignore
    let res: string | V[] | Set<V> = super.match(input)
    let success: any[] = []
    let fail: Error[] = []
    let iter: Iterable<string | V> = (res instanceof String) ? res.split(/\s*[,，]\s*/) : res
    for (let s of iter) {
      try {
        success.push(this.base.match(s))
      } catch (e) {
        if (e instanceof MatchFailed)
          fail.push(new MatchFailed(`${s} is not matched with ${this.base}`))
        throw e
      }
    }
    if (fail.length > 0) {
      throw fail[0]
    }
    return new this.origin(...success)
  }

  toString(): string {
    return `${this.origin.name}` + "<" + this.base.toString() + ">"
  }
}

type Dict<T, K extends string | number | symbol = string> = { [key in K]: T }

export class Mapping<TV, TK extends string | number | symbol = string> extends Pattern<Dict<TV, TK>> {
  key: Pattern<TK>
  value: Pattern<TV>

  constructor(
    key: Pattern<TK>,
    value: Pattern<TV>
  ) {
    super(
      Object,
      "\{(.+?)\}",
      PatternMode.REGEX_MATCH
    );
    this.key = key
    this.value = value
    this.alias = "map<" + this.key.toString() + ", " + this.value.toString() + ">"
  }

  _generate_items(res: string | Dict<any>) {
    if (typeof res == "string") {
      let out: Array<[string, string]> = []
      let holders = res.split(/\s*[，,]\s*/)
      for (let holder of holders) {
        let kvs = holder.split(/\s*[:=]\s*/)
        out.push([kvs[0], kvs[1]])
      }
      return out
    } else {
      let out: Array<[string, any]> = []
      for (let val in res) {
        out.push([val, res[val]])
      }
      return out
    }
  }

  match(input: any): Dict<TV, TK> {
    //@ts-ignore
    let res: Dict<TV> | string = super.match(input)
    let success: Array<[string | number | symbol, any]> = []
    let fail: Error[] = []

    for (let item of this._generate_items(res)) {
      try {
        success.push([this.key.match(item[0]), this.value.match(item[1])])
      } catch (e) {
        if (e instanceof MatchFailed)
          fail.push(new MatchFailed(`${item[0]} : ${item[1]} is not matched with ${this.key} : ${this.value}`))
        throw e
      }
    }
    if (fail.length > 0)
      throw fail[0]
    let out = {}
    for (let item of success) {
      out[item[0]] = item[1]
    }
    return out as Dict<TV, TK>
  }

  toString(): string {
    return `${this.alias}`
  }
}

export class Switch<TS, TC> extends Pattern<TC> {
  switch: Map<TS | typeof Ellipsis, TC>

  constructor(data: Dict<TC>)
  constructor(data: Map<TS | typeof Ellipsis, TC>)
  constructor(data: Map<TS | typeof Ellipsis, TC> | Dict<TC>) {
    if (data instanceof Map) {
      super((<any>data.values().next().value).constructor, "", PatternMode.TYPE_CONVERT);
      this.switch = data
    } else {
      let map = new Map()
      for (let key in data) {
        map[key] = data[key]
      }
      super((<any>map.values().next().value).constructor, "", PatternMode.TYPE_CONVERT);
      this.switch = map
    }
  }

  toString(): string {
    let res: string = ""
    for (let k of this.switch.keys()) {
      if (k !== Ellipsis)
        res += `${k}|`
    }
    if (res.endsWith("|"))
      res = res.substring(0, res.lastIndexOf("|") - 1)
    return res
  }

  match(input: TS): TC {
    if (this.switch.has(input)) {
      return this.switch.get(input)!
    }
    if (this.switch.has(Ellipsis)) {
      return this.switch.get(Ellipsis)!
    }
    throw new MatchFailed(`参数 ${input} 不正确`)
  }
}
