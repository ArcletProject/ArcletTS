import {Command, Option, Subcommand, Args, LruCache} from "@arcletjs/alconna";

let alc = new Command("echo", null, Args.push("foo#test", Number))
  .option("--bar")
  .subcommand(
    new Subcommand("baz").option("--qux")
  )
  .meta({description: "echo help"})

console.log(alc.getHelp());

let cache: LruCache<string, string> = new LruCache(3);
cache.set("a", "a");
cache.set("b", "b");
cache.set("c", "c");
console.log(cache.toString());
console.log(cache.recent);
let _ = cache.get("a");
console.log(cache.toString());
console.log(cache.recent);
cache.set("d", "d");
console.log(cache.toString());
console.log(cache.recent);
console.log(cache.get("b", "NOT FOUND"));
