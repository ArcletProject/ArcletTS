"use strict";
exports.__esModule = true;
var core_1 = require("./packages/nepattern/src/core");
var A = /** @class */ (function () {
    function A(n) {
        this.name = n;
    }
    A.prototype.toString = function () { return "A:".concat(this.name); };
    return A;
}());
var a = new A("tom");
var b = new A("jim");
var A_PAT = core_1.BasePattern.of(A);
var a_pat = core_1.BasePattern.on(a);
console.log(A_PAT.toString());
console.log(a_pat.toString());
console.log(A_PAT.exec(a));
console.log(a_pat.exec(a));
console.log(A_PAT.exec(b));
console.log(a_pat.exec(b));
var INTEGER = new core_1.BasePattern(Number, "\-?[0-9]+", core_1.PatternMode.REGEX_CONVERT, function (_, x) { return Number(x); }, "int");
var NUMBER = new core_1.BasePattern(Number, "\-?[0-9]+\.?[0-9]*", core_1.PatternMode.TYPE_CONVERT, function (_, x) { return Number(x); }, "number");
var va = INTEGER.validate("123", 123).value();
var vb = va + 12;
console.log(INTEGER.toString());
console.log(NUMBER.toString());
console.log(INTEGER.exec("123"));
console.log(INTEGER.exec("1234.5"));
console.log(NUMBER.exec("123"));
console.log(NUMBER.exec("1234.5"));
