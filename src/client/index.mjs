import React from 'react'
import { ORGANIZATION_REMOTE } from '../descriptors.mjs'
import { Workbench, OrganizationIcon } from './workbench.jsx'
import { NS, zh, en } from './locales.mjs'
import styles from './styles.css'

export const inject = ['remote', 'slots', 'uiWorkspace', 'locale']

export async function apply(ctx) {
  await ctx.remote.$mount(ORGANIZATION_REMOTE)
  const remote = ctx.get('remote.organization')
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.organization = 'workbench'
    style.textContent = styles
    document.head.appendChild(style)
    return () => style.remove()
  })
  const props = sessionId => ({ remote, sessionId: sessionId || '', t,
    locale: ctx.locale.getSnapshot().active, uiWorkspace: ctx.get('uiWorkspace') })
  // The sidebar id and main key must match, otherwise the Host cannot open the panel.
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: 'organization', order: 61, locale: NS, label: () => t('title'),
  }, OrganizationIcon))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: 'organization', locale: NS, inject: () => props(''),
  }, Workbench))
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'organization', order: 21, locale: NS,
    label: () => t('sessionTab'), inject: sessionId => props(sessionId),
  }, Workbench))
}
