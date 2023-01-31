"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.getClassName = exports.Empty = exports.MatchFailed = exports.AllParam = void 0;
var _All = /** @class */ (function () {
    function _All() {
    }
    _All.prototype.toSting = function () {
        return "AllParam";
    };
    return _All;
}());
var Empty = Symbol("Empty");
exports.Empty = Empty;
// const Empty = undefined;
var AllParam = new _All();
exports.AllParam = AllParam;
var MatchFailed = /** @class */ (function (_super) {
    __extends(MatchFailed, _super);
    function MatchFailed(msg) {
        var _this = _super.call(this, msg) || this;
        _this.name = 'MatchFailed';
        return _this;
    }
    return MatchFailed;
}(Error));
exports.MatchFailed = MatchFailed;
function getClassName(constructor) {
    var code = constructor.toString();
    return code.split(' ')[1].split('(')[0];
}
exports.getClassName = getClassName;
