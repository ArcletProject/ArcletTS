import {Command, Option, Subcommand, Args} from "@arcletjs/alconna/src";

let alc = new Command("echo", null, Args.from("foo", Number))
  .option(new Option("--bar"))
  .subcommand(
    new Subcommand("baz")
      .option(new Option("--qux"))
  )
  .meta({"description": "aaa"})

