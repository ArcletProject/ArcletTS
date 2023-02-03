import {Action} from "./base";
import { Dict } from "@arcletjs/nepattern";

class OutputAction extends Action {
  generator: () => string;

  constructor(
    fn: (data: any) => any,
    generator: () => string,
  ) {
    super(fn);
    this.generator = generator;
  }

  exec(params: any=null, varargs=null, kwargs=null, raise: boolean = false): any {
    return super.exec({output: this.generator()}, varargs, kwargs, raise);
  }
}

class OutputManager {
  constructor(
    public cache: Map<string, (data: any) => any> = new Map(),
    public outputs: Map<string, OutputAction> = new Map(),
    public send_fn: (data: string) => any = (data: string) => console.log(data),
    private out_cache: Map<string, Dict> = new Map(),
  ) {
    this.cache = cache;
    this.outputs = outputs;
    this.send_fn = send_fn;
    this.out_cache = out_cache;
  }

  send(command: string | null = null, generator: (() => string) | null = null, raise: boolean = false): void {
    let output = this.getOutput(command);
    if (output) {
      if (generator) {
        output.generator = generator;
      }
    } else if (generator) {
      output = this.register(generator, command).getOutput(command)!;
    } else {
      throw new Error(`No output registered for command ${command}`);
    }
    let out = output.exec(null, null, null, raise);
    if (command) {
      if (this.out_cache.has(command)) {
        this.out_cache.set(command, Object.assign(this.out_cache.get(command)!, out));
      } else {
        this.out_cache.set(command, out);
      }
    }
    return out;
  }

  getOutput(command: string | null = null): OutputAction | undefined {
    let name = command || "$global";
    return this.outputs.get(name)
  }

  register(generator: () => string, command: string | null = null): this {
    let name = command || "$global";
    if (this.outputs.has(name)) {
      this.outputs.get(name)!.generator = generator;
    } else if (this.cache.has(name)) {
      this.outputs.set(name, new OutputAction(this.cache.get(name)!, generator));
      this.cache.delete(name);
    } else {
      this.outputs.set(name, new OutputAction(this.send_fn, generator));
    }
    return this;
  }

  setFn(fn: (data: string) => any, command: string | null = null): this {
    if (!command || command === "$global") {
      this.send_fn = fn;
    } else if (this.outputs.has(command)) {
      this.outputs.get(command)!.fn = fn;
    } else {
      this.cache.set(command, fn);
    }
    return this;
  }

  capture(command: string | null = null, callbackFn: (data: Dict) => any): void {
    let name = command || "$global";
    let out = this.out_cache.get(name);
    if (out) {
      callbackFn(out);
    } else {
      throw new Error(`No output registered for command ${name}`);
    }
    this.out_cache.delete(name);
  }
}

export const output_manager = new OutputManager();
