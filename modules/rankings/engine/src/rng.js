/**
 * 确定性伪随机数发生器。
 *
 * 本引擎禁止使用 Math.random()：同一批样本必须永远算出同一个名次，
 * 否则"可复现"就是空话，也会给"你们偷偷调参"留下口实。
 * Bootstrap 重采样一律经由这里，且种子由输入内容派生。
 */

/** mulberry32：小巧、快、分布够用，同种子必然同序列。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32 位字符串散列，用于把任意文本（如样本 id 列表）转成稳定种子。 */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 无放回整数抽样所需的整数区间取数。 */
export function randInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

/** 有放回重采样下标：返回长度为 n 的下标数组。 */
export function bootstrapIndices(rng, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = randInt(rng, n);
  return out;
}

/** 取排序后数组的分位数（线性插值）。 */
export function quantile(sorted, q) {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
