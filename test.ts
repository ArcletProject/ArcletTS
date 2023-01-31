import {BasePattern, PatternMode} from "@arcletjs/nepattern/src";

class A {
  name: string
  constructor(n) {
    this.name = n
  }
  toString() {return `A:${this.name}`}
}

let a = new A("tom")
let b = new A("jim")

let A_PAT: BasePattern<A> = BasePattern.of(A)
let a_pat: BasePattern<A> = BasePattern.on(a)

console.log(A_PAT.toString())
console.log(a_pat.toString())

console.log(A_PAT.exec(a))
console.log(a_pat.exec(a))
console.log(A_PAT.exec(b))
console.log(a_pat.exec(b))


let INTEGER: BasePattern<number> = new BasePattern(
  Number,
  "\-?[0-9]+",
  PatternMode.REGEX_CONVERT,
  (_, x) => {return Number(x)},
  "int"
)

let NUMBER: BasePattern<number> = new BasePattern(
  Number,
  "\-?[0-9]+\.?[0-9]*",
  PatternMode.TYPE_CONVERT,
  (_, x) => {return Number(x)},
  "number",
)
let va = INTEGER.validate("123", 123).value
let vb = va + 12
console.log(INTEGER.toString())
console.log(NUMBER.toString())
console.log(INTEGER.exec("123"))
console.log(INTEGER.exec("1234.5"))
console.log(NUMBER.exec("123"))
console.log(NUMBER.exec("1234.5"))
