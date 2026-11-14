// Shared bits for the analysis components.

// Result colours: three hues that stay distinguishable under the common colour-vision
// deficiencies. Every use is paired with a text label, never colour alone.
export const COLORS = {
  win: '#1baf7a',
  lose: '#eb6834',
  guar: '#2a78d6',
  neutral: '#a3a9b2',
  bar: '#5d6d86',
}

// '{n} pulls' + { n: 3 } -> '3 pulls'
export const fmt = (s, vars = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))

// result -> [label, colour class]
export function resultInfo(f, kind, text) {
  const r = text.result
  if (kind === 'chronicled') {
    if (f.result === 'up' || f.result === 'up_guaranteed') return [r.chronicledUp, f.result === 'up' ? 'win' : 'guar']
    if (f.result === 'off') return [r.chronicledOff, 'lose']
  }
  switch (f.result) {
    case 'win': return [r.win, 'win']
    case 'lose': return [r.lose, 'lose']
    case 'guaranteed': return [r.guaranteed, 'guar']
    case 'up': return [r.up, 'win']
    case 'up_guaranteed': return [r.up_guaranteed, 'guar']
    case 'off': return [r.off, 'lose']
    case 'standard': return [r.standard, 'neutral']
    default: return [r.unknown, 'neutral']
  }
}

export function legendFor(kind, text) {
  const l = text.legend
  if (kind === 'character') return [['win', l.win], ['lose', l.lose], ['guar', l.guaranteed]]
  if (kind === 'weapon') return [['win', l.weaponUp], ['lose', l.weaponOff], ['guar', l.weaponGuaranteed]]
  if (kind === 'chronicled') return [['win', l.chronicledUp], ['lose', l.chronicledOff]]
  return [['neutral', l.standard]]
}

export const POOL_ORDER = ['301', '302', '500', '200']
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
