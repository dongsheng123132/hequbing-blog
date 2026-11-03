/**
 * 回放采样通道：不联网，按预置答案依次返回。
 * 用于测试采样矩阵、断点续采与失败重试逻辑。
 */
export function replay(answers, { id = 'replay', model = 'replay-1', failOn } = {}) {
  let i = 0;
  const p = {
    id,
    model,
    calls: 0,
    async ask(prompt, ctx) {
      p.calls++;
      const n = i++;
      if (failOn && failOn(n, prompt, ctx)) throw new Error(`simulated failure #${n}`);
      return { text: answers[n % answers.length], model };
    },
  };
  return p;
}

/** 永远失败的通道，用于验证错误落盘与续采重试。 */
export function alwaysFail({ id = 'broken' } = {}) {
  let calls = 0;
  return {
    id,
    model: 'none',
    get calls() {
      return calls;
    },
    async ask() {
      calls++;
      throw new Error('upstream 500');
    },
  };
}
