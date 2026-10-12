// Self-contained so Hypit's frame program and the browser preview evaluate the same drawing.
export function renderTemplateSvg(plan, template, at) {
  const { width: w, height: h } = plan
  const templateId = template.templateId || 'text-cards'
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
  const t = Math.max(0, Math.min(plan.duration, Number(at) || 0))
  const size = Math.min(w / 12, h / 15)
  const positions = { title: h * 0.14, benefit: h * 0.28, action: h * 0.83 }
  const texts = ['title', 'benefit', 'action'].map((field) => {
    const cue = plan.events.find((e) => e.field === field)
    const age = t - (cue?.start ?? 0)
    const visible = cue && age >= 0 && t <= cue.end
    const progress = Math.max(0, Math.min(1, age / 0.6))
    const opacity = !visible ? 0 : template.textMotion === 'fade' ? progress : 1
    const offset = template.textMotion === 'bounce' ? -Math.sin(progress * Math.PI * 2) * (1 - progress) * size * 0.45 : 0
    const chars = [...template[field]], lines = []
    let fontSize = size, max = Math.max(5, Math.floor(w * 0.86 / fontSize))
    while (Math.ceil(chars.length / max) * fontSize * 1.15 > h * 0.11) {
      fontSize *= 0.9; max = Math.max(5, Math.floor(w * 0.86 / fontSize))
    }
    for (let index = 0; index < chars.length; index += max) lines.push(chars.slice(index, index + max).join(''))
    return `<text x="${w / 2}" y="${positions[field] + offset}" text-anchor="middle" fill="${template[`${field}Color`]}" font-size="${fontSize}" font-weight="800" font-family="Microsoft YaHei,sans-serif" opacity="${opacity}" stroke="#132033" stroke-width="${fontSize * 0.04}" paint-order="stroke">${lines.map((line, i) => `<tspan x="${w / 2}" dy="${i ? fontSize * 1.15 : 0}">${escape(line)}</tspan>`).join('')}</text>`
  }).join('')
  const cx = w / 2, cy = h * 0.56, r = Math.min(w * 0.27, h * 0.19)
  const rotation = template.ringMotion === 'rotate' ? t * 120 : 0
  const center = templateId === 'cleanup-icon'
    ? `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="none" stroke="#ffffff" opacity="0.3" stroke-width="${r * 0.04}"/><g transform="rotate(${rotation})"><circle r="${r}" fill="none" stroke="#fde68a" stroke-width="${r * 0.065}" stroke-dasharray="${r * 1.9} ${r * 4.4}"/><circle r="${r * 0.93}" fill="none" stroke="#c4b5fd" stroke-width="${r * 0.04}" stroke-dasharray="${r * 1.5} ${r * 4.4}"/></g><g data-icon="cleanup" fill="none" stroke="#ffffff" stroke-width="${r * 0.06}" stroke-linecap="round" stroke-linejoin="round"><path d="M ${-r * 0.33} ${-r * 0.2} L ${-r * 0.27} ${r * 0.45} L ${r * 0.27} ${r * 0.45} L ${r * 0.33} ${-r * 0.2} M ${-r * 0.4} ${-r * 0.29} H ${r * 0.4} M ${-r * 0.16} ${-r * 0.29} V ${-r * 0.45} H ${r * 0.16} V ${-r * 0.29} M ${-r * 0.1} ${-r * 0.06} V ${r * 0.29} M ${r * 0.1} ${-r * 0.06} V ${r * 0.29}"/></g></g>`
    : `<g transform="translate(${cx} ${cy}) rotate(${rotation * 0.04})"><rect x="${-r * 0.78}" y="${-r * 0.48}" width="${r * 1.56}" height="${r * 0.96}" rx="${r * 0.14}" fill="#ffffff" opacity="0.2"/><rect x="${-r * 0.92}" y="${-r * 0.62}" width="${r * 1.5}" height="${r * 0.94}" rx="${r * 0.14}" fill="none" stroke="#fde68a" stroke-width="${r * 0.055}"/><circle cx="${r * 0.57}" cy="${-r * 0.36}" r="${r * 0.1}" fill="#c4b5fd"/></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" data-template="${templateId}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="新模板预览"><rect width="${w}" height="${h}" fill="${template.background}"/>${texts}${center}</svg>`
}
