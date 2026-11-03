import { createServer } from 'node:http'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { SqliteStore, OrganizationEngine } from '../src/index.mjs'
import { OrganizationHostApi } from '../src/host-api.mjs'
import { OrganizationUiApi } from '../src/ui-api.mjs'
import { ORGANIZATION_DESCRIPTORS } from '../src/descriptors.mjs'
import { threeProvinces } from '../templates/three-provinces.mjs'

// This fixture drives the actual published browser bundle and real kernel with a mock Runtime.
mkdirSync('.cache', { recursive: true })
await build({ entryPoints: ['scripts/fixtures/browser-host.jsx'], outfile: '.cache/browser-host.js', bundle: true, platform: 'browser', format: 'iife' })
const store = new SqliteStore(':memory:')
const attempts = new Map()
const engine = new OrganizationEngine(store, {
  async execute({ node, run, inputs, signal }) {
    const key = `${run.id}/${node.id}`
    const count = (attempts.get(key) || 0) + 1
    attempts.set(key, count)
    await new Promise((resolveWait, reject) => {
      const timer = setTimeout(resolveWait, run.requirement.includes('取消测试') ? 3000 : 35)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Cancelled')) }, { once: true })
    })
    if (run.requirement.includes('失败测试') && node.id === 'plan' && count === 1) throw new Error('模拟后端暂时不可用')
    if (node.kind === 'review') return {
      summary: node.id === 'review' ? '方案范围与验收条件已完成独立审议。' : '交付物及验证记录已核对。',
      decision: node.id === 'review' && count === 1 ? 'reject' : 'approve',
      reason: count === 1 ? '请补充明确的验收标准和测试命令。' : '验收条件明确，可以执行。',
      subjectDigest: inputs[node.subject].digest,
    }
    return { summary: node.id === 'plan' ? '为任务列表增加状态筛选，保留现有数据结构，并补充筛选行为测试。' : `${node.id} 的职责已执行，结果已记录。`,
      artifacts: { acceptance: ['可按状态筛选', '保留全部任务入口', '测试通过'], note: '模拟执行，无模型调用' } }
  },
})
const owner = { id: 'project-session', session: { header: { title: '任务管理器', cwd: '/Users/loong/Developer/projects/taskboard' } } }
const api = new OrganizationHostApi(engine, threeProvinces({ humanApproval: true }), id => id === owner.id ? owner : undefined, async () => owner.session.header.cwd)
const ui = new OrganizationUiApi(api, () => [owner])
const allowed = new Map(ORGANIZATION_DESCRIPTORS.map(item => [item.method, item]))
const routes = { uiOverview: 'overview', uiSnapshot: 'snapshot', uiStart: 'start', uiCancel: 'cancel', uiResume: 'resume', uiRetry: 'retry', uiApprove: 'approve' }
const server = createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/rpc') {
    response.setHeader('Content-Type', 'application/json')
    try {
      let body = ''; for await (const chunk of request) body += chunk
      const { method, args } = JSON.parse(body)
      const descriptor = allowed.get(method)
      assert.ok(descriptor); assert.equal(args.length, descriptor.parameters.length)
      args.forEach((value, index) => descriptor.parameters[index].codec.create().parse(value))
      response.end(JSON.stringify({ ok: true, value: await ui[routes[method]](...args, { peer: { principal: { kind: 'owner' } } }) }))
    } catch (error) { response.end(JSON.stringify({ ok: false, error: { code: error.code || 'ERROR', message: error.message } })) }
    return
  }
  const pathname = request.url.split('?')[0]
  if (pathname === '/host.js' || pathname === '/client.js') {
    response.setHeader('Content-Type', 'text/javascript')
    response.end(readFileSync(pathname === '/host.js' ? '.cache/browser-host.js' : 'dist/client.js')); return
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Organization UI fixture</title></head><body style="margin:0"><div id="root"></div><script src="/host.js"></script><script src="/client.js"></script><script>startPreview()</script></body></html>')
})
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
const url = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ORGANIZATION_CHROMIUM_PATH ? { executablePath: process.env.ORGANIZATION_CHROMIUM_PATH } : {}) })
  const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await page.getByRole('button', { name: '组织工作台', exact: true }).click()
  await page.getByText('还没有组织任务', { exact: true }).waitFor()
  await page.getByRole('button', { name: /中书省/ }).click()
  await page.locator('.org-detail h2').filter({ hasText: '中书省' }).waitFor()
  await page.screenshot({ path: '.cache/organization-overview.png', fullPage: true })
  async function startTask(requirement) {
    await page.getByRole('button', { name: '＋ 新建任务', exact: true }).click()
    await page.getByLabel('项目会话', { exact: true }).selectOption('project-session')
    await page.getByLabel('任务需求', { exact: true }).fill(requirement)
    await page.getByRole('button', { name: '启动组织', exact: true }).click()
  }
  await startTask('为当前项目增加任务状态筛选，并验证原有功能。')
  await page.locator('.org-summary .org-status').filter({ hasText: '等待批准' }).waitFor({ timeout: 15000 })
  await page.locator('[data-node-id="authorize"]').click()
  const approve = page.getByRole('button', { name: '批准此版本', exact: true })
  assert.equal(await approve.isDisabled(), true)
  await page.screenshot({ path: '.cache/organization-approval.png', fullPage: true })
  await page.getByLabel('我已检查当前版本的方案及产物', { exact: true }).check()
  await approve.click()
  await page.locator('.org-summary .org-status').filter({ hasText: '已完成' }).waitFor({ timeout: 15000 })
  await page.locator('[data-node-id="plan"]').click()
  assert.equal(await page.locator('.org-detail .org-attempt').count(), 2)
  await page.getByRole('button', { name: '活动记录', exact: true }).click()
  await page.getByText('审议驳回', { exact: true }).waitFor()
  await page.getByRole('button', { name: '运行流程', exact: true }).click()
  await page.screenshot({ path: '.cache/organization-run.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '.cache/organization-mobile.png', fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile layout must not overflow horizontally')
  await page.setViewportSize({ width: 1480, height: 1100 })
  await startTask('取消测试：验证停止组织任务')
  await page.locator('.org-summary .org-status').filter({ hasText: '运行中' }).waitFor()
  await page.getByRole('button', { name: '取消任务', exact: true }).click()
  await page.getByRole('button', { name: '确认取消', exact: true }).click()
  await page.locator('.org-summary .org-status').filter({ hasText: '已取消' }).waitFor({ timeout: 15000 })
  await startTask('失败测试：检查修复后重试')
  await page.locator('.org-summary .org-status').filter({ hasText: '已阻断' }).waitFor({ timeout: 15000 })
  await page.locator('[data-node-id="plan"]').click()
  await page.getByLabel('说明已修复的问题或重试原因', { exact: true }).fill('后端已恢复，允许创建新的执行尝试')
  await page.getByRole('button', { name: '重试失败节点', exact: true }).click()
  await page.locator('.org-summary .org-status').filter({ hasText: '等待批准' }).waitFor({ timeout: 15000 })
  await page.goto(`${url}/?lang=en&session=1`)
  await page.getByRole('heading', { name: 'Organization', exact: true }).waitFor()
  assert.equal(await page.locator('.org-run-card').count(), 3)
  await page.getByRole('button', { name: 'Open owner session', exact: true }).click()
  assert.deepEqual(await page.evaluate(() => window.__openedSessions), ['project-session'])
  assert.deepEqual(errors, [])
  await page.evaluate(() => window.disposePreview())
  console.log('Browser UI smoke passed: visible entry, role details, task start, version approval, event history, attempts, cancellation, retry, English/session view, mobile layout and teardown.')
  console.log(`Screenshots: ${resolve('.cache')}`)
} finally {
  await browser?.close()
  await new Promise(resolveClose => server.close(resolveClose))
  await engine.close(); store.close()
}
