// 巧答移动版 · 应用入口

import React from 'react'
import ReactDOM from 'react-dom/client'
import { installBridge } from './lib/qiaoda'
import MobileApp from './MobileApp'
import { ToastProvider } from './components/ui'
import './styles/global.css'
import './styles/mobile.css'

// 在 React 挂载前安装 window.qiaoda 桥接
installBridge()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <MobileApp />
    </ToastProvider>
  </React.StrictMode>
)
