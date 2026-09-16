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
  assert.equal(resumeKnowledgeBase.education.graduation, '2026年')

  const projectNames = resumeKnowledgeBase.projects.map((project) => project.name)
  assert.deepEqual(projectNames, [
    '服装一键复刻爆款视频工作台',
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
