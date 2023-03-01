import { AllParam, Pattern, Empty } from "@arcletjs/nepattern";
import {Arg, Args} from "./args";
import { Double } from "./header";
import { Option, Subcommand } from "./base";
import { config } from "./config";
import { ArgumentMissing, FuzzyMatchSuccess, ParamsUnmatched, SpecialOptionTriggered} from "./errors";
import { OptionResult, Sentence } from "./model";
import { outputManager } from "./output";
import { KeyWordVar, MultiVar} from "./typing";
import { levenshteinNorm, splitOnce} from "./util";

function handleKeyword(
    analyser: SubAnalyser,
    value: KeyWordVar<any>,
    mayArg: any,
    seps: string[],
    result: Map<string, any>,
    defaultVal: any,
    optional: boolean,
    key: string | null = null
) {
  let pat = new RegExp(`^([^${value.sep}]+)${value.sep}(.*?)$`, "s");
  let match = pat.exec(mayArg);
  if (match) {
    key = key || match[1];
    let [_, _key, val] = match;
    if (_key !== key) {
        analyser.container.pushback(mayArg);
        if (analyser.fuzzyMatch && levenshteinNorm(_key, key) >= config.fuzzyThreshold) {
          throw new FuzzyMatchSuccess(config.lang.replaceKeys("common.fuzzy_matched", {source: _key, target: key}));
        }
        if (defaultVal === null || defaultVal === undefined) {
          throw new ParamsUnmatched(config.lang.replaceKeys("common.fuzzy_matched", {source: _key, target: key}))
        }
        result.set(_key, defaultVal == Empty ? null : defaultVal);
        return;
    }
    let isStr = false;
    if (!val) {
      [mayArg, isStr] = analyser.container.popitem(seps);
    }
    let res = value.base.exec(val, defaultVal)
    if (!res.isSuccess()) {
      analyser.container.pushback(mayArg);
    }
    if (res.isFailed()) {
      if (optional) {
        return;
      }
      throw new ParamsUnmatched(res.error!.message);
    }
    result.set(key, res.value);
    return;
  }
  analyser.container.pushback(mayArg);
  throw new ParamsUnmatched(config.lang.replaceKeys("args.key_missing", {"target": mayArg, "key": key}))
}


function loopKw(
  analyser: SubAnalyser,
  loop: number,
  restArg: number,
  seps: string[],
  value: MultiVar<any>,
  defaultVal: any,
) {
  let result = new Map<string, any>();
  for (let i = 0; i < loop; i++) {
    let [mayArg, isStr] = analyser.container.popitem(seps);
    if (!mayArg) {
      continue;
    }
    if (isStr && analyser.container.paramIds.has(mayArg)) {
      analyser.container.pushback(mayArg);
      let keys = Array.from(result.keys());
      for (let j = 0; j < Math.min(result.size, restArg - 1); j++) {
        let key = keys[result.size - 1];
        let arg = result.get(key);
        result.delete(key);
        analyser.container.pushback(`{${key}${(<KeyWordVar<any>>value.base).sep}${arg}`);
      }
      break;
    }
    try{
      handleKeyword(analyser, <KeyWordVar<any>>value.base, mayArg, seps, result, defaultVal, false);
    } catch (e) {
      if (e instanceof ParamsUnmatched) {
        break;
      }
      throw e;
    }
  }
  if (result.size < 1) {
    if (value.flag == "+") {
      throw new ParamsUnmatched("args.missing");
    }
    return defaultVal == Empty ? [] : [defaultVal];
  }
  return result;
}

function loopVar(
  container: DataCollectionContainer,
  loop: number,
  restArg: number,
  seps: string[],
  value: MultiVar<any>,
  defaultVal: any,
) {
  let result: any[] = [];
  for (let i = 0; i < loop; i++) {
    let [mayArg, isStr] = container.popitem(seps);
    if (!mayArg) {
      continue;
    }
    if (isStr && (container.paramIds.has(mayArg) || /^(.+)=\s?$/.test(mayArg))) {
      container.pushback(mayArg);
      for (let j = 0; j < Math.min(result.length, restArg - 1); j++) {
        let arg = result.pop();
        container.pushback(arg);
      }
      break;
    }
    let res = value.base.exec(mayArg);
    if (!res.isSuccess()) {
      container.pushback(mayArg);
      break;
    }
    result.push(res.value);
  }
  if (result.length < 1) {
    if (value.flag == "+") {
      throw new ParamsUnmatched("args.missing");
    }
    return defaultVal == Empty ? [] : [defaultVal];
  }
  return result;
}

