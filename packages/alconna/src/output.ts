import { Dict } from "@arcletjs/nepattern";

class Sender {
  constructor(
    public fn: (data: any) => any,
    public generator: () => string,
  ) {
    this.fn = fn;
    this.generator = generator;
  }

  exec() : Dict {
    let res = this.generator();
    let data = this.fn(res);
    return data && data instanceof Object ? data : { output: res };
  }
}

class OutputManager {
  constructor(
    public cache: Map<string, (data: any) => any> = new Map(),
    public outputs: Map<string, Sender> = new Map(),
    public send_fn: (data: string) => any = (data: string) => console.log(data),
    private out_cache: Map<string, Dict> = new Map(),
  ) {
    this.cache = cache;
    this.outputs = outputs;
    this.send_fn = send_fn;
    this.out_cache = out_cache;
  }

  send(command: string | null = null, generator: (() => string) | null = null, raise: boolean = false) {
    let sender = this.getSender(command);
    if (sender) {
      if (generator) {
        sender.generator = generator;
      }
    } else if (generator) {
      sender = this.register(generator, command).getSender(command)!;
    } else {
      throw new Error(`No output registered for command ${command}`);
    }
    let out = sender.exec();
    if (command) {
      if (this.out_cache.has(command)) {
        this.out_cache.set(command, Object.assign(this.out_cache.get(command)!, out));
      } else {
        this.out_cache.set(command, out);
      }
    }
    return out;
  }

  getSender(command: string | null = null): Sender | undefined {
    let name = command || "$global";
    return this.outputs.get(name)
  }

  register(generator: () => string, command: string | null = null): this {
    let name = command || "$global";
    if (this.outputs.has(name)) {
      this.outputs.get(name)!.generator = generator;
    } else if (this.cache.has(name)) {
      this.outputs.set(name, new Sender(this.cache.get(name)!, generator));
      this.cache.delete(name);
    } else {
      this.outputs.set(name, new Sender(this.send_fn, generator));
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

export const outputManager = new OutputManager();
