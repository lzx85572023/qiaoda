// 巧答 · 主窗口应用框架

import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, Scenario } from '@shared/types'
import { ToastProvider } from './components/ui'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Scenarios from './pages/Scenarios'
import ScenarioEditor from './pages/ScenarioEditor'
import Snippets from './pages/Snippets'
import History from './pages/History'
import Providers from './pages/Providers'
import Settings from './pages/Settings'

export interface Route {
  name: 'home' | 'scenarios' | 'scenario' | 'snippets' | 'history' | 'providers' | 'settings'
  id?: string
}

const ROUTE_TITLES: Record<Route['name'], string> = {
  home: '工作台',
  scenarios: '情景',
  scenario: '情景',
  snippets: '话术库',
  history: '历史记录',
  providers: '模型',
  settings: '设置'
}

export default function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [version, setVersion] = useState('')

  const reloadScenarios = useCallback(async () => {
    setScenarios(await window.qiaoda.scenarios.list())
  }, [])

  useEffect(() => {
    void reloadScenarios()
    void window.qiaoda.settings.get().then(setSettings)
    void window.qiaoda.info().then((i) => setVersion(i.version))
  }, [reloadScenarios])

  const currentScenario = scenarios.find((s) => s.id === route.id) ?? null

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar route={route} scenarios={scenarios} onNavigate={setRoute} />
        <div className="main-area">
          <div className="titlebar drag">
            <span>{ROUTE_TITLES[route.name]}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {settings?.hotkey && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  快捷窗
                  <span className="kbd">{settings.hotkey.replace('Ctrl+', 'Ctrl ').replace('Alt+', 'Alt ')}</span>
                </span>
              )}
            </span>
          </div>
          <div className="page">
            {route.name === 'home' && <Home onNavigate={setRoute} version={version} />}
            {route.name === 'scenarios' && (
              <Scenarios onEdit={(id) => setRoute({ name: 'scenario', id })} />
            )}
            {route.name === 'scenario' && (
              <ScenarioEditor
                key={route.id ?? 'new'}
                id={route.id ?? null}
                onBack={() => setRoute({ name: 'scenarios' })}
                onSaved={reloadScenarios}
              />
            )}
            {route.name === 'snippets' && <Snippets scenarios={scenarios} />}
            {route.name === 'history' && <History />}
            {route.name === 'providers' && <Providers />}
            {route.name === 'settings' && <Settings onSettingsChanged={(s) => setSettings(s)} />}
            {route.name === 'scenario' && currentScenario === null && route.id && (
              <div className="page-inner" style={{ color: 'var(--ink-3)' }}>
                情景不存在或已删除
              </div>
            )}
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