function handleMultiArg(
  analyser: SubAnalyser,
  args: Args,
  arg: Arg<any>,
  result: Map<string, any>,
  nargs: number
) {
  let seps = arg.separators;
  let value: MultiVar<any> = arg.value as MultiVar<any>;
  let key = arg.name;
  let defaultVal = arg.field.default;
  let kw = (value.base instanceof KeyWordVar);
  let mRestArg = nargs - result.size;
  let mRestAllParamCount = analyser.container.release(seps).length;
  let loop: number;
  if (!kw && !args.varKeyword || kw && !args.varPositional) {
    loop = mRestAllParamCount - (mRestArg - (value.flag === "+" ? 1 : 0));
  } else if (!kw) {
    loop = mRestAllParamCount - (mRestArg - ((<MultiVar<any>>args.get(args.varPositional!)!.value).flag === "*" ? 1 : 0));
  } else {
    loop = mRestAllParamCount - (mRestArg - ((<MultiVar<any>>args.get(args.varKeyword!)!.value).flag === "*" ? 1 : 0));
  }
  if (value.length > 0) {
    loop = Math.min(loop, value.length);
  }
  result.set(
    key,
    kw ? loopKw(analyser, loop, mRestArg, seps, value, defaultVal) : loopVar(analyser.container, loop, mRestArg, seps, value, defaultVal)
  )
}

export function analyseArgs(
  analyser: SubAnalyser,
  args: Args,
  nargs: number,
) {
  let result = new Map<string, any>();
  for (let arg of args.argument) {
    analyser.container.context = arg;
    let [key, value, defaultVal, optional] = [arg.name, arg.value, arg.field.default, arg.optional];
    let seps = arg.separators;
    let [mayArg, isStr] = analyser.container.popitem(seps);
    if (isStr && analyser.special.has(mayArg)) {
      throw new SpecialOptionTriggered(analyser.special.get(mayArg)!);
    }
    if (!mayArg || (isStr && analyser.container.paramIds.has(mayArg))) {
      analyser.container.pushback(mayArg);
      if (defaultVal !== null && defaultVal !== undefined) {
        result.set(key, defaultVal == Empty ? null : defaultVal)
      } else if (!optional) {
        throw new ArgumentMissing(config.lang.replaceKeys("args.missing", {key: key}))
      }
      continue;
    }
    if (value instanceof MultiVar) {
      analyser.container.pushback(mayArg)
      handleMultiArg(analyser, args, arg, result, nargs)
    } else if (value instanceof KeyWordVar) {
      handleKeyword(analyser, value, mayArg, seps, result, defaultVal, optional, key)
    } else if (value instanceof Pattern) {
      let res = value.exec(mayArg, defaultVal)
      if (!res.isSuccess()) {
        analyser.container.pushback(mayArg)
      }
      if (res.isFailed()) {
        if (optional) {
          continue
        }
        throw new ParamsUnmatched(res.error!.message)
      }
      if (!key.startsWith("_key")) {
        result.set(key, res.value)
      }
    } else if (value == AllParam) {
      analyser.container.pushback(mayArg)
      result.set(key, analyser.container.release(seps))
      analyser.container.currentIndex = analyser.container.nData
      return result
    } else if (mayArg == value) {
      result.set(key, mayArg)
    } else if (defaultVal !== null && defaultVal !== undefined) {
      result.set(key, defaultVal == Empty ? null : defaultVal)
    } else if (!optional) {
      throw new ParamsUnmatched(config.lang.replaceKeys("args.error", {target: mayArg}))
    }
  }
  if (args.varKeyword) {
    let kwargs = result.get(args.varKeyword!)!
    if (!(kwargs instanceof Map)) {
      kwargs = new Map([[args.varKeyword!, kwargs]])
    }
    result.set("$kwargs", [kwargs, args.varKeyword!])
  }
  if (args.varPositional) {
    let varargs = result.get(args.varPositional!)!
    if (!(varargs instanceof Array)) {
      varargs = [varargs]
    }
    result.set("$varargs", [varargs, args.varPositional!])
  }
  if (args.keywordOnly) {
    let res = new Map()
    for (let [key, val] of result.entries()) {
      if (args.keywordOnly!.includes(key)) {
        res.set(key, val)
      }
    }
    result.set("$kwonly", res)
  }
  return result
}

export function handleHelp(analyser: Analyser) {
  let helpParam = analyser.container
  .release(null, true)
  .filter((v) => !analyser.special.has(`${v}`))
  .map((v) => `${v}`)
  outputManager.send(
    analyser.command.name,
    () => analyser.command.formatter.format(helpParam)
  )
  return analyser.export()
}


export function handleShortcut(analyser: Analyser) {
  analyser.container.popitem()
  let opt = analyseArgs(
    analyser,
    Args
    .push("delete;?", "delete")
    .push("name", String)
    .push("command", String, "_"),
    3
  )
  try {
    let msg = analyser.command.shortcut(
      opt.get("name")!,
      opt.get("command")! == "_" ? undefined : {command: analyser.converter(opt.get("command"))},
      opt.has("delete")
    )
    outputManager.send(analyser.command.name, () => msg)
  } catch(e) {
    outputManager.send(analyser.command.name, () => (e as Error).message)
  }
  return analyser.export()
}

import { DataCollectionContainer } from "./container";
import {SubAnalyser, Analyser} from "./analyser";
