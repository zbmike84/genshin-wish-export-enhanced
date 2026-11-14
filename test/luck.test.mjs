import test from 'node:test'
import assert from 'node:assert/strict'
import { sumCdf, speedLuck, fiftyLuck, tierOf, radianceWinRate, upAverage, expectedUpAverage } from '../src/renderer/luck.js'
import { pityModel } from '../src/renderer/analysis.js'

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`)

test('sumCdf: exact single draw matches the pity model', () => {
  const m = pityModel('character')
  close(sumCdf(m.pmf, 1, 73), m.pmf.slice(0, 73).reduce((a, b) => a + b, 0), 1e-12, 'k=1')
  close(sumCdf(m.pmf, 1, 90), 1, 1e-12, 'hard pity')
  assert.equal(sumCdf(m.pmf, 3, 2), 0)
})

test('sumCdf: normal approximation agrees with exact convolution around the switch-over', () => {
  const { pmf, mean } = pityModel('character')
  for (const T of [Math.round(41 * mean) - 150, Math.round(41 * mean), Math.round(41 * mean) + 150]) {
    // k=40 exact vs k=41 approx shifted by one mean draw should be in the same ballpark
    const exact40 = sumCdf(pmf, 40, T - Math.round(mean))
    const approx41 = sumCdf(pmf, 41, T)
    close(exact40, approx41, 0.05, `T=${T}`)
  }
})

test('speedLuck: an exactly average account sits near the middle', () => {
  const { mean } = pityModel('character')
  const r = speedLuck('character', 100, Math.round(100 * mean))
  close(r.top, 0.5, 0.08, 'top')
  assert.ok(speedLuck('character', 100, 5000).top < 0.01, 'very fast is very lucky')
  assert.ok(speedLuck('character', 100, 8000).top > 0.99, 'very slow is very unlucky')
})

test('speedLuck counts dry pulls since the last 5★', () => {
  assert.ok(speedLuck('character', 10, 620 + 85).top > speedLuck('character', 10, 620).top)
})

test('fiftyLuck: fair coin, Radiance and empty input', () => {
  const pre = [{ result: 'win', time: '2023-01-01' }, { result: 'lose', time: '2023-01-02' }]
  const r = fiftyLuck(pre)
  assert.equal(r.n, 2)
  close(r.top, 0.5, 1e-12, 'one of two')
  // after 3 losses in a row a win is certain under the model, so it isn't luck
  const sure = fiftyLuck([{ result: 'win', time: '2025-01-01', streakBefore: 3 }])
  close(sure.top, 0.5, 1e-12, 'certain win')
  assert.equal(fiftyLuck([]).top, 0.5)
})

test('tiers and expectations', () => {
  assert.equal(tierOf(0.01), 'blessed')
  assert.equal(tierOf(0.2), 'lucky')
  assert.equal(tierOf(0.5), 'average')
  assert.equal(tierOf(0.9), 'unlucky')
  assert.equal(tierOf(0.99), 'cursed')
  close(radianceWinRate(), 16 / 29, 1e-12, 'stationary win rate')
  const e = expectedUpAverage('character')
  close(e.pre, 93.4, 0.2, 'pre-5.0')
  close(e.post, 90.2, 0.2, 'post-5.0')
  close(expectedUpAverage('weapon').post, 66.6, 0.2, 'weapon')
  const u = upAverage({ fives: [{ result: 'lose', pity: 80 }, { result: 'guaranteed', pity: 20 }, { result: 'win', pity: 50 }] })
  assert.deepEqual([u.ups, u.pulls, u.avg], [2, 150, 75])
})
