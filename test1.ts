import {Command, Option, Subcommand, Args} from "@arcletjs/alconna/src";

let alc = new Command("echo", null, Args.from("foo", Number))
  .option("--bar")
  .subcommand(
    new Subcommand("baz").option("--qux")
  )
  .meta({description: "aaa"})

