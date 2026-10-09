export default {
  fetch(request, env) {
    return env.INTERVIEW_API.fetch(request)
  },
}
