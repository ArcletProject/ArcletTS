/**
 * 一个 text 没有被任何参数匹配成功
 */
export class ParamsUnmatched extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamsUnmatched";
  }
}

/**
 *  组件内的 Args 参数未能解析到任何内容
 */
export class ArgumentMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentMissing";
  }
}

/**
 * 构造 alconna 时某个传入的参数不正确
 */
export class InvalidParam extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParam";
  }
}

/**
 * 传入了无法解析的消息
 */
export class NullMessage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NullMessage";
  }
}

/**
 * 给出的消息含有不期望的元素
 */
export class UnexpectedElement extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnexpectedElement";
  }
}

/**
 * 执行失败
 */
export class ExecuteFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecuteFailed";
  }
}


/**
 * 注册的命令数量超过最大长度
 */
export class ExceedMaxCount extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExceedMaxCount";
  }
}

/**
 * 行为执行被停止
 */
export class BehaveCancelled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BehaveCancelled";
  }
}

/**
 * 越界行为
 */
export class OutBoundsBehave extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutBoundsBehave";
  }
}

/**
 * 模糊匹配成功
 */
export class FuzzyMatchSuccess extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FuzzyMatchSuccess";
  }
}


/**
 * 解析状态保存触发
 */
export class PauseTriggered extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PauseTriggered";
  }
}

/**
 * 内置选项解析触发
 */
export class SpecialOptionTriggered extends Error {
  constructor(public handler: (...args: any[]) => any) {
    super("SpecialOptionTriggered");
    this.handler = handler;
    this.name = "SpecialOptionTriggered";
  }
}
