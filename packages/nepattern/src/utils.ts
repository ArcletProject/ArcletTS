export const Empty = Symbol.for("Empty");
export const Ellipsis = Symbol.for("...");

export const AllParam = Symbol.for("AllParam");

export class MatchFailed extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'MatchFailed'
  }
}

export type Dict<V = any, K extends string | number | symbol = string> = { [key in K]: V }


export interface Constructor<T> {
  new(...args): any
  readonly prototype: any
}

export function isConstructor(fn: Function): fn is Constructor<any> {
  return fn.prototype && fn.name && (
    fn.prototype.constructor.toString().startsWith('class') ||
    fn.name in globalThis
  )
}
