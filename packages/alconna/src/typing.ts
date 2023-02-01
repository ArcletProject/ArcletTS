import {Pattern, parser, PatternMode} from "@arcletjs/nepattern/src";

interface DataCollection<Unit> {
  get length(): number;

  [Symbol.iterator](): Iterator<Unit>;

  toString(): string;
}

class KeyWordVar<T> extends Pattern<T> {
  base: Pattern<T>;
  sep: string;

  constructor(value: any, sep: string = "=") {
    let base = (value instanceof Pattern) ? value : parser(value);
    super((<Pattern<T>>base).origin, ".+?", PatternMode.KEEP, null, `@${sep}${base.toString()}`);
    this.base = <Pattern<T>>base;
    this.sep = sep;
  }

  toString(): string {
    return this.alias!;
  }
}

class MultiVar<T> extends Pattern<T> {
  base: Pattern<T>;
  flag: "+" | "*";
  length: number;

  constructor(value: any, flag: number | "+" | "*" = "+") {
    let base = (value instanceof Pattern) ? value : parser(value);
    let origin = base instanceof KeyWordVar ? Map<String, T> : Array<T>;
    super(origin, ".+?", PatternMode.KEEP);
    this.base = <Pattern<T>>base;
    if (typeof flag !== "number") {
      this.alias = `(${this.base.toString()}${flag})`;
      this.flag = flag;
      this.length = -1
    } else if (flag > 1) {
      this.alias = `(${this.base.toString()}+)[:${flag}]`;
      this.flag = "+";
      this.length = flag;
    } else {
      this.alias = this.base.toString();
      this.flag = "+";
      this.length = 1;
    }
  }

  toString(): string {
    return this.alias!;
  }
}

export {KeyWordVar, MultiVar, DataCollection};

