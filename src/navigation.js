const supportedViews = new Set(['gateway', 'portfolio', 'interview'])

export function readView(location) {
  const view = new URLSearchParams(location?.search ?? '').get('view') ?? 'gateway'
  return supportedViews.has(view) ? view : 'gateway'
}

export function writeView(view) {
  if (typeof window === 'undefined') return

  const nextView = supportedViews.has(view) ? view : 'gateway'
  const url = new URL(window.location.href)

  if (nextView === 'gateway') url.searchParams.delete('view')
  else url.searchParams.set('view', nextView)

  url.hash = ''
  window.history.pushState({ view: nextView }, '', url)
}
