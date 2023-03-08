# Arclet-Typescript

- nepattern
- alconna

## python source code
| Package | Version |
| ------- | ------- |
| Alconna | [![python](https://img.shields.io/pypi/v/arclet-alconna.svg)](https://pypi.org/project/arclet-alconna/) |]]
| NEpattern | [![python](https://img.shields.io/pypi/v/nepattern.svg)](https://pypi.org/project/nepattern/) |]]

## example

```typescript
import { Command, Args, Option} from "@arcletjs/alconna";

let cmd = new Command("npm", ["/"])
.option("list")
.subcommand("install", Args.push("pakName", String), [Option("-S|--save")])

let result = cmd.parse("/npm install tsc --save")
console.log(result.query("install"))
// Output as follows:
// value=null args={"pakName":["tsc"]} options={"save":{"value":Ellipsis,"args":{}}} subcommands={}
```
