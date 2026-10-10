export function templateSupport(request) {
  try {
    const { program: p, range } = request.constraints
    // shortcut: only self-contained 30fps graphics, extend the Provider before admitting source media.
    if (['artifacts', 'surfaces', 'frameSources'].some((key) => !Array.isArray(p[key]) || p[key].length) || p.frameRate.numerator !== 30 || p.frameRate.denominator !== 1 || !Number.isSafeInteger(p.frameCount) || p.frameCount < 1 || p.frameCount > 900 || ![p.canvas.width, p.canvas.height].every((n) => Number.isSafeInteger(n) && n >= 64 && n <= 1280 && n % 2 === 0)) throw new Error()
    if (range && (!Number.isSafeInteger(range.startFrame) || !Number.isSafeInteger(range.endFrameExclusive) || range.startFrame < 0 || range.endFrameExclusive > p.frameCount || range.startFrame >= range.endFrameExclusive)) throw new Error()
    return { status: 'supported' }
  } catch { return { status: 'unsupported', reason: 'Template Provider accepts only self-contained 30fps graphics up to 1280px and 30 seconds.' } }
}
