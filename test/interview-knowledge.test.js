import assert from 'node:assert/strict'
import test from 'node:test'
import { interviewSystemPrompt, resumeKnowledgeBase } from '../src/interview/profile.js'

test('resume knowledge base preserves the verified target role and project evidence', () => {
  assert.equal(resumeKnowledgeBase.identity.name, '刘耀华')
  assert.equal(resumeKnowledgeBase.identity.targetRole, 'AI Agent / AI应用开发工程师')
  assert.equal(resumeKnowledgeBase.education.school, '四川大学锦江学院')
  assert.equal(resumeKnowledgeBase.education.graduation, '2027.07（预计）')

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
  assert.match(interviewSystemPrompt, /先给结论，再用简历中的具体项目或经历作证/)
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
