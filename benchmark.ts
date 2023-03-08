import {Command, Args} from "alconna";
import { ANY, Pattern } from "nepattern";

class At {
  constructor(
    public target: number
  ) { this.target = target; }
}

let alc = new Command("test", ["."], Args.push("bar", ANY))
let compile_alc = alc.compile();
console.debug(alc);
let msg = [".test", new At(1234)]
let count = 20000;
let sec = 0.0;

for(let i = 0; i < count; i++) {
  let start = Date.now();
  compile_alc.container.build(msg);
  compile_alc.process(null, false);
  sec += (Date.now() - start) / 1000;
}
console.log(`Alconna: ${count / sec} msg/s`);
