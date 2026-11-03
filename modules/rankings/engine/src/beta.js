/**
 * Beta 分布分位数（零依赖），用于 Jeffreys 后验下界。
 *
 * 为什么需要它：N=3 次采样全都提到某品牌，点估计提及率是 100%，
 * 但这不能对外发布 —— 样本太小。用 Jeffreys 后验 Beta(k+0.5, N−k+0.5) 的
 * 下分位作为"置信调整可见度"（CAV），会对小样本自动打折：
 *   N=3,  k=3 → 点估计 1.00，但 95% 下界仅约 0.44
 *   N=5,  k=5 → 约 0.55
 *   N=10, k=10 → 约 0.74
 * 这是"不许拿三次采样编出第一名"的机制保证。
 *
 * 实现：Lanczos logGamma + 正则化不完全 Beta 连分式 + 二分求逆。
 * 全部确定性，无随机。
 */

const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(z) {
  if (z < 0.5) {
    // 反射公式
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const x = z - 1;
  let a = LANCZOS_C[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) a += LANCZOS_C[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** 连分式（Numerical Recipes betacf）。 */
function betacf(a, b, x) {
  const FPMIN = 1e-300;
  const EPS = 3e-12;
  const MAXIT = 300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** 正则化不完全 Beta 函数 I_x(a,b) = P(Beta(a,b) ≤ x)。 */
export function regularizedIncompleteBeta(x, a, b) {
  if (!(x >= 0) || !(x <= 1)) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Beta(a,b) 的 p 分位数（二分求逆，确定性）。 */
export function betaQuantile(p, a, b) {
  if (!(p > 0) || !(p < 1)) {
    if (p === 0) return 0;
    if (p === 1) return 1;
    return NaN;
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (regularizedIncompleteBeta(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * 置信调整可见度：Jeffreys 后验下界。
 * @param {number} k 命中次数
 * @param {number} n 采样次数
 * @param {number} [alpha] 显著性水平，默认 0.05 → 取 5% 分位
 * @returns {number|null} n<=0 时返回 null（null ≠ 0：没采样不等于表现差）
 */
export function jeffreysLowerBound(k, n, alpha = 0.05) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!Number.isFinite(k) || k < 0) return null;
  const kk = Math.min(k, n);
  return betaQuantile(alpha, kk + 0.5, n - kk + 0.5);
}

/** 小样本是否低到不该对外发布。 */
export function isReportable(n, minN = 5) {
  return Number.isFinite(n) && n >= minN;
}
