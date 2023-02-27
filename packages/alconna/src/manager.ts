import { ExceedMaxCount } from "./errors";
import { LruCache } from "./collection";
import { DataCollection } from "./typing";
import { config, Namespace } from "./config";
import { formatKeys } from "./util";
import { Dict } from "@arcletjs/nepattern";

export interface ShortcutArgs {
  command?: DataCollection<any>;
  args?: any[];
  options?: Dict<any>;
}


class Manager {
  sign: string = "ALCONNA:";
  current_count: number = 0;
  max_count: number = config.message_max_count;
  private commands: Map<string, Map<string, Command>> = new Map();
  private analysers: Map<Command, any> = new Map();
  private abandons: Command[] = [];
  records: LruCache<number, ParseResult<DataCollection<any>>> = new LruCache(config.message_max_count);
  private shortcuts: LruCache<string, DataCollection<any>> = new LruCache();

  get loadedNamespaces(): string[] {
    return Array.from(this.commands.keys())
  }

  private commandPart(command: string): [string, string] {
    let parts = command.split(":", 1)
    if (parts.length < 2) {
      parts.splice(0, 0, config.default_namespace.name)
    }
    return [parts[0], parts[1]]
  }

  getNamespaceConfig(name: string) {
    if (this.commands.has(name)) {
      return config.namespace[name]
    }
  }

  register(command: Command) {
    if (this.current_count >= this.max_count) {
      throw new ExceedMaxCount("")
    }
    this.analysers.delete(command);
    this.analysers.set(command, {})
    let namespace: Map<string, Command>
    if (this.commands.has(command.namespace)) {
      namespace = this.commands.get(command.namespace)!
    } else {
      namespace = new Map();
      this.commands.set(command.namespace, namespace)
    }
    if (!namespace.has(command.name)) {
      namespace.set(command.name, command);
      this.current_count++;
    }
  }

  require(command: Command): any {
    if (this.analysers.has(command)) {
      return this.analysers.get(command)!
    }
    throw new Error(config.lang.replaceKeys("manager.undefined_command", {target: `${command.path}`}))
  }

  delete(command: Command | string) {
    let [ns, name] = this.commandPart(typeof command == "string" ? command : command.path)
    if (this.commands.has(ns)) {
      let base = this.commands.get(ns)!;
      if (base.has(name)) {
        this.analysers.delete(base.get(name)!)
        base.delete(name);
        this.current_count--;
      }
      if (base.size == 0) {
        this.commands.delete(ns)
      }
    }
  }

  get(command: string): Command {
    let [ns, name] = this.commandPart(command)
    if (this.commands.has(ns)) {
      let base = this.commands.get(ns)!;
      if (base.has(name)) {
        return base.get(name)!
      }
    }
    throw new Error(config.lang.replaceKeys("manager.undefined_command", {target: command}))
  }

  gets(namespace: string | Namespace = ""): Command[] {
    if (!namespace) {
      return Array.from(this.analysers.keys())
    }
    if (namespace instanceof Namespace) {
      namespace = namespace.name
    }
    if (this.commands.has(namespace)) {
      return Array.from(this.commands.get(namespace)!.values())
    }
    return []
  }

  isDisabled(command: Command): boolean {
    return this.abandons.includes(command)
  }

  setEnabled(command: Command | string, enabled: boolean) {
    if (typeof command == "string") {
      command = this.get(command)
    }
    if (enabled) {
      this.abandons = this.abandons.filter(item => item != command)
    }
    if (!enabled) {
      this.abandons.push(command)
    }
  }

  broadcast<T extends DataCollection<any>>(message: T, namespace: string | Namespace = ""): ParseResult<T> | void {
    for (let command of this.gets(namespace)) {
      let res = command.parse(message)
      if (res) {
        return res
      }
    }
  }

  allCommandHelp(
    showIndex: boolean = false,
    namespace: string | Namespace = "",
    header: string | null = null,
    footer: string | null = null,
    pages: string | null = null,
    maxLen: number = -1,
    page: number = 1
  ) {
    pages = pages || config.lang.require("manager.help_pages")
    let commands = this.gets(namespace).filter(command => !command._meta.hide)
    header = header || config.lang.require("manager.help_header")
    let helps: string
    if (maxLen < 1) {
      maxLen = commands.length
      helps = showIndex?
      commands.map((command, index) => `${index.toString().padStart(maxLen.toString().length, '0')} ${command.name} : ${command._meta.description}`).join("\n") :
      commands.map(command => ` - ${command.name} : ${command._meta.description}`).join("\n")
    } else {
      let maxPage = Math.ceil(commands.length / maxLen)
      if (page < 1 || page > maxPage) {
        page = 1
      }
      header += "\t" + formatKeys(pages, {current: page, total: maxPage})
      helps = showIndex?
      commands.slice((page - 1) * maxLen, page * maxLen).map((command, index) => `${(index + (page - 1) * maxLen).toString().padStart(maxLen.toString().length, '0')} ${command.name} : ${command._meta.description}`).join("\n") :
      commands.slice((page - 1) * maxLen, page * maxLen).map(command => ` - ${command.name} : ${command._meta.description}`).join("\n")
    }
    let names = new Set<string>()
    for (let command of commands) {
      command.nsConfig.optionName["help"].forEach(name => names.add(name))
    }
    footer = footer || config.lang.replaceKeys("manager.help_footer", {help: Array.from(names).join("|")})
    return header + "\n" + helps + "\n" + footer
  }

  allCommandRawHelp(namespace: string | Namespace = ""): Dict<TCommandMeta>  {
    let res = {}
    for (let command of this.gets(namespace).filter(command => !command._meta.hide)) {
      res[command.path] = Object.assign({}, command._meta)
    }
    return res
  }

  commandHelp(command: string) {
    try {
      let commandObj = this.get(command)
      return commandObj.getHelp()
    } catch (e) {
    }
  }

  record(token: number, result: ParseResult<DataCollection<any>>) {
    this.records.set(token, result)
  }

  getRecord(token: number) {
    return this.records.get(token) || null
  }

  getToken(result: ParseResult<DataCollection<any>>) {
    for (let [token, value] of this.records.entries()) {
      if (value.value == result) {
        return token
      }
    }
    return 0
  }

  get recentMessage() {
    let rct = this.records.recent;
    if (rct) {
      return rct.origin
    }
  }

  get lastUsing() {
    let rct = this.records.recent;
    if (rct) {
      return rct.source
    }
  }

  getResult(command: Command) {
    for (let value of this.records.values()) {
      if (value.value!.source == command) {
        return value.value
      }
    }
    return null
  }

  reuse(index: number = -1) {
    let values = Array.from(this.records.values()).map(item => item.value)
    return values.at(index)
  }
}

export const manager = new Manager();

import {Command, TCommandMeta} from "./core";
import { ParseResult } from "./result";
