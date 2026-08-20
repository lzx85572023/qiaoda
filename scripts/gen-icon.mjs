// 巧答 · 图标生成脚本（纯 Node，无任何原生依赖）
// 生成 build/icon.png (512)、icon-256/48/32/16.png 以及 Windows 用 icon.ico（内嵌 PNG）
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'build')

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- 图标绘制（SSAA 超采样 + SDF） ----------
function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

function circleSDF(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r
}

function sparkleSDF(px, py, cx, cy, r) {
  // 四角星（astroid），旋转 45°
  const x = px - cx
  const y = py - cy
  const rx = (x - y) / Math.SQRT2
  const ry = (x + y) / Math.SQRT2
  const v = Math.pow(Math.abs(rx), 2 / 3) + Math.pow(Math.abs(ry), 2 / 3)
  return Math.pow(v, 3 / 2) - r
}

function triSDF(px, py, ax, ay, bx, by, cxx, cyy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cxx) * (by - cyy) - (bx - cxx) * (py - cyy)
  const d3 = (px - ax) * (cyy - ay) - (cxx - ax) * (py - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  if (!(neg && pos)) return -Infinity
  const l1 = Math.hypot(ax - bx, ay - by)
  const l2 = Math.hypot(bx - cxx, by - cyy)
  const l3 = Math.hypot(cxx - ax, cyy - ay)
  return Math.min(Math.abs(d1) / l1, Math.abs(d2) / l2, Math.abs(d3) / l3)
}

function mix(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t)
}

function drawIcon(S) {
  const SS = 4 // 超采样
  const W = S * SS
  const rgba = Buffer.alloc(S * S * 4)
  const top = [53 / 255, 118 / 255, 92 / 255] // #35765C
  const bot = [28 / 255, 68 / 255, 51 / 255] // #1C4433
  const white = [1, 1, 1]
  const green = [31 / 255, 74 / 255, 56 / 255]

  const R = 0.232 * S // 圆角
  const bubble = { cx: 0.535 * S, cy: 0.45 * S, r: 0.215 * S }
  const tail = {
    a: [0.395 * S, 0.56 * S],
    b: [0.415 * S, 0.685 * S],
    c: [0.545 * S, 0.575 * S]
  }
  const spark = { cx: 0.665 * S, cy: 0.325 * S, r: 0.062 * S }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / S
          const py = (y + (sy + 0.5) / SS) / S
          // 背景圆角方块 + 对角渐变
          const d = roundedRectSDF(px, py, 0.5, 0.5, 0.5, 0.5, R / S)
          const alpha = Math.max(0, Math.min(1, 0.5 - d * (SS / S) * 1.0))
          let col = mix(top, bot, Math.min(1, Math.max(0, (px + py) / 2 - 0.08)))
          // 气泡
          const db = circleSDF(px, py, bubble.cx / S, bubble.cy / S, bubble.r / S)
          const dt = triSDF(px, py, ...tail.a.map((v) => v / S), ...tail.b.map((v) => v / S), ...tail.c.map((v) => v / S))
          const dBubble = Math.min(db, dt)
          const bubbleAlpha = Math.max(0, Math.min(1, 0.5 - dBubble * (SS / S) * 1.0))
          if (bubbleAlpha > 0) col = mix(col, white, bubbleAlpha)
          // 星芒
          const ds = sparkleSDF(px, py, spark.cx / S, spark.cy / S, spark.r / S)
          const sparkAlpha = Math.max(0, Math.min(1, 0.5 - ds * (SS / S) * 1.2))
          if (sparkAlpha > 0 && bubbleAlpha > 0.55) col = mix(col, green, sparkAlpha)
          r += col[0] * alpha
          g += col[1] * alpha
          b += col[2] * alpha
          a += alpha
        }
      }
      const n = SS * SS
      const i = (y * S + x) * 4
      rgba[i] = Math.round((r / n) * 255)
      rgba[i + 1] = Math.round((g / n) * 255)
      rgba[i + 2] = Math.round((b / n) * 255)
      rgba[i + 3] = Math.round((a / n) * 255)
    }
  }
  return rgba
}

function drawSplash(S) {
  // 启动图：浅纸色底 + 居中品牌图标（适用于 Android 12+ 启动画面背景）
  const icon = drawIcon(Math.round(S * 0.22))
  const rgba = Buffer.alloc(S * S * 4)
  const paper = [246 / 255, 245 / 255, 241 / 255]
  const is = Math.round(S * 0.22)
  const ox = Math.round((S - is) / 2)
  const oy = Math.round((S - is) / 2)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      let r = paper[0]
      let g = paper[1]
      let b = paper[2]
      let a = 1
      if (x >= ox && x < ox + is && y >= oy && y < oy + is) {
        const si = ((y - oy) * is + (x - ox)) * 4
        const sa = icon[si + 3] / 255
        r = r * (1 - sa) + (icon[si] / 255) * sa
        g = g * (1 - sa) + (icon[si + 1] / 255) * sa
        b = b * (1 - sa) + (icon[si + 2] / 255) * sa
        a = 1
      }
      rgba[i] = Math.round(r * 255)
      rgba[i + 1] = Math.round(g * 255)
      rgba[i + 2] = Math.round(b * 255)
      rgba[i + 3] = Math.round(a * 255)
    }
  }
  return rgba
}

function makeIco(entries) {  // entries: [{ size, png }]
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const dirs = []
  let offset = 6 + 16 * count
  for (const e of entries) {
    const d = Buffer.alloc(16)
    d[0] = e.size >= 256 ? 0 : e.size
    d[1] = e.size >= 256 ? 0 : e.size
    d[2] = 0
    d[3] = 0
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(e.png.length, 8)
    d.writeUInt32LE(offset, 12)
    offset += e.png.length
    dirs.push(d)
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)])
}

mkdirSync(OUT, { recursive: true })
const sizes = [16, 32, 48, 256, 512, 1024]
const pngs = {}
for (const s of sizes) {
  const png = encodePNG(s, s, drawIcon(s))
  pngs[s] = png
  writeFileSync(join(OUT, `icon-${s}.png`), png)
}
writeFileSync(join(OUT, 'icon.png'), pngs[512])
writeFileSync(join(OUT, 'splash.png'), encodePNG(2732, 2732, drawSplash(2732)))
writeFileSync(
  join(OUT, 'icon.ico'),
  makeIco([16, 32, 48, 256].map((s) => ({ size: s, png: pngs[s] })))
)
console.log('icons generated: build/icon.png, build/icon.ico, splash.png, icon-16/32/48/256/512/1024.png')
