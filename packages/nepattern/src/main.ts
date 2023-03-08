import { Pattern, MatchMode } from "./core";
import { AllParam, Empty, isConstructor } from "./utils";
import { Regex, Switch, Union } from "./base";
import { globalPatterns, allPatterns } from "./context";
import * as fs from "fs"

export const ANY: Pattern<any> = new Pattern(
  Object, ".+", MatchMode.KEEP, null, "any"
)

export const ANY_STRING: Pattern<string> = new Pattern(
  String, ".+", MatchMode.TYPE_CONVERT, null, "any_string"
)

export const STRING: Pattern<string, string> = new Pattern(
  String, ".+?", MatchMode.KEEP, null, "string", null, ["String"]
)

export const EMAIL: Pattern<string, string> = new Pattern(
  String, "(?:[\w\.+-]+)@(?:[\w\.-]+)\.(?:[\w\.-]+)", MatchMode.REGEX_MATCH,
  null, "email"
)

export const IP: Pattern<string, string> = new Pattern(
  String,
  "(?:(?:[01]{0,1}[0-9]{0,1}[0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:[01]{0,1}[0-9]{0,1}[0-9]|2[0-4][0-9]|25[0-5]):?(?:[0-9]+)?",
  MatchMode.REGEX_MATCH,
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
  MatchMode.REGEX_MATCH,
  null, "url"
)

export const HEX: Pattern<number, string> = new Pattern(
  Number,
  "(?:0x)?[0-9a-fA-F]+",
  MatchMode.REGEX_CONVERT,
  (_, x: string): number => { return eval(`0x${x}`) },
  "hex"
)

export const HEX_COLOR: Pattern<string, string> = new Pattern(
  String,
  "(#[0-9a-fA-F]{6})",
  MatchMode.REGEX_CONVERT,
  (_, x: string) => { return x.substring(1) },
  "color"
)

export const DATE: Pattern<Date, string | number | Date> = new Pattern(
  Date,
  "",
  MatchMode.TYPE_CONVERT,
  (_, x) => { return new Date(x) },
  "date",
  null,
  ["String", "Number"]
)

globalPatterns().update(
  {
    "any": ANY,
    Ellipsis: ANY,
    "any_string": ANY_STRING,
    "email": EMAIL,
    "color": HEX_COLOR,
    "hex": HEX,
    "ip": IP,
    "url": URL,
    "date": DATE,
    "...": ANY,
  }
)


export const FILE: Pattern<Buffer, fs.PathLike> = new Pattern(
  Buffer,
  "",
  MatchMode.TYPE_CONVERT,
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
  MatchMode.REGEX_CONVERT,
  (_, x) => { return Number(x) },
  "int"
)

export const NUMBER: Pattern<number> = new Pattern(
  Number,
  "\-?[0-9]+\.?[0-9]*",
  MatchMode.TYPE_CONVERT,
  (_, x) => { return Number(x) },
  "number",
)

export const BOOL: Pattern<boolean, string> = new Pattern(
  Boolean,
  /(?:true|false)/i,
  MatchMode.REGEX_CONVERT,
  (_, x) => { return x.toLowerCase() === "true" },
  "boolean"
)

export const ARRAY: Pattern<any[]> = new Pattern(
  Array,
  "\[.+?\]",
  MatchMode.REGEX_CONVERT,
  null,
  "array"
)

export const DICT: Pattern<object> = new Pattern(
  Object,
  "\{.+?\}",
  MatchMode.REGEX_CONVERT,
  null,
  "dict"
)

globalPatterns().adds([FILE, STRING, INTEGER, NUMBER, BOOL, ARRAY, DICT])


export function parser(item: any): Pattern<any> {
  if (item instanceof Pattern || item === AllParam)
    return item
  let patternMap = allPatterns()
  try {
    if (item && patternMap.has(item))
      return patternMap.get(item)!
  }
  catch (e) {

  }
  if (typeof item === "function" && !isConstructor(item)) {
    return new Pattern(
      Object, "", MatchMode.TYPE_CONVERT,
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
    return new Pattern(String, item, MatchMode.REGEX_MATCH, null, `'${item}'`)
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
    //@ts-ignore
    return Empty
  }
  return (typeof item == "function" && isConstructor(item)) ? Pattern.of(item) : Pattern.on(item)
}
