const Empty = Symbol.for("Empty");
const Ellipsis = Symbol.for("...")

const AllParam = Symbol.for("AllParam");

class MatchFailed extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'MatchFailed'
  }
}

interface Constructor<T> {
  new(...args): any
  readonly prototype: any
}

function isConstructor(fn: Function): fn is Constructor<any> {
  return fn.prototype && fn.name && (
    fn.prototype.constructor.toString().startsWith('class') ||
    fn.prototype.constructor.toString().includes("[native code]")
  ) ? true : false
}

export { AllParam, MatchFailed, Empty, isConstructor, Constructor, Ellipsis }
