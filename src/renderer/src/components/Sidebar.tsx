// 巧答 · 侧边栏

import { Cpu, History, Home, Library, Plus, Settings } from 'lucide-react'
import type { Scenario } from '@shared/types'
import type { Route } from '../App'
import appIcon from '../assets/icon.png'

interface SidebarProps {
  route: Route
  scenarios: Scenario[]
  onNavigate: (r: Route) => void
}

export default function Sidebar({ route, scenarios, onNavigate }: SidebarProps): React.JSX.Element {
  const isActive = (name: Route['name'], id?: string): boolean =>
    route.name === name && (id === undefined || route.id === id)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={appIcon} alt="" draggable={false} />
        <div>
          <div className="name">巧答</div>
          <div className="ver">AI 客服回复助手</div>
        </div>
      </div>

      <nav className="sidebar-scroll">
        <div className="sidebar-section-label">工作</div>
        <button
          className={`nav-item ${isActive('home') ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'home' })}
        >
          <Home size={16} />
          <span>工作台</span>
        </button>
        <button
          className={`nav-item ${isActive('snippets') ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'snippets' })}
        >
          <Library size={16} />
          <span>话术库</span>
        </button>
        <button
          className={`nav-item ${isActive('history') ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'history' })}
        >
          <History size={16} />
          <span>历史记录</span>
        </button>

        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>情景</span>
          <button
            className="icon-btn"
            title="新建情景"
            style={{ width: 22, height: 22 }}
            onClick={async () => {
              onNavigate({ name: 'scenario' })
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {scenarios.map((s) => (
          <button
            key={s.id}
            className={`nav-item ${isActive('scenario', s.id) ? 'active' : ''}`}
            onClick={() => onNavigate({ name: 'scenario', id: s.id })}
          >
            <span className="nav-scenario-emoji">{s.emoji}</span>
            <span className="nav-scenario-name">{s.name}</span>
          </button>
        ))}
        <button
          className="nav-item"
          style={{ color: 'var(--ink-3)' }}
          onClick={() => onNavigate({ name: 'scenarios' })}
        >
          <Plus size={16} />
          <span>管理情景</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button
          className={`nav-item ${isActive('providers') ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'providers' })}
        >
          <Cpu size={16} />
          <span>模型与供应商</span>
        </button>
        <button
          className={`nav-item ${isActive('settings') ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'settings' })}
        >
          <Settings size={16} />
          <span>设置</span>
        </button>
      </div>
    </aside>
  )
}
