import {BasePattern, PatternMode} from "./core";
import {AllParam, Ellipsis, Empty, getClassName} from "./utils";
import {RegexPattern, SwitchPattern, UnionPattern} from "./base";
import * as fs from "fs"

const ANY: BasePattern<any> = new BasePattern(
  Object, ".+", PatternMode.KEEP, null, "any"
)

const STRING: BasePattern<string> = new BasePattern(
  String, "(.+?)", PatternMode.KEEP, null, "string", null, ["String"]
)

const EMAIL: BasePattern<string> = new BasePattern(
  String, "(?:[\w\.+-]+)@(?:[\w\.-]+)\.(?:[\w\.-]+)", PatternMode.REGEX_MATCH,
  null, "email"
)

const IP: BasePattern<string> = new BasePattern(
  String,
  "(?:(?:[01]{0,1}[0-9]{0,1}[0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:[01]{0,1}[0-9]{0,1}[0-9]|2[0-4][0-9]|25[0-5]):?(?:[0-9]+)?",
  PatternMode.REGEX_MATCH,
  null, "ip"
)

const URL: BasePattern<string> = new BasePattern(
  String,
  "(?:[\w]+://)?[^/\s?#]+[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?",
  PatternMode.REGEX_MATCH,
  null, "url"
)

const HEX: BasePattern<number> = new BasePattern(
  Number,
  "(?:0x)?[0-9a-fA-F]+",
  PatternMode.REGEX_CONVERT,
  (_, x) => {return eval(`0x${x}`)},
  "hex"
)

const HEX_COLOR: BasePattern<string> = new BasePattern(
  String,
  "(#[0-9a-fA-F]{6})",
  PatternMode.REGEX_CONVERT,
  (_, x) => {return x.substring(1)},
  "color"
)

const DATE: BasePattern<Date> = new BasePattern(
  Date,
  "",
  PatternMode.TYPE_CONVERT,
  (_, x) => {return new Date(x)},
  "date",
  null,
  ["String", "Number"]
)

const patternMap: Map<any, BasePattern<any> | typeof AllParam | typeof Empty> = new Map()
patternMap.set("any", ANY)
patternMap.set(Ellipsis, ANY)
patternMap.set("email", EMAIL)
patternMap.set("color", HEX_COLOR)
patternMap.set("hex", HEX)
patternMap.set("ip", IP)
patternMap.set("url", URL)
patternMap.set("...", ANY)
patternMap.set("*", AllParam)
patternMap.set("", Empty)
patternMap.set("date", DATE)

function set_pattern(
  target: BasePattern<any>,
  alias: string | null = null,
  cover: boolean = true,
  data: Map<any, any> | null = null
){
  data = data || patternMap
  for (let k of [alias, target.alias, target.origin, getClassName(target.origin)]) {
    if (!k)
      continue
    if (!data.has(k) || cover)
      data.set(k, target)
    else {
      let pat = data.get(k)
      data.set(
        k, (
          pat instanceof UnionPattern ?
            new UnionPattern([...pat.for_validate, ...pat.for_equal, target]) :
            new UnionPattern([pat, target])
        )
      )
    }
  }
}

function set_patterns(
  patterns: Iterable<BasePattern<any>>,
  cover: boolean = true,
  data: Map<any, any> | null = null
){
  for (let pat of patterns) {
    set_pattern(pat, null, cover, data)
  }
}

let FILE: BasePattern<Buffer> = new BasePattern(
  Buffer,
  "",
  PatternMode.TYPE_CONVERT,
  (_, x) => {
    return fs.existsSync(x) ? fs.readFileSync(x) : null
  },
  "file",
  null,
  ["String"]
)

const INTEGER: BasePattern<number> = new BasePattern(
  Number,
  "\-?[0-9]+",
  PatternMode.REGEX_CONVERT,
  (_, x) => {return Number(x)},
  "int"
)

const NUMBER: BasePattern<number> = new BasePattern(
  Number,
  "\-?[0-9]+\.?[0-9]*",
  PatternMode.TYPE_CONVERT,
  (_, x) => {return Number(x)},
  "number",
)

const BOOL: BasePattern<boolean> = new BasePattern(
  Boolean,
  "(?:True|False|true|false)",
  PatternMode.REGEX_CONVERT,
  (_, x) => {return x.toLowerCase() === "true"},
  "boolean"
)

const ARRAY: BasePattern<any[]> = new BasePattern(
  Array,
  "\[.+?\]",
  PatternMode.REGEX_CONVERT,
  null,
  "array"
)

const DICT: BasePattern<object> = new BasePattern(
  Object,
  "\{.+?\}",
  PatternMode.REGEX_CONVERT,
  null,
  "dict"
)

set_patterns([FILE, STRING, INTEGER, NUMBER, BOOL, ARRAY, DICT])


function parser(item: any): BasePattern<any> | typeof AllParam | typeof Empty {
  if (item instanceof BasePattern || item === AllParam)
    return item
  try {
    if (patternMap.has(item))
      return patternMap.get(item)!
  }
  catch (e) {

  }
  if (item instanceof Function){
    return new BasePattern(
      Object, "", PatternMode.TYPE_CONVERT,
      (_, x) => {
        try {
          return new item(x)
        }
        catch (e) {
          return item(x)
        }
      }
    )
  }
  if (typeof item == "string") {
    if (item.startsWith("re:")) {
      return new RegexPattern(item.substring(3))
    }
    if (item.includes("|")) {
      let out: any[] = []
      for (let name of item.split("|")) {
        if (name) {
          out.push(patternMap.get(name) || name)
        }
      }
      return new UnionPattern(out)
    }
    return new BasePattern(String, item, PatternMode.REGEX_MATCH, null, `'${item}'`)
  }
  if (item instanceof Array) {
    return new UnionPattern(
      item.map((v) => {return patternMap.get(v) || v})
    )
  }
  if (typeof item == "object" && "switch" in item && typeof item.switch == "boolean") {
    delete item.switch
    return new SwitchPattern(item)
  }
  if (item instanceof Map) {
    return new SwitchPattern(item)
  }
  if (item == null) {
    return Empty
  }
  return (typeof item == "function") ? BasePattern.of(item) : BasePattern.on(item)
}

export {
  patternMap,
  parser,
  set_patterns,
  set_pattern,
  ANY,
  STRING,
  EMAIL,
  IP,
  URL,
  HEX,
  HEX_COLOR,
  DATE,
  INTEGER,
  NUMBER,
  BOOL,
  FILE,
  ARRAY,
  DICT
}
