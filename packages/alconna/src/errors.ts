/**
 * 一个 text 没有被任何参数匹配成功
 */
class ParamsUnmatched extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamsUnmatched";
  }
}

/**
 *  组件内的 Args 参数未能解析到任何内容
 */
class ArgumentMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentMissing";
  }
}

/**
 * 构造 alconna 时某个传入的参数不正确
 */
class InvalidParam extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParam";
  }
}

/**
 * 传入了无法解析的消息
 */
class NullMessage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NullMessage";
  }
}

/**
 * 给出的消息含有不期望的元素
 */
class UnexpectedElement extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnexpectedElement";
  }
}

/**
 * 执行失败
 */
class ExecuteFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecuteFailed";
  }
}


/**
 * 注册的命令数量超过最大长度
 */
class ExceedMaxCount extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExceedMaxCount";
  }
}

/**
 * 行为执行被停止
 */
class BehaveCancelled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BehaveCancelled";
  }
}

/**
 * 越界行为
 */
class OutBoundsBehave extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutBoundsBehave";
  }
}

/**
 * 模糊匹配成功
 */
class FuzzyMatchSuccess extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FuzzyMatchSuccess";
  }
}

/**
 * 补全触发
 */
class CompletionTriggered extends Error {

  constructor(message: string) {
    super(message);
    this.name = "CompletionTriggered";
  }
}

/**
 * 解析状态保存触发
 */
class PauseTriggered extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PauseTriggered";
  }
}

/**
 * 内置选项解析触发
 */
class SpecialOptionTriggered extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecialOptionTriggered";
  }
}

export {
  ParamsUnmatched,
  ArgumentMissing,
  InvalidParam,
  NullMessage,
  UnexpectedElement,
  ExecuteFailed,
  ExceedMaxCount,
  BehaveCancelled,
  OutBoundsBehave,
  FuzzyMatchSuccess,
  CompletionTriggered,
  PauseTriggered,
  SpecialOptionTriggered
}
