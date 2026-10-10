import { canonicalize } from '@hypit/hypit/protocol'
import { sealGraphFragment } from '@hypit/hypit/author'
import { createProducerPackageFacet } from '@hypit/hypit/producer'
import { assertAttributes, assertEmptyElement, textAttribute, createMarkupSurfaceFacet } from '@hypit/hypit/markup'
import { compositionTypes, sealVisualTrack } from '@hypit/composition'
import { timelineTypes, timelineFrameCount } from '@hypit/timeline'
import { resolveTemporalContext } from '@hypit/temporal/markup'
import { htmlVisual } from '@hypit/html-program'
import { renderTemplateSvg } from '../../../../../src/replica-template-visual.js'
import { validateTemplate } from '../../../../../src/replica-template.js'

const module = { name: '@portfolio/replica-template', version: '1' }
const configType = { module, name: 'Config' }, producer = { module, name: 'render' }
const value = (data) => ({ kind: 'inline', value: canonicalize(data) })
const manifest = { format: 'hypit.module@1', ...module, dependencies: [{ module: timelineTypes.timeline.module }, { module: compositionTypes.visualTrack.module }], types: [{ name: 'Config' }], capabilities: [], producers: [{ name: 'render', inputs: [{ name: 'config', type: configType }, { name: 'timeline', type: timelineTypes.timeline }], outputs: [{ name: 'visual', type: compositionTypes.visualTrack }], needs: [] }] }
const component = { producers: [{ producer, handler: ({ inputs }) => {
  const config = inputs.config.value.value, timeline = inputs.timeline.value.value
  const { id, plan, template } = config
  const program = htmlVisual({ html: renderTemplateSvg(plan, template, 0), css: ':scope{overflow:hidden}svg{display:block;width:100%;height:100%}', data: { plan, template }, setup: `const draw=${renderTemplateSvg.toString()}; return frame=>{root.innerHTML=draw(data.plan,data.template,frame/data.plan.fps);};` })
  const track = sealVisualTrack({ id, timelineId: timeline.id, visualIr: 'hypit.visual-ir@1', presents: [{ id, order: 0, z: 0, span: { startFrame: 0, endFrameExclusive: timelineFrameCount(timeline) }, elements: [{ id: 'template', kind: 'program', order: 0, program, style: [{ name: 'position', value: 'absolute' }, { name: 'width', value: `${plan.width}px` }, { name: 'height', value: `${plan.height}px` }, { name: 'left', value: '0px' }, { name: 'top', value: '0px' }] }] }] })
  return { outputs: { visual: value(track) }, needs: {} }
} }] }
const declaration = { name: 'template', tag: 'Template', mode: 'structured', outputs: [configType, compositionTypes.visualTrack], vocabulary: { summary: 'Editable background, copy, icon and time-addressed motion.', attributes: ['id', 'config', 'timeline'].map((name) => ({ name, kind: name === 'timeline' ? 'expression' : 'literal', required: true, summary: name })), ports: [{ name: 'visual', type: compositionTypes.visualTrack, summary: 'Rebuilt graphic scene.' }] } }
const handler = ({ element, resolveReference }) => {
  assertAttributes(element, ['id', 'config', 'timeline']); assertEmptyElement(element)
  const id = textAttribute(element, 'id'), config = JSON.parse(textAttribute(element, 'config'))
  config.template = validateTemplate(config.template); config.id = id
  const plan = config.plan
  if (plan.kind !== 'template' || plan.fps !== 30 || ![plan.width, plan.height].every((n) => Number.isSafeInteger(n) && n >= 64 && n <= 1280) || !Number.isFinite(plan.duration) || plan.duration < 0.5 || plan.duration > 30 || !Array.isArray(plan.events)) throw new Error('Invalid template plan.')
  const context = resolveTemporalContext({ element, resolveReference })
  const fragment = sealGraphFragment({ inputs: [{ name: 'config', type: configType }, { name: 'timeline', type: timelineTypes.timeline }], operations: [{ id: 'render', producer, inputs: { config: { kind: 'fragment-input', name: 'config' }, timeline: { kind: 'fragment-input', name: 'timeline' } }, result: { kind: 'output', name: 'visual' } }], exports: [{ name: 'visual', type: compositionTypes.visualTrack, root: { kind: 'fragment-operation', operation: 'render' } }] })
  return { records: [{ id: `${id}.config`, type: configType, value: value(config), range: element.range }], fragments: [fragment], components: [{ id, fragment: fragment.id, inputs: { config: { kind: 'record', id: `${id}.config` }, timeline: context.timeline.ref }, outputs: { visual: `${id}.visual` }, range: element.range }], exports: [`${id}.visual`] }
}
export default { format: 'hypit.package@1', modules: [{ manifest }], facets: [createProducerPackageFacet(component), createMarkupSurfaceFacet({ module, declaration, handler })] }
