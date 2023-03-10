import {Pattern, parser, MatchMode} from "@arcletjs/nepattern";

export type THeader = Array<string | object> | Array<[object, string]>;
export interface DataCollection<Unit = string> {
  get length(): number;

  [Symbol.iterator](): Iterator<Unit>;

  toString(): string;
}

export class KeyWordVar<T> extends Pattern<T> {
  base: Pattern<T>;
  sep: string;

  constructor(value: any, sep: string = "=") {
    let base = (value instanceof Pattern) ? value : parser(value);
    super((<Pattern<T>>base).origin, ".+?", MatchMode.KEEP, null, `@${sep}${base.toString()}`);
    this.base = <Pattern<T>>base;
    this.sep = sep;
  }

  toString(): string {
    return this.alias!;
  }
}

export class MultiVar<T> extends Pattern<T> {
  base: Pattern<T>;
  flag: "+" | "*";
  length: number;

  constructor(value: any, flag: number | "+" | "*" = "+") {
    let base = (value instanceof Pattern) ? value : parser(value);
    let origin = base instanceof KeyWordVar ? Map<String, T> : Array<T>;
    super(origin, ".+?", MatchMode.KEEP);
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
