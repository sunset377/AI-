import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createWhiteboardApi } from '../server/whiteboard-api.js'

test('named voice synthesizes edited text and isolates the resulting audio', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'named-narration-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(path.join(root, 'library.json'), JSON.stringify([{ id:'yaohua', name:'耀华', visibility:'demo', synthesizable:true, file:'intro.wav', referenceFile:'private.wav', referenceText:'准确参考转写', transcript:'嗨，我是耀华。' }]))
  let reply, synthesized, served, downstream
  const handler = createWhiteboardApi({root, sendJson:(_, status, body)=>{reply={status,body}}, serveFile:(_,__,file)=>{served=file},
    synthesize:async ({text, voice}, directory)=>{
      synthesized={text,voice}; const file=path.join(directory,'narration.wav');await writeFile(file,'generated-fixture');return {audioPath:file,duration:3}
    }, fetcher:async (url, options)=>{
      if(url.endsWith('/api/config'))return Response.json({has_api_key:true,has_image_api_key:true})
      if(url.includes('/api/styles'))return Response.json({items:[{name:'极简粗线简笔白板风',builtin:true}]})
      downstream=options.body;return Response.json({id:'upstream'})
    }})
  const url = suffix=>new URL('http://localhost/api/replica/whiteboard'+suffix)
  const text='这是我自己修改的新文案，请使用选定的声音来朗读。'
  const request=Readable.from([JSON.stringify({voiceId:'yaohua',text,consent:'local-f5'})]);request.method='POST'
  await handler(request,{},url('/narrations'),'owner-a')
  assert.equal(reply.status,202)
  const id=reply.body.id
  for(let i=0;i<20;i++){
    await new Promise(resolve=>setTimeout(resolve,5))
    await handler({method:'GET'},{},url('/narrations/'+id),'owner-a')
    if(reply.body.status==='done')break
  }
  assert.equal(reply.body.status,'done')
  assert.equal(synthesized.text,text)
  assert.equal(synthesized.voice.id,'yaohua')
  assert.ok(!JSON.stringify(reply.body).includes('private.wav'))
  await handler({method:'GET'},{},url('/narrations/'+id+'/audio'),'owner-b')
  assert.equal(reply.status,404)
  await handler({method:'GET'},{},url('/narrations/'+id+'/audio'),'owner-a')
  assert.ok(served.endsWith('narration.wav'))
  async function submit(overrides={}, owner='owner-a') {
    const form=new FormData()
    for(const [key,value] of Object.entries({copy:text,audioId:'yaohua',narrationId:id,narrationApproved:'true',consent:'paid-models',...overrides}))form.set(key,value)
    const wire=new Request('http://localhost',{method:'POST',body:form});const post=Readable.from([Buffer.from(await wire.arrayBuffer())]);post.method='POST';post.headers={'content-type':wire.headers.get('content-type')}
    await handler(post,{},url('/jobs'),owner)
  }
  for(const [changes, owner] of [[{copy:text+'改了。'},'owner-a'],[{audioId:'frank'},'owner-a'],[{narrationApproved:'false'},'owner-a'],[{},'owner-b']]) {
    await submit(changes, owner)
    assert.equal(reply.status,409)
    assert.equal(downstream,undefined)
  }
  await submit()
  assert.equal(reply.status,202)
  assert.equal(downstream.get('copy'),text)
  assert.equal(await downstream.get('reference').text(),'generated-fixture')
})
