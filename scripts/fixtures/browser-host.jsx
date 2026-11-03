import React from 'react'
import { createRoot } from 'react-dom/client'

const slots = [], effects = [], dictionaries = new Map()
const language = new URLSearchParams(location.search).get('lang') || 'zh'
const sessionMode = new URLSearchParams(location.search).get('session') === '1'
window.__openedSessions = []
const remote = new Proxy({}, { get(_target, method) {
  return async (...args) => {
    const response = await fetch('/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) })
    return response.json()
  }
} })
const ctx = {
  remote: { async $mount(contribution) { window.__remoteDescriptors = contribution.descriptors.map(item => item.method) } },
  get(key) {
    if (key === 'remote.organization') return remote
    if (key === 'uiWorkspace') return { openSession(value) { window.__openedSessions.push(value) } }
  },
  effect(fn) { const dispose = fn(); effects.push(dispose); return dispose },
  locale: {
    bind(namespace) { return key => dictionaries.get(namespace)?.[language]?.[key] || key },
    register(namespace, values) { dictionaries.set(namespace, values); return () => dictionaries.delete(namespace) },
    getSnapshot: () => ({ active: language }),
  },
  slots: {
    inject(_name, fn) { effects.push(fn()) },
    register(entry, component) { slots.push({ entry, component }); return () => {} },
  },
}
window.__ModuleLoader__ = { load({ id, factory }) {
  if (id !== 'dsh-plugin-organization') throw new Error('Wrong module id')
  window.__organizationClient = factory(name => {
    if (name === 'react') return React
    throw new Error(`Unexpected browser external: ${name}`)
  })
} }
window.startPreview = async () => {
  await window.__organizationClient.apply(ctx)
  const sidebar = slots.find(slot => slot.entry.name === 'sidebar.panellist')
  const surface = slots.find(slot => slot.entry.name === (sessionMode ? 'conversation.view' : 'main'))
  const props = surface.entry.inject(sessionMode ? 'project-session' : '')
  const root = createRoot(document.getElementById('root'))
  function Shell() {
    const [opened, setOpened] = React.useState(sessionMode)
    return <div>
      <div style={{ background: '#f0ece5', padding: '8px 18px', color: '#786d60', fontSize: 11, display: 'flex', alignItems: 'center', gap: 18 }}>
        <span>DSH contract fixture · simulated runtime</span>
        <button style={{ display: 'flex', gap: 7, alignItems: 'center', background: '#fffdf9', color: '#5c4c38', border: '1px solid #ddd3c3', borderRadius: 6, padding: '6px 10px' }}
          onClick={() => setOpened(true)}>{React.createElement(sidebar.component, { size: 16 })}{sidebar.entry.label()}</button>
      </div>
      {opened ? React.createElement(surface.component, props) : <p style={{ padding: 40 }}>Open the organization entry above.</p>}
    </div>
  }
  root.render(<Shell/> )
  window.disposePreview = () => { root.unmount(); for (const dispose of effects.reverse()) dispose?.() }
}
