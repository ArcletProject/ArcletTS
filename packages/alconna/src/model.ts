import {Ellipsis} from "@arcletjs/nepattern";

export class Sentence {
  public name: string;
  public separators: string[];

  constructor(
    name: string,
    separators: string[] | null = null,
  ) {
    this.name = name;
    this.separators = separators || [];
  }

  toString() {
    return `Sentence:${this.name}`
  }

  equals(other: Sentence) {
    return this.name === other.name && this.separators === other.separators;
  }
}

export class OptionResult {
  public value: any;
  public args: { [key: string]: any };

  constructor(
    value: any = Ellipsis,
    args: { [key: string]: any } | null = null,
  ) {
    this.value = value;
    this.args = args || {};
  }

  toString() {
    return `OptionResult:[${this.value}, ${this.args}]`
  }
}

export class SubcommandResult {
  public value: any;
  public args: { [key: string]: any };
  public options: { [key: string]: OptionResult };
  public subcommands: { [key: string]: SubcommandResult };

  constructor(
    value: any = Ellipsis,
    args: { [key: string]: any } | null = null,
    options: { [key: string]: OptionResult } | null = null,
    subcommands: { [key: string]: SubcommandResult } | null = null,
  ) {
    this.value = value;
    this.args = args || {};
    this.options = options || {};
    this.subcommands = subcommands || {};
  }

  toString() {
    return `SubcommandResult:[${this.value}, ${this.args}, ${this.options}, ${this.subcommands}]`
  }
}

export class HeadResult {
  public origin: any;
  public result: any;
  public matched: boolean;
  public groups: { [key: string]: string };

  constructor(
    origin: any = null,
    result: any = null,
    matched: boolean = false,
    groups: { [key: string]: string } | null = null,
  ) {
    this.origin = origin;
    this.result = result;
    this.matched = matched;
    this.groups = groups || {};
  }
}
