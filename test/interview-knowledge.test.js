import assert from 'node:assert/strict'
import test from 'node:test'
import { broadTopics, interviewSystemPrompt, resumeKnowledgeBase } from '../src/interview/profile.js'

test('interview facts separate third-party service use from personal development', () => {
  assert.equal(resumeKnowledgeBase.identity.name, '刘耀华')
  const platform = resumeKnowledgeBase.projects.find(project => project.name.includes('AIGC Hub'))
  assert.ok(platform)
  assert.match(platform.role, /第三方.*使用/)
  assert.match(platform.stage, /验收未完成/)
  assert.doesNotMatch(JSON.stringify(platform), /联合创始人|和伙伴从0到1搭|负责后端|团队权限系统/)
  assert.doesNotMatch(resumeKnowledgeBase.timeline.join('\n'), /伙伴.*搭建.*AIGC Hub/)
  assert.match(resumeKnowledgeBase.hardFacts.platform, /第三方/)
  for (const title of ['AI 漫剧导演 Skill', '时光来信', '星际穷途X', '小刘带你挖三星堆']) {
    assert.ok(resumeKnowledgeBase.projects.some(project => project.name.includes(title)), title)
  }
})

test('interview prompt keeps provenance, paid acceptance and personal-information boundaries', () => {
  assert.match(interviewSystemPrompt, /第三方中转站/)
  assert.match(interviewSystemPrompt, /付费.*验收.*未完成/)
  assert.match(interviewSystemPrompt, /不得虚构/)
  assert.match(interviewSystemPrompt, /自我介绍与项目概述不主动提及毕业学校和毕业时间/)
  assert.match(interviewSystemPrompt, /历史 AI 回答可能错误/)
  assert.match(interviewSystemPrompt, /团队产出不等于/)
  assert.ok(interviewSystemPrompt.includes(JSON.stringify(resumeKnowledgeBase, null, 2)))
})

test('starter topics span project, workflow, evaluation and behavioral conversations', () => {
  for (const topic of ['introduction', 'workflowDesign', 'problemSolving', 'tools', 'evaluation', 'cost', 'teamwork', 'weaknesses', 'plan']) {
    assert.equal(typeof broadTopics[topic], 'string')
    assert.ok(broadTopics[topic].trim())
  }
})
