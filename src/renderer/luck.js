// "How lucky am I", as a percentile among players pulling under the same rules.
// top = share of players who did better than you (ties count half), so
//   top 0.05 -> luckier than 95% of players.
// Purely for fun: it leans on community models of the rates and of Capturing Radiance.
import { pityModel, RADIANCE_SINCE } from './analysis.js'

// Capturing Radiance (5.0+), community model: chance to win a 50/50 given how many
// 50/50s were lost in a row before it. Index 3 means "3 or more".
export const RADIANCE_P = [0.5, 0.5, 0.75, 1]

export const TIERS = [
  { key: 'blessed', max: 0.05 },
  { key: 'lucky', max: 0.25 },
  { key: 'average', max: 0.75 },
  { key: 'unlucky', max: 0.95 },
  { key: 'cursed', max: 1 },
]
export const tierOf = top => TIERS.find(t => top <= t.max)?.key ?? 'cursed'

function erf(x) {
  // Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}
const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2))

const momentsCache = new WeakMap()
function moments(pmf) {
  if (!momentsCache.has(pmf)) {
    const mean = pmf.reduce((s, p, i) => s + (i + 1) * p, 0)
    const varr = pmf.reduce((s, p, i) => s + (i + 1 - mean) ** 2 * p, 0)
    momentsCache.set(pmf, { mean, sd: Math.sqrt(varr) })
  }
  return momentsCache.get(pmf)
}

// P(the k-th 5★ arrives within T pulls) = P(S_k <= T), S_k = sum of k pity counts.
// Exact convolution for small k, normal approximation (with continuity correction) above.
export function sumCdf(pmf, k, T) {
  if (k <= 0) return 1
  if (T < k) return 0
  if (k <= 40) {
    let d = new Float64Array(T + 1); d[0] = 1
    for (let i = 0; i < k; i++) {
      const nd = new Float64Array(T + 1)
      for (let s = 0; s <= T; s++) {
        if (!d[s]) continue
        for (let j = 0; j < pmf.length && s + j + 1 <= T; j++) nd[s + j + 1] += d[s] * pmf[j]
      }
      d = nd
    }
    return Math.min(1, d.reduce((a, b) => a + b, 0))
  }
  const { mean, sd } = moments(pmf)
  return normCdf((T + 0.5 - k * mean) / (sd * Math.sqrt(k)))
}

// You got N 5★ in T pulls (T may include pulls since your last 5★).
// X = 5★ a random player gets in T pulls; top = P(X > N) + P(X = N) / 2.
export function speedLuck(kind, N, T) {
  const { pmf } = pityModel(kind)
  const geN = sumCdf(pmf, N, T), gtN = sumCdf(pmf, N + 1, T)
  return { N, T, top: gtN + (geN - gtN) / 2 }
}

// 50/50s as a Poisson-binomial: each one's win chance comes from the streak before it.
export function fiftyLuck(fives) {
  const ps = []
  let w = 0
  for (const f of fives) {
    if (f.result !== 'win' && f.result !== 'lose') continue
    if (f.result === 'win') w++
    ps.push(f.time < RADIANCE_SINCE ? 0.5 : RADIANCE_P[Math.min(3, f.streakBefore ?? 0)])
  }
  let d = [1]
  for (const p of ps) {
    const nd = new Array(d.length + 1).fill(0)
    d.forEach((v, i) => { nd[i] += v * (1 - p); nd[i + 1] += v * p })
    d = nd
  }
  const gt = d.slice(w + 1).reduce((a, b) => a + b, 0)
  const expected = ps.reduce((a, b) => a + b, 0)
  return { w, n: ps.length, expected, top: ps.length ? gt + d[w] / 2 : 0.5 }
}

// Long-run 50/50 win rate under the Radiance model (stationary distribution of the streak).
export function radianceWinRate() {
  const pi = [1]
  for (let s = 1; s < RADIANCE_P.length; s++) pi.push(pi[s - 1] * (1 - RADIANCE_P[s - 1]))
  const z = pi.reduce((a, b) => a + b, 0)
  return pi.reduce((a, v, s) => a + (v / z) * RADIANCE_P[s], 0)
}

// Pulls per rate-up 5★: all pulls that produced a 5★, divided by the rate-up ones.
export function upAverage(pool) {
  const fives = pool?.fives || []
  const isUp = f => ['win', 'guaranteed', 'up', 'up_guaranteed'].includes(f.result)
  const ups = fives.filter(isUp).length
  const pulls = fives.reduce((s, f) => s + f.pity, 0)
  return { ups, pulls, avg: ups ? pulls / ups : null }
}

// Expected pulls per rate-up 5★ under the models
export function expectedUpAverage(kind) {
  const mean = pityModel(kind).mean
  if (kind === 'character') {
    return { pre: mean * 1.5, post: mean * (2 - radianceWinRate()) }   // lose -> one extra 5★
  }
  if (kind === 'weapon') return { pre: mean * 1.25, post: mean * 1.25 } // 75% rate-up, then guaranteed
  return null
}
