import { Pattern, PatternMode } from "./core";
import { AllParam, Ellipsis, Empty, isConstructor } from "./utils";
import { Regex, Switch, Union } from "./base";
import * as fs from "node:fs"

export const ANY: Pattern<any> = new Pattern(
  Object, ".+", PatternMode.KEEP, null, "any"
)

export const STRING: Pattern<string, string> = new Pattern(
  String, ".+?", PatternMode.KEEP, null, "string", null, ["String"]
)

export const EMAIL: Pattern<string, string> = new Pattern(
  String, "(?:[\w\.+-]+)@(?:[\w\.-]+)\.(?:[\w\.-]+)", PatternMode.REGEX_MATCH,
  null, "email"
)

export const IP: Pattern<string, string> = new Pattern(
  String,
  "(?:(?:[01]{0,1}[0-9]{0,1}[0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:[01]{0,1}[0-9]{0,1}[0-9]|2[0-4][0-9]|25[0-5]):?(?:[0-9]+)?",
  PatternMode.REGEX_MATCH,
  null, "ip"
)

export const URL: Pattern<string, string> = new Pattern(
  String,
  "((https|http|ftp|rtsp|mms)?://)"
  + "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?" //ftp的user@
  + "(([0-9]{1,3}\.){3}[0-9]{1,3}" // IP形式的URL- 199.194.52.184
  + "|" // 允许IP和DOMAIN（域名）
  + "([0-9a-z_!~*'()-]+\.)*" // 域名- www.
  + "([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\." // 二级域名
  + "[a-z]{2,6})" // first level domain- .com or .museum
  + "(:[0-9]{1,4})?" // 端口- :80
  + "((/?)|" // a slash isn't required if there is no file name
  + "(/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+/?)",
  PatternMode.REGEX_MATCH,
  null, "url"
)

export const HEX: Pattern<number, string> = new Pattern(
  Number,
  "(?:0x)?[0-9a-fA-F]+",
  PatternMode.REGEX_CONVERT,
  (_, x: string): number => { return eval(`0x${x}`) },
  "hex"
)

export const HEX_COLOR: Pattern<string, string> = new Pattern(
  String,
  "(#[0-9a-fA-F]{6})",
  PatternMode.REGEX_CONVERT,
  (_, x: string) => { return x.substring(1) },
  "color"
)

export const DATE: Pattern<Date, string | number | Date> = new Pattern(
  Date,
  "",
  PatternMode.TYPE_CONVERT,
  (_, x) => { return new Date(x) },
  "date",
  null,
  ["String", "Number"]
)

export const patternMap: Map<any, Pattern<any> | typeof AllParam | typeof Empty> = new Map()
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

export function set_pattern(
  target: Pattern<any>,
  alias: string | null = null,
  cover: boolean = true,
  data: Map<any, any> | null = null
) {
  data = data || patternMap
  for (let k of [alias, target.alias, target.origin, target.origin.name]) {
    if (!k)
      continue
    if (!data.has(k) || cover)
      data.set(k, target)
    else {
      let pat = data.get(k)
      data.set(
        k, (
        pat instanceof Union ?
          new Union([...pat.for_validate, ...pat.for_equal, target]) :
          new Union([pat, target])
      )
      )
    }
  }
}

export function set_patterns(
  patterns: Iterable<Pattern<any>>,
  cover: boolean = true,
  data: Map<any, any> | null = null
) {
  for (let pat of patterns) {
    set_pattern(pat, null, cover, data)
  }
}

export const FILE: Pattern<Buffer, fs.PathLike> = new Pattern(
  Buffer,
  "",
  PatternMode.TYPE_CONVERT,
  (_, x: fs.PathLike) => {
    return fs.existsSync(x) ? fs.readFileSync(x) : null
  },
  "file",
  null,
  ["String", "Buffer", "URL"]
)

export const INTEGER: Pattern<number> = new Pattern(
  Number,
  "\-?[0-9]+",
  PatternMode.REGEX_CONVERT,
  (_, x) => { return Number(x) },
  "int"
)

export const NUMBER: Pattern<number> = new Pattern(
  Number,
  "\-?[0-9]+\.?[0-9]*",
  PatternMode.TYPE_CONVERT,
  (_, x) => { return Number(x) },
  "number",
)

export const BOOL: Pattern<boolean, string> = new Pattern(
  Boolean,
  /(?:true|false)/i,
  PatternMode.REGEX_CONVERT,
  (_, x) => { return x.toLowerCase() === "true" },
  "boolean"
)

export const ARRAY: Pattern<any[]> = new Pattern(
  Array,
  "\[.+?\]",
  PatternMode.REGEX_CONVERT,
  null,
  "array"
)

export const DICT: Pattern<object> = new Pattern(
  Object,
  "\{.+?\}",
  PatternMode.REGEX_CONVERT,
  null,
  "dict"
)

set_patterns([FILE, STRING, INTEGER, NUMBER, BOOL, ARRAY, DICT])


export function parser(item: any): Pattern<any> | typeof AllParam | typeof Empty {
  if (item instanceof Pattern || item === AllParam)
    return item
  try {
    if (patternMap.has(item))
      return patternMap.get(item)!
  }
  catch (e) {

  }
  if (typeof item === "function" && !isConstructor(item)) {
    return new Pattern(
      Object, "", PatternMode.TYPE_CONVERT,
      (_, x: Parameters<typeof item>) => {
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
      return new Regex(item.substring(3))
    }
    if (item.includes("|")) {
      let out: any[] = []
      for (let name of item.split("|")) {
        if (name) {
          out.push(patternMap.get(name) || name)
        }
      }
      return new Union(out)
    }
    return new Pattern(String, item, PatternMode.REGEX_MATCH, null, `'${item}'`)
  }
  if (item instanceof Array) {
    return new Union(
      item.map((v) => { return patternMap.get(v) || v })
    )
  }
  if (typeof item == "object" && "switch" in item && typeof item.switch == "boolean") {
    delete item.switch
    return new Switch(item)
  }
  if (item instanceof Map) {
    return new Switch(item)
  }
  if (item == null) {
    return Empty
  }
  return (typeof item == "function" && isConstructor(item)) ? Pattern.of(item) : Pattern.on(item)
}
