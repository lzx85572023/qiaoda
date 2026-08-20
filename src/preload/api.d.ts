import type { QiaodaApi } from './index'

declare global {
  interface Window {
    qiaoda: QiaodaApi
  }
}

export {}
