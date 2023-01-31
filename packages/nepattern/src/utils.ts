const Empty = Symbol("Empty");
const Ellipsis = Symbol("...")

const AllParam = Symbol("AllParam");

class MatchFailed extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'MatchFailed'
  }
}

interface Constructor<T> {
  new(...args): any
  //(...args): any
  readonly prototype: any
}

function getClassName(constructor: Function) {
  let code = constructor.toString();
  return code.split(' ')[1].split('(')[0]
}

export {AllParam, MatchFailed, Empty, getClassName, Constructor, Ellipsis}
