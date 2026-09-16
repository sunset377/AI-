import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentInterviewQuestionBank,
  interviewSystemPrompt,
  resumeKnowledgeBase,
} from '../src/interview/profile.js'

test('resume knowledge base preserves the verified target role and project evidence', () => {
  assert.equal(resumeKnowledgeBase.identity.name, '刘耀华')
  assert.equal(resumeKnowledgeBase.identity.targetRole, 'AI Agent / AI应用开发工程师')
  assert.equal(resumeKnowledgeBase.education.school, '四川大学')
  assert.equal(resumeKnowledgeBase.education.college, '艺术学院')
  assert.equal(resumeKnowledgeBase.education.major, '视觉传达设计')
  assert.equal(resumeKnowledgeBase.education.degree, null)
  assert.equal(resumeKnowledgeBase.education.graduation, '2026年')
  assert.deepEqual(resumeKnowledgeBase.identity.preferredWorkCities, ['上海', '杭州', '武汉'])
  assert.equal(resumeKnowledgeBase.identity.currentCity, null)
  assert.equal(resumeKnowledgeBase.identity.rolePriorities[0], 'AI Agent / 智能体应用开发')
  assert.equal(resumeKnowledgeBase.contentExperience.earlyFilm.title, null)
  assert.match(resumeKnowledgeBase.contentExperience.serialDrama.role, /不得说成每集所有环节均独立完成/)

  const projectNames = resumeKnowledgeBase.projects.map((project) => project.name)
  assert.deepEqual(projectNames, [
    'MOMOCO 服装 AI 内容工作流 / Agent 原型',
    '《小刘带你挖三星堆》互动考古工具',
    'WorkBuddy 私人AI智能体工作台',
    '个人作品集网站',
    '爆款视频复刻工作台',
    '兰州拉面门店微信小程序',
    '《星际穷途X》多模型AI短片',
  ])
})

test('interview prompt optimizes truthful answers for hiring conversations', () => {
  assert.match(interviewSystemPrompt, /主动检索、关联和归纳/)
  assert.match(interviewSystemPrompt, /教育背景、作品集、真实项目/)
  assert.match(interviewSystemPrompt, /常规问题/)
  assert.match(interviewSystemPrompt, /岗位价值/)
  assert.match(interviewSystemPrompt, /不足|短板/)
  assert.match(interviewSystemPrompt, /不得虚构/)
  assert.match(interviewSystemPrompt, /16件文物/)
  assert.match(interviewSystemPrompt, /第16版/)
  assert.match(interviewSystemPrompt, /62处图片引用/)
  assert.match(interviewSystemPrompt, /74文件/)
  assert.match(interviewSystemPrompt, /2分52秒/)
  assert.match(interviewSystemPrompt, /四川大学艺术学院/)
  assert.match(interviewSystemPrompt, /上海、杭州、武汉/)
  assert.match(interviewSystemPrompt, /约60集短剧只能说“参与\/制作”/)
  assert.match(interviewSystemPrompt, /MOMOCO 的完整自动化仍是目标/)
  assert.match(interviewSystemPrompt, /端到端自动 Agent、模型 API 自动调用/)
  assert.match(interviewSystemPrompt, /曾在小红书商品场景获得小规模真实付费订单/)
  assert.match(interviewSystemPrompt, /两版资料对毕业时间有冲突/)
  assert.doesNotMatch(interviewSystemPrompt, /四川大学视觉传达设计本科/)
  assert.doesNotMatch(interviewSystemPrompt, /23 岁/)
  assert.doesNotMatch(interviewSystemPrompt, /人物一致性 95%/)
})

test('agent interview database covers common technical and behavioral topics', () => {
  assert.ok(agentInterviewQuestionBank.length >= 14)

  const database = agentInterviewQuestionBank
    .map((item) => `${item.category} ${item.question} ${item.answerGuide}`)
    .join('\n')

  for (const topic of ['工作流', '提示词', 'RAG', '记忆', 'MCP', '幻觉', '评估', '前端', '排错', '职业规划']) {
    assert.match(database, new RegExp(topic))
  }
})
