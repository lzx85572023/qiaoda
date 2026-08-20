/// <reference types="vite/client" />

declare global {
  interface Window {
    qiaoda: import('./lib/qiaoda').MobileBridge
  }
}

export {}
