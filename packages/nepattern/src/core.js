"use strict";
exports.__esModule = true;
exports.ValidateResult = exports.BasePattern = exports.PatternMode = void 0;
var utils_1 = require("./utils");
function _accept(input, patterns, types) {
    if (patterns === void 0) { patterns = null; }
    if (types === void 0) { types = null; }
    var res_p = patterns ? (patterns.filter(function (v) { return v.exec(input).isSuccess(); })).length > 0 : false;
    var res_t = types ? (types.filter(function (v) { return (0, utils_1.getClassName)(input.constructor) == v; })).length > 0 : false;
    return res_p || res_t;
}
var PatternMode;
(function (PatternMode) {
    PatternMode[PatternMode["KEEP"] = 0] = "KEEP";
    PatternMode[PatternMode["REGEX_MATCH"] = 1] = "REGEX_MATCH";
    PatternMode[PatternMode["TYPE_CONVERT"] = 2] = "TYPE_CONVERT";
    PatternMode[PatternMode["REGEX_CONVERT"] = 3] = "REGEX_CONVERT";
})(PatternMode || (PatternMode = {}));
exports.PatternMode = PatternMode;
var ResultFlag;
(function (ResultFlag) {
    ResultFlag["VALID"] = "valid";
    ResultFlag["ERROR"] = "error";
    ResultFlag["DEFAULT"] = "default";
})(ResultFlag || (ResultFlag = {}));
var ValidateResult = /** @class */ (function () {
    function ValidateResult(value, flag) {
        if (value instanceof Error)
            this._error = value;
        else
            this._value = value;
        this.flag = flag;
    }
    ValidateResult.prototype.toString = function () {
        return "ValidateResult(".concat(this.value(), ", ").concat(this.flag, ")");
    };
    ValidateResult.prototype.value = function () {
        if (this.flag == ResultFlag.ERROR || this._value == undefined)
            throw new Error("cannot access value");
        return this._value;
    };
    ValidateResult.prototype.error = function () {
        if (this.flag == ResultFlag.ERROR && this._error != undefined) {
            return this._error;
        }
        return null;
    };
    ValidateResult.prototype.isSuccess = function () {
        return this.flag === ResultFlag.VALID;
    };
    ValidateResult.prototype.isFailed = function () {
        return this.flag === ResultFlag.ERROR;
    };
    ValidateResult.prototype.orDefault = function () {
        return this.flag == ResultFlag.DEFAULT;
    };
    ValidateResult.prototype.step = function (other) {
        if (other instanceof Boolean)
            return this.isSuccess();
        if (other instanceof Function && this.isSuccess())
            return other(this.value());
        if (other instanceof BasePattern && this.isSuccess())
            return other.exec(this.value());
        if (this.isSuccess()) {
            try {
                // @ts-ignore
                return this.value() | other;
            }
            catch (msg) {
            }
        }
        return this;
    };
    ValidateResult.prototype.toBoolean = function () {
        return this.isSuccess();
    };
    return ValidateResult;
}());
exports.ValidateResult = ValidateResult;
var BasePattern = /** @class */ (function () {
    function BasePattern(origin, pattern, mode, converter, alias, previous, accepts, validators, anti) {
        if (pattern === void 0) { pattern = "(.+?)"; }
        if (mode === void 0) { mode = PatternMode.REGEX_MATCH; }
        if (converter === void 0) { converter = null; }
        if (alias === void 0) { alias = null; }
        if (previous === void 0) { previous = null; }
        if (accepts === void 0) { accepts = null; }
        if (validators === void 0) { validators = null; }
        if (anti === void 0) { anti = false; }
        if (pattern[0] == "^" || pattern[-1] == "$")
            throw Error("\u4E0D\u5141\u8BB8\u6B63\u5219\u8868\u8FBE\u5F0F ".concat(pattern, " \u5934\u5C3E\u90E8\u5206\u4F7F\u7528 '^' \u6216 '$' "));
        this.pattern = pattern;
        this.regex = new RegExp("^".concat(pattern, "$"));
        this.mode = mode;
        this.origin = origin;
        this.alias = alias;
        this.previous = previous;
        var _accepts = accepts || [];
        //@ts-ignore
        this.pattern_accepts = _accepts.filter(function (v) { return v instanceof BasePattern; });
        //@ts-ignore
        this.type_accepts = _accepts.filter(function (v) { return !(v instanceof BasePattern); });
        this.converter = converter || (function (_, x) { return mode == PatternMode.TYPE_CONVERT ? (new origin(x)) : eval(x); });
        this.validators = validators || [];
        this.anti = anti;
    }
    BasePattern.prototype.acceptsRepr = function () {
        var type_strings = [];
        type_strings.push.apply(type_strings, this.type_accepts);
        //let type_strings = this.type_accepts.copyWithin(this.type_accepts.length, 0);
        var pat_strings = this.pattern_accepts.map(function (v) { return v.toString(); });
        type_strings.push.apply(type_strings, pat_strings);
        return type_strings.join("|");
    };
    BasePattern.prototype.toString = function () {
        if (this.mode == PatternMode.KEEP) {
            return this.alias ? this.alias :
                this.type_accepts.length === 0 && this.pattern_accepts.length === 0 ? 'Any' :
                    this.acceptsRepr();
        }
        var text;
        if (this.alias)
            text = this.alias;
        else {
            if (this.mode == PatternMode.REGEX_MATCH) {
                text = this.pattern;
            }
            else if (this.mode == PatternMode.REGEX_CONVERT ||
                (this.type_accepts.length === 0 && this.pattern_accepts.length === 0))
                text = (0, utils_1.getClassName)(this.origin);
            else
                text = this.acceptsRepr() + " -> " + (0, utils_1.getClassName)(this.origin);
        }
        return "".concat(this.previous ? this.previous.toString() + ' -> ' : '').concat(this.anti ? '!' : '').concat(text);
    };
    BasePattern.of = function (type) {
        var name = (0, utils_1.getClassName)(type);
        return new BasePattern(type, "", PatternMode.KEEP, function (_, x) { return new type(x); }, name, null, [name]);
    };
    BasePattern.on = function (obj) {
        return new BasePattern(obj.constructor, "", PatternMode.KEEP, function (_, x) { return eval(x); }, String(obj), null, null, [function (x) { return x === obj; }]);
    };
    BasePattern.prototype.reverse = function () {
        this.anti = !this.anti;
        return this;
    };
    BasePattern.prototype.match = function (input) {
        if (this.mode > 0 && (0, utils_1.getClassName)(this.origin) != "String" && input.constructor == this.origin)
            //@ts-ignore
            return input;
        if ((this.type_accepts.length > 0 || this.pattern_accepts.length > 0)
            && !_accept(input, this.pattern_accepts, this.type_accepts)) {
            if (this.previous == null)
                throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u7684\u7C7B\u578B\u4E0D\u6B63\u786E"));
            input = this.previous.match(input);
            if (!_accept(input, this.pattern_accepts, this.type_accepts))
                throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u7684\u7C7B\u578B\u4E0D\u6B63\u786E"));
        }
        if (this.mode == PatternMode.KEEP)
            return input;
        if (this.mode == PatternMode.TYPE_CONVERT) {
            var res = this.converter(this, input);
            if (res == null && (0, utils_1.getClassName)(this.origin) == "Object")
                throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u4E0D\u6B63\u786E"));
            if (res.constructor !== this.origin) {
                if (this.previous == null)
                    throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u4E0D\u6B63\u786E"));
                res = this.converter(this, this.previous.match(input));
                if (res.constructor !== this.origin)
                    throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u4E0D\u6B63\u786E"));
            }
            return res;
        }
        if (!(typeof input == "string")) {
            if (this.previous == null)
                throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u7684\u7C7B\u578B\u4E0D\u6B63\u786E"));
            input = this.previous.match(input);
            if (!(typeof input == "string"))
                throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u7684\u7C7B\u578B\u4E0D\u6B63\u786E"));
        }
        var mat = input.match(this.regex);
        if (mat) {
            // @ts-ignore
            return (this.mode == PatternMode.REGEX_CONVERT ? this.converter(this, mat.length < 2 ? mat[0] : mat.slice(1)) :
                mat.length < 2 ? mat[0] : mat[1]);
        }
        throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u4E0D\u6B63\u786E"));
    };
    BasePattern.prototype.validate = function (input, _default) {
        if (_default === void 0) { _default = null; }
        try {
            var res = this.match(input);
            for (var i = 0; i < this.validators.length; i++) {
                if (!this.validators[i](res))
                    throw new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u4E0D\u6B63\u786E"));
            }
            return new ValidateResult(res, ResultFlag.VALID);
        }
        catch (e) {
            if (!_default)
                // @ts-ignore
                return new ValidateResult(e, ResultFlag.ERROR);
            // @ts-ignore
            return new ValidateResult(
            // @ts-ignore
            _default === utils_1.Empty ? null : _default, ResultFlag.DEFAULT);
        }
    };
    BasePattern.prototype.invalidate = function (input, _default) {
        if (_default === void 0) { _default = null; }
        var res;
        try {
            res = this.match(input);
        }
        catch (e) {
            return new ValidateResult(input, ResultFlag.VALID);
        }
        for (var i = 0; i < this.validators.length; i++) {
            if (!this.validators[i](res))
                return new ValidateResult(input, ResultFlag.VALID);
        }
        if (!_default) {
            // @ts-ignore
            return new ValidateResult(new utils_1.MatchFailed("\u53C2\u6570 ".concat(input, " \u4E0D\u6B63\u786E")), ResultFlag.ERROR);
        }
        // @ts-ignore
        return new ValidateResult(
        // @ts-ignore
        _default === utils_1.Empty ? null : _default, ResultFlag.DEFAULT);
    };
    BasePattern.prototype.exec = function (input, _default) {
        return this.anti ? this.invalidate(input, _default) : this.validate(input, _default);
    };
    BasePattern.prototype["with"] = function (name) {
        this.alias = name;
        return this;
    };
    return BasePattern;
}());
exports.BasePattern = BasePattern;
