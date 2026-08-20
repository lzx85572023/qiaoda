// 巧答移动版 · 底部导航框架

import { useState } from 'react'
import { History, Layers, Library, Settings, Sparkles } from 'lucide-react'
import GeneratePage from './pages/GeneratePage'
import ScenariosPage from './pages/ScenariosPage'
import SnippetsPage from './pages/Snippets'
import HistoryPage from './pages/History'
import SettingsPage from './pages/SettingsPage'
import appIcon from './assets/icon.png'

type Tab = 'generate' | 'scenarios' | 'snippets' | 'history' | 'settings'

const TABS: { id: Tab; name: string; icon: React.JSX.Element }[] = [
  { id: 'generate', name: '生成', icon: <Sparkles size={19} /> },
  { id: 'scenarios', name: '情景', icon: <Layers size={19} /> },
  { id: 'snippets', name: '话术', icon: <Library size={19} /> },
  { id: 'history', name: '历史', icon: <History size={19} /> },
  { id: 'settings', name: '设置', icon: <Settings size={19} /> }
]

export default function MobileApp(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('generate')

  return (
    <div className="m-root">
      <div className="m-topbar">
        <img src={appIcon} alt="" />
        <span className="name">巧答</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>AI 客服回复助手</span>
      </div>

      {tab === 'generate' && <GeneratePage />}
      {tab === 'scenarios' && <ScenariosPage />}
      {tab === 'snippets' && <SnippetsPage key="snippets" />}
      {tab === 'history' && <HistoryPage key="history" />}
      {tab === 'settings' && <SettingsPage />}

      <nav className="m-tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`m-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span>{t.name}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
