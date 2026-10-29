const supportedViews = new Set(['home', 'gateway', 'portfolio', 'interview', 'replica', 'studio', 'whiteboard'])

export function readView(location) {
  const view = new URLSearchParams(location?.search ?? '').get('view') ?? 'home'
  return supportedViews.has(view) ? view : 'home'
}

export function writeView(view, modelId) {
  if (typeof window === 'undefined') return

  const nextView = supportedViews.has(view) ? view : 'home'
  const url = new URL(window.location.href)

  if (nextView === 'home') url.searchParams.delete('view')
  else url.searchParams.set('view', nextView)
  if (nextView === 'studio' && modelId) url.searchParams.set('model', modelId)
  else url.searchParams.delete('model')

  url.hash = ''
  window.history.pushState({ view: nextView }, '', url)
}
