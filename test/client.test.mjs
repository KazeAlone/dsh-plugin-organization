import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { unwrap, layersOf } from '../src/client/model.mjs'
import { zh, en, translator } from '../src/client/locales.mjs'
import { threeProvinces } from '../templates/three-provinces.mjs'

registerHooks({ load(url, context, next) {
  if (!url.endsWith('.jsx')) return next(url, context)
  return { format: 'module', shortCircuit: true, source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'jsx', format: 'esm' }).code }
} })
const { OrganizationChart, Workflow } = await import('../src/client/workbench.jsx')

test('client dictionary keys match and RPC failures never become successful data', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.deepEqual(unwrap({ ok: true, value: { id: 'run' } }), { id: 'run' })
  assert.throws(() => unwrap({ ok: false, error: { message: 'Access denied' } }), /Access denied/)
  assert.throws(() => unwrap({ id: 'raw' }), /Invalid organization RPC/)
})

test('workflow layout follows dependencies even when nodes are not in execution order', () => {
  const layers = layersOf(threeProvinces())
  const ids = layers.flat().map(node => node.id)
  assert.ok(ids.indexOf('delivery') < ids.indexOf('accept'))
  assert.ok(ids.indexOf('implement') < ids.indexOf('quality'))
  assert.throws(() => layersOf({ nodes: [{ id: 'bad', deps: ['bad'] }] }), /invalid dependency graph/)
})

test('organization and workflow render actual roles with escaped artifact text', () => {
  const definition = threeProvinces()
  const org = renderToStaticMarkup(React.createElement(OrganizationChart, { definition, t: translator('zh'), onSelect() {} }))
  assert.match(org, /中书省/); assert.match(org, /尚书省/); assert.match(org, /门下省/)
  assert.equal((org.match(/class="org-role /g) || []).length, 10)
  const run = { tasks: { plan: { status: 'succeeded', output: { summary: '<script>alert(1)</script>' } } } }
  const workflow = renderToStaticMarkup(React.createElement(Workflow, { definition, run, t: translator('en'), onSelect() {} }))
  assert.match(workflow, /&lt;script&gt;/); assert.equal(workflow.includes('<script>'), false)
  assert.match(workflow, /data-node-id="review"/)
})

test('published browser module stamps the right package and registers both visible entries', async () => {
  let browserModule, inserted = 0
  const effects = [], slots = [], dictionaries = []
  const document = { head: { appendChild() { inserted++ } }, createElement() { return { dataset: {}, remove() { inserted-- } } } }
  const context = vm.createContext({ window: { __ModuleLoader__: { load({ id, factory }) {
    assert.equal(id, 'dsh-plugin-organization'); browserModule = factory(name => { assert.equal(name, 'react'); return React })
  } } }, document, console })
  vm.runInContext(readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8'), context)
  let contribution
  const remote = {}
  const ctx = {
    remote: { async $mount(value) { contribution = value } },
    get(key) { if (key === 'remote.organization') return remote; if (key === 'uiWorkspace') return { openSession() {} } },
    effect(fn) { const dispose = fn(); effects.push(dispose); return dispose },
    locale: { bind: () => translator('zh'), register(namespace, values) { dictionaries.push({ namespace, values }); return () => {} }, getSnapshot: () => ({ active: 'zh' }) },
    slots: { inject(name, callback) { const dispose = callback(); effects.push(dispose) }, register(entry, component) { slots.push({ entry, component }); return () => {} } },
  }
  await browserModule.apply(ctx)
  assert.equal(inserted, 1)
  assert.equal(contribution.package, 'dsh-plugin-organization')
  assert.equal(dictionaries[0].namespace, 'organization')
  assert.equal(slots.find(slot => slot.entry.name === 'sidebar.panellist').entry.id, 'organization')
  assert.equal(slots.find(slot => slot.entry.name === 'main').entry.key, 'organization')
  const session = slots.find(slot => slot.entry.name === 'conversation.view')
  assert.equal(session.entry.inject('session').sessionId, 'session')
  for (const dispose of effects.reverse()) dispose?.()
  assert.equal(inserted, 0)
})
