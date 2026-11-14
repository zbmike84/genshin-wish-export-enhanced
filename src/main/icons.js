// Character / weapon icons, fetched on demand from the paimon-moe repository and cached
// next to the app in userData/icons. They are HoYoverse game assets, so they are not
// shipped in this repository.
const { ipcMain } = require('electron')
const fetch = require('electron-fetch').default
const path = require('path')
const fs = require('fs-extra')
const { userDataPath } = require('./utils')

const cacheDir = path.join(userDataPath, 'icons')
// jsDelivr first: raw.githubusercontent.com is often unreachable from mainland China
const SOURCES = [
  'https://cdn.jsdelivr.net/gh/MadeBaruna/paimon-moe@main/static/images',
  'https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/static/images',
]
const SAFE_ID = /^[a-z0-9_-]+$/
const failed = new Set()   // don't hammer the network for ids that 404 this session

async function download(id, folder) {
  for (const base of SOURCES) {
    try {
      const res = await fetch(`${base}/${folder}/${id}.png`, { timeout: 15000 })
      if (!res.ok) continue
      const buf = await res.buffer()
      // PNG signature check, so an HTML error page never lands in the cache
      if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return buf
    } catch (e) { /* try next source */ }
  }
  return null
}

async function getIcon(id, type, offline) {
  if (!SAFE_ID.test(id)) return null
  const file = path.join(cacheDir, `${id}.png`)
  try {
    return await fs.readFile(file)
  } catch (e) { /* not cached */ }
  if (offline || failed.has(id)) return null
  const buf = await download(id, type === 'w' ? 'weapons' : 'characters')
  if (!buf) { failed.add(id); return null }
  await fs.outputFile(file, buf)
  return buf
}

// items: [{ id, t: 'c' | 'w' }] -> { id: dataURL }
// offline: only return what is already cached (instant), so the UI can show those first
ipcMain.handle('GET_ICONS', async (event, items, { offline = false } = {}) => {
  const out = {}
  const queue = [...new Map((items || []).map(i => [i.id, i])).values()]
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const buf = await getIcon(item.id, item.t, offline)
      if (buf) out[item.id] = `data:image/png;base64,${buf.toString('base64')}`
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return out
})
