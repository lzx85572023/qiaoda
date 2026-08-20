// 巧答 · 时间与文本工具

export function fmtTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${fmtTime(ts)}`
}

export function relTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  return fmtDateTime(ts)
}

export function todayLabel(): string {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${week}`
}

export function truncate(text: string, n: number): string {
  if (text.length <= n) return text
  return `${text.slice(0, n)}…`
}

export function firstLine(text: string, n: number): string {
  const line = text.split('\n').find((l) => l.trim()) ?? ''
  return truncate(line.trim(), n)
}
