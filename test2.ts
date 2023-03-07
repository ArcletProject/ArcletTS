import {Command, Option, Subcommand, Args, LruCache} from "@arcletjs/alconna";

let alc = new Command(
  "eval",
  ["/"],
  Args.push("content#test", String)
)

function exec(content: string) {
  console.log("executing: " + content);
  eval(content);
}

alc.shortcut("/echo", {"command": "/eval console.log(\\'{%0}\\')"})

let inputs = [
  "/eval console.log(\\'hello\\')",
  "/echo world",
  "/eval",
  "/echo",
  ".exit",
]


for (let input of inputs) {
  if (input == ".exit") {
    break;
  }
  let res = alc.parse(input);
  if (!res.matched) {
    console.log("error");
    console.log(res);
  } else {
    exec(res.allArgs.get("content")!);
  }
}
