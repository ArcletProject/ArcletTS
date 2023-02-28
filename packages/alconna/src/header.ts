import { allPatterns, Pattern, Empty, Union, Constructor, parser } from "@arcletjs/nepattern";

function handleBracket(command: string): string {
  let mat = command.split(/(\{.*?\})/g)
  if (mat.length <=1) {
    return command
  }
  let i = 0;
  let patMap = allPatterns()
  while (i < mat.length) {
    let part = mat[i];
    if (part.length < 1) {
      i++;
      continue;
    }
    if (part.startsWith("{") && part.endsWith("}")) {
      let content = part.slice(1, part.length - 1).split(":");
      if (content.length < 1 || (content.length > 1 && !content[0] && !content[1])) {
        mat[i] = ".+?";
      } else if (content.length == 1 || !content[1]) {
        mat[i] = `(?<${content[0]}>.+?)`;
      } else if (!content[0]) {
        mat[i] = patMap.has(content[1]) ? `${patMap.get(content[1])!.source}` : `${content[1]}`;
      } else {
        mat[i] = patMap.has(content[1]) ? `(?<${content[0]}>${patMap.get(content[1])!.source})` : `(?<${content[0]}>${content[1]})`;
      }
    }
    i++;
  }
  return mat.join("");
}

export class Pair {
  constructor(
    public prefix: any,
    public pattern: RegExp,
    public isPrefixPat: boolean = false,
  ) {
    this.prefix = prefix;
    this.pattern = pattern;
    this.isPrefixPat = (prefix instanceof Pattern);
  }

  match(prefix: any, command: string) {
    let mat = command.match(this.pattern);
    if (mat) {
      if (this.isPrefixPat) {
        let val = (<Pattern<any>>this.prefix).exec(prefix, Empty)
        if (val.isSuccess()) {
          return [[prefix, command], [val.value, command], true, Object.assign({}, mat.groups)];
        }
      } else if (prefix == this.prefix || prefix.constructor === this.prefix ) {
        return [[prefix, command], [prefix, command], true, Object.assign({}, mat.groups)];
      }
    }
  }
}

export class Double {
  constructor(
    public elements: any[],
    public patterns: Union<any[]> | null,
    public prefix: RegExp | null,
    public command: Pattern<any> | RegExp
  ) {
    this.elements = elements;
    this.patterns = patterns;
    this.prefix = prefix;
    this.command = command;
  }

  match(
    prefix: any,
    command: string,
    prefixStr: boolean,
    commandStr: boolean,
    pushbackfn: (data: string) => any
  ) {
    if (this.prefix && prefixStr) {
      if (commandStr) {
        let pat = new RegExp(`^${this.prefix.source}${this.command.source}$`, "g");
        let mat = command.match(pat);
        if (mat) {
          pushbackfn(command);
          return [prefix, prefix, true, Object.assign({}, mat.groups)];
        } else {
          let name = prefix + command;
          mat = name.match(pat);
          if (mat) {
            return [name, name, true, Object.assign({}, mat.groups)];
          }
        }
      }
      let mat = prefix.match(this.prefix);
      let val = (<Pattern<any>>this.command).exec(command, Empty);
      if (mat && val.isSuccess()) {
        return [[prefix, command], [prefix, val.value], true, Object.assign({}, mat.groups)];
      }
    }
    let po: any
    let pr: any
    if (this.patterns) {
      let val = this.patterns.validate(prefix, Empty);
      if (val.isSuccess()) {
        po = prefix;
        pr = val.value;
      } else {
        return null;
      }
    } else if (this.elements.length > 0 && (this.elements.filter((e) => e == prefix || e.constructor == prefix).length > 0)) {
      po = prefix
      pr = prefix
    } else {
      return null;
    }
    if (this.command instanceof RegExp && commandStr) {
      let mat = command.match(this.command);
      if (mat) {
        return [[po, command], [pr, command], true, Object.assign({}, mat.groups)];
      }
    } else if (this.command instanceof Pattern) {
      let val = (<Pattern<any>>this.command).exec(command, Empty);
      if (val.isSuccess()) {
        return [[po, command], [pr, val.value], true, {}];
      }
    }
    return null;
  }
}

function regEscape(str: string) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export function handleHeader(
  command: string | Constructor<any> | Pattern<any>,
  headers: any[] | Array<[any, string]>
): RegExp | Pattern<any> | Pair[] | Double {
  if (typeof command == "string") {
    command = handleBracket(command);
  }
  let cmd: RegExp | Pattern<any>
  let cmdString: string
  if (typeof command == "string") {
    cmdString = command;
    cmd = new RegExp(`^${command}$`);
  } else {
    cmdString = `${command}`;
    cmd = parser(command);
  }
  if (headers.length == 0) {
    return cmd;
  }
  if (headers[0] instanceof Array && headers[0].length == 2) {
    let pairs: Pair[] = [];
    for (let [prefix, command] of headers) {
      let pat = new RegExp(`${regEscape(command)}${cmdString}`, "g");
      pairs.push(new Pair(prefix, pat));
    }
    return pairs;
  }
  let elements: any[] = [];
  let patterns: any[] = [];
  let text = "";
  for (let header of headers) {
    if (typeof header == "string") {
      text += `${regEscape(header)}|`;
    } else if (header instanceof Pattern) {
      patterns.push(header);
    } else {
      elements.push(header);
    }
  }
  if (elements.length == 0 && patterns.length == 0) {
    if (cmd instanceof RegExp) {
      return new RegExp(`(?:${text.slice(0, text.length - 1)})${cmdString}`, "g");
    }
    cmd.source = `(?:${text.slice(0, text.length - 1)})${cmd.source}`;
    cmd.regex = new RegExp(cmd.source, "g");
    return cmd;
  }
  return new Double(
    elements,
    patterns.length > 0 ? new Union(patterns) : null,
    text.length > 0 ? new RegExp(`(?:${text.slice(0, text.length - 1)})`) : null,
    cmd
  );
}
