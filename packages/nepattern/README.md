# @arcletjs/nepattern

[![Licence](https://img.shields.io/github/license/ArcletProject/NEPattern)](https://github.com/ArcletProject/NEPattern/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/ArcletProject/NEPattern/branch/master/graph/badge.svg?token=DOMUPLN5XO)](https://codecov.io/gh/ArcletProject/NEPattern)

## About

`NEPattern` (`Not-Enough-Pattern`) is a library for pattern matching and type convert in TypeScript.

## Example

```typescript
import {Pattern} from "@arcletjs/nepattern";

let pat = Pattern.of(Number)
pat.validate(13).isSuccess()  // true
pat.validate([13]).step(Boolean) // false
```

## Features

- [x] Pattern Matching
- [x] Type Convert
- [x] Type Guard
- [x] Type Check
