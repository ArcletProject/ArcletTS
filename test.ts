import { Pattern, MatchMode } from "@arcletjs/nepattern/lib";

class A {
  name: string
  constructor(n: string) {
    this.name = n
  }
  toString() { return `A:${this.name}` }
}

let a = new A("tom")
let b = new A("jim")

let A_PAT: Pattern<A> = Pattern.of(A)
let a_pat: Pattern<A> = Pattern.on(a)

console.log(A_PAT.toString())
console.log(a_pat.toString())

console.log(A_PAT.exec(a))
console.log(a_pat.exec(a))
console.log(A_PAT.exec(b))
console.log(a_pat.exec(b))


let INTEGER: Pattern<number> = new Pattern(
  Number,
  "\-?[0-9]+",
  MatchMode.REGEX_CONVERT,
  (_, x) => { return Number(x) },
  "int"
)

let NUMBER: Pattern<number> = new Pattern(
  Number,
  "\-?[0-9]+\.?[0-9]*",
  MatchMode.TYPE_CONVERT,
  (_, x) => { return Number(x) },
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
