export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname
    if (['/api/models', '/api/sessions', '/api/chat', '/api/images'].includes(path) || path.startsWith('/api/jobs/')) return env.MODEL_API.fetch(request)
    return env.INTERVIEW_API.fetch(request)
  },
}
