# @arcletjs/alconna

![Alconna](https://img.shields.io/badge/Arclet-Alconna-2564c2.svg)
[![Licence](https://img.shields.io/github/license/ArcletProject/Alconna)](https://github.com/ArcletProject/Alconna/blob/master/LICENSE)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FArcletProject%2FAlconna.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FArcletProject%2FAlconna?ref=badge_shield)

## About

`Alconna` is a powerful cli tool for parsing message chain or other raw message data. It is an overload version of `CommandAnalysis`, affiliated to `ArcletProject`.

`Alconna` has a large number of built-in components and complex parsing functions. ~~But do not afraid~~, you can use it as a simple command parser.


## example

```typescript
import { Command, Args, Option} from "@arcletjs/alconna";

let cmd = new Command("npm", ["/"])
.option("list")
.subcommand("install", Args.push("pakName", String), [Option("-S|--save")])

let result = cmd.parse("/npm install tsc --save")
console.log(result.query("install"))
```

Output as follows:

```
value=null args={"pakName":["tsc"]} options={"save":{"value":Ellipsis,"args":{}}} subcommands={}
```

## Features

* High Performance
* Simple and Flexible Constructor
* Powerful Automatic Type Parse and Conversion
* Support Synchronous and Asynchronous Actions
* Customizable Help Text Formatter, Command Analyser, etc.
* Customizable Language File, Support i18n
* Cache of input command for quick response of repeated command
* Various Features (FuzzyMatch, Command Completion, etc.)
