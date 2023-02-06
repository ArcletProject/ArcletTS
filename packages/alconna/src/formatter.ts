import { Option, Subcommand } from "./base";
import { Args, Arg } from "./args";
import { AllParam, Empty, Pattern } from "@arcletjs/nepattern";

function resolve_requires(opts: (Option | Subcommand)[]): Map<string, Map<string, any> | Option | Subcommand> {
  let reqs: Map<string, Map<string, any> | Option | Subcommand> = new Map();

  function _update(target: Map<string, any>, source: Map<string, any>) {
    for (let [key, value] of source) {
      if (!target.has(key) || target[key] instanceof Option || target[key] instanceof Subcommand) {
        source.forEach((value, key) => { target.set(key, value) });
        break;
      }
      _update(<Map<string, any>>target.get(key), <Map<string, any>>value);
    }
  }

  for (let opt of opts) {
    if (!opt.requires) {
      if (opt instanceof Option) {
        opt.aliases.forEach(alias => reqs.set(alias, opt));
      } else if (opt instanceof Subcommand) {
        reqs.set(opt.name, resolve_requires(opt._options));
      }
    } else {
      let _reqs = new Map<string, any>();
      let _cache = _reqs;
      for (let req of opt.requires) {
        if (_reqs.size == 0) {
          _reqs.set(req, new Map());
          _cache = <Map<string, any>>_reqs.get(req)!;
        } else {
          _cache.set(req, new Map());
          _cache = <Map<string, any>>_cache.get(req)!;
        }
      }
      if (opt instanceof Option) {
        opt.aliases.forEach(alias => _cache.set(alias, opt));
      } else if (opt instanceof Subcommand) {
        _cache.set(opt.name, resolve_requires(opt._options));
      }
      _update(reqs, _reqs);
    }
  }
  return reqs;
}

function ensure_node(target: string, source: (Option|Subcommand)[]): Option | Subcommand | undefined {
  for (let opt of source) {
    if (opt instanceof Option && opt.aliases.includes(target)) {
      return opt;
    }
    if (opt instanceof Subcommand) {
      return target == opt.name ? opt : ensure_node(target, opt._options);
    }
  }
}

type TraceHead = {
  name: string;
  header: any[];
  description: string;
  usage?: string;
  examples?: string[];
}

class Trace {
  constructor(
    public head: TraceHead,
    public args: Args,
    public separators: string[],
    public body: (Option | Subcommand)[]
  ) {
    this.head = head;
    this.args = args;
    this.separators = separators;
    this.body = body;
  }
}



export class TextFormatter {
  data: Trace;
  ignore: Set<string>;

  constructor(command: Command) {
    this.ignore = new Set();

    command.nsConfig.option_name.help.forEach((value) => {this.ignore.add(value);});
    command.nsConfig.option_name.shortcut.forEach((value) => {this.ignore.add(value);});
    command.nsConfig.option_name.completion.forEach((value) => {this.ignore.add(value);});

    let hds: typeof command.headers = Object.assign([], command.nsConfig.headers);
    if (hds.includes(command.name as any)) {
      hds.splice(hds.indexOf(command.name as any), 1);
    }
    this.data = new Trace(
      {
        name: command.name,
        header: hds,
        description: command._meta.description,
        usage: command._meta.usage || undefined,
        examples: command._meta.examples
      },
      command.args,
      command.separators,
      command._options
    )
  }

  format(end: any[] | null = null) {
    if (!end || end.length == 0 || end[0] == "") {
      return this.entry(this.data);
    }
    let _cache: any = resolve_requires(this.data.body);
    let _parts: string[] = [];
    for (let part of end) {
      if (_cache instanceof Map && _cache.has(part)) {
        _cache = <any>_cache.get(part)!;
        _parts.push(part);
      }
    }
    if (_parts.length == 0) {
      return this.entry(this.data);
    }
    if (_cache instanceof Map) {
      let ensure = ensure_node(_parts[_parts.length - 1], this.data.body);
      if (ensure) {
        _cache = ensure;
      } else {
        let _opts: (Option | Subcommand)[] = [];
        let _visited: Set<any> = new Set();
        for (let [key, value] of _cache) {
          if (value instanceof Map) {
            _opts.push(new Option(key).require(..._parts));
          } else if (!_visited.has(value)) {
            _opts.push(value);
            _visited.add(value);
          }
        }
        return this.entry(new Trace(
          {name: _parts.at(-1)!, header: [], description: _parts.at(-1)!},
          new Args(),
          this.data.separators,
          _opts
        ))
      }
    }
    if (_cache instanceof Option) {
      return this.entry(new Trace(
        {name: _cache.name, header: [], description: _cache.help_text},
        _cache.args,
        _cache.separators, []
      ))
    }
    if (_cache instanceof Subcommand) {
      return this.entry(new Trace(
        {
          name: _cache.name,
          header: [],
          description: _cache.help_text
        },
        _cache.args,
        _cache.separators,
        _cache._options
      ))
    }
    return this.entry(this.data);
  }

