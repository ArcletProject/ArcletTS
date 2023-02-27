import { Union } from "./base";
import { Pattern } from "./core";
import { AllParam, Constructor, Dict, Empty } from "./utils";

export class Patterns extends Map<any, Pattern<any>> {
  public name: string;
  constructor(name: string) {
    super();
    this.name = name;
    //@ts-ignore
    this.set("", Empty);
    //@ts-ignore
    this.set("*", AllParam);
  }

  add(
    target: Pattern<any>,
    alias: string | null = null,
    cover: boolean = true
  ) {
    for (let k of [alias, target.alias, target.origin, target.origin.name]) {
      if (!k)
        continue
      if (!this.has(k) || cover)
        this.set(k, target)
      else {
        let pat = this.get(k)!
        this.set(
          k, (
          pat instanceof Union ?
            new Union([...pat.for_validate, ...pat.for_equal, target]) :
            new Union([pat, target])
        )
        )
      }
    }
  }

  adds(patterns: Iterable<Pattern<any>>, cover: boolean = true) {
    for (let pat of patterns) {
      this.add(pat, null, cover)
    }
  }

  merge(patterns: Patterns) {
    for (let [k, v] of patterns) {
      this.add(v, k)
    }
  }

  update(patterns: Dict<Pattern<any>, string | symbol>) {
    for (let [k, v] of Object.entries(patterns)) {
      this.add(v, k)
    }
  }

  remove(origin: Constructor<any>, alias: string | null = null) {
    if (alias && this.has(alias)) {
      let alpat = this.get(alias)!
      if (alpat instanceof Union) {
        alpat.for_validate = alpat.for_validate.filter(x => x.origin !== origin)
        if (alpat.for_validate.length === 0 && alpat.for_equal.length === 0) {
          this.delete(alias)
        }
      } else {
        this.delete(alias)
      }
    } else {
      let alpat: Pattern<any>
      if (this.has(origin)) {
        alpat = this.get(origin)!
      } else if (this.has(origin.name)) {
        alpat = this.get(origin.name)!
      } else {
        return
      }
      if (alpat instanceof Union) {
        alpat.for_validate = alpat.for_validate.filter(x => x.origin !== origin)
        if (alpat.for_validate.length === 0 && alpat.for_equal.length === 0) {
          this.delete(alias)
        }
      } else {
        this.delete(alias)
      }
    }
  }
}

const _ctx: Dict<Patterns> = {$global: new Patterns("$global")}
let ctx: Patterns = _ctx.$global

export function createLocalPatterns(
  name: string,
  data: Dict<Pattern<any>, string | symbol> = {},
  setCurrent: boolean = true
) {
  if (name.startsWith("$"))
    throw new Error("value error: " + name)
  let _pats = new Patterns(name)
  _pats.update(data)
  _ctx[name] = _pats;
  if (setCurrent) {
    ctx = _pats
  }
  return _pats
}

export function swtichLocalPatterns(name: string) {
  if (name.startsWith("$"))
    throw new Error("value error: " + name)
  ctx = _ctx[name]
}

export function resetLocalPatterns() {
  ctx = _ctx["$global"]
}

export function localPatterns() {
  return ctx.name !== "$global" ? ctx : new Patterns("$temp")
}

export function globalPatterns() {
  return _ctx["$global"]
}

export function allPatterns() {
  let temp = new Patterns("$temp");
  let local = localPatterns();
  if (!local.name.startsWith("$")) {
    temp.merge(local)
  }
  temp.merge(globalPatterns())
  return temp;
}