  entry(trace: Trace): string {
    let header = this.header(trace.head, trace.separators);
    let param = this.parameters(trace.args);
    let body = this.body(trace.body);
    return `${header[0]}${param}${header[1]}${body}${header[2]}`;
  }

  param(arg: Arg<any>): string {
    let name = arg.name;
    let argp = arg.optional ? `[${name}` : `<${name}`;
    if (!arg.hidden) {
      if (arg.value == AllParam) {
        return `<...${name}>`;
      }
      if (!(arg.value instanceof Pattern) || arg.value.pattern != name) {
        argp += `:${arg.value}`;
      }
      if (arg.field.display == Empty) {
        argp += " = null";
      } else if (arg.field.display != null) {
        argp += ` = ${arg.field.display} `;
      }
    }
    return argp + (arg.optional ? "]" : ">");
  }
  parameters(args: Args): string {
    let res = "";
    let notice: [string, string][] = [];
    for (let arg of args.argument) {
      if (arg.name.startsWith("_key_"))
        continue;
      let sep: string;
      if (arg.separators.length == 1)
        sep = arg.separators[0] == " " ? " " : ` ${arg.separators[0]} `;
      else
        sep = arg.separators.join("|");
      res += this.param(arg) + sep;
      if (arg.notice)
        notice.push([arg.name, arg.notice]);
    }
    return notice.length > 0 ? `${res}\n## 注释\n  ` + notice.map((v) => `${v[0]}: ${v[1]}`).join("\n  ") : res;
  }

  header(root: TraceHead, seps: string[]): [string, string, string] {
    let help_string = root.description ? `\n${root.description}` : "";
    let usage_string = root.usage ? `\n用法:\n${root.usage}` : "";
    let example_string = root.examples ? `\n使用示例:\n  ` + root.examples.join("\n  ") : "";
    let header_string = root.header.length > 0 ? `[${root.header.map((v) => String(v)).join("")}]` : "";
    let cmd = `${header_string}${root.name || ""}`;
    let command_string = cmd || `${root.name}${seps[0]}`;
    return [`${command_string} `, `${help_string}${usage_string}\n`, `${example_string}`]
  }

  part(node: Option | Subcommand): string {
    if (node instanceof Subcommand) {
      let name = node.requires.join(" ") + (node.requires.length > 0 ? " " : "") + node.name;
      let option_string = node._options.map((v) => (this.part(v).replace(/\n/g, "\n "))).join("")
      let option_help = option_string ? "## 该子命令内可用的选项有:\n " : ""
      return (
        `# ${node.help_text}\n` +
        `  ${name}${node.separators[0]}` +
        `${this.parameters(node.args)}\n` +
        `${option_help}${option_string}`
      )
    }
    if (node instanceof Option) {
      let alias = node.requires.join(" ") + (node.requires.length > 0 ? " " : "") + node.aliases.join(", ");
      return (
        `# ${node.help_text}\n` +
        `  ${alias}${node.separators[0]}` +
        `${this.parameters(node.args)}\n`
      )
    }
    throw new Error("Unknown node type");
  }

  body(parts: (Option | Subcommand)[]): string {
    let option_string = parts.filter((v) => {return v instanceof Option && !this.ignore.has(v.name)}).map((v) => this.part(v)).join("");
    let subcommand_string = parts.filter((v) => {return v instanceof Subcommand && !this.ignore.has(v.name)}).map((v) => this.part(v)).join("");
    let option_help = option_string ? "可用的选项有:\n" : ""
    let subcommand_help = subcommand_string ? "可用的子命令有:\n" : ""
    return `${option_help}${option_string}${subcommand_help}${subcommand_string}`
  }
}

import { Command } from "./core";
