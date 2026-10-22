import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { publicAudio, publicBoardJob, createWhiteboardApi } from '../server/whiteboard-api.js'

test('native board task response excludes paths, raw error and upstream job identity',()=>{
  assert.deepEqual(publicBoardJob({status:'done',progress:100,output_path:'private/path',client_ip:'secret',copy:'private'},'public-id'),{id:'public-id',status:'done',progress:100,result_url:'/jobs/public-id/download'})
  assert.doesNotMatch(publicBoardJob({error:'secret-token'},'id').error,/secret-token/)
})

test('audio catalog excludes private recordings and local paths', () => {
  assert.deepEqual(publicAudio([{ id: 'public', name: 'demo', transcript: 'hello', duration: 8, file: 'private-path.wav', visibility: 'demo' }, { id: 'personal', visibility: 'private' }]), [{ id: 'public', name: 'demo', transcript: 'hello', duration: 8 }])
})

test('whiteboard rejects mismatched sample audio without overwriting edited copy', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'whiteboard-'))
  try {
    await writeFile(path.join(root, 'library.json'), JSON.stringify([{ id: 'sample', visibility: 'demo', file: 'sample.wav', transcript: '这是一段已经确认的完整旁白。' }, { id: 'personal', visibility: 'private', file: 'personal.wav' }]))
    await writeFile(path.join(root, 'sample.wav'), 'fixture')
    let received, reply
    const handler = createWhiteboardApi({ root, serveFile: () => { throw new Error('Private file leaked') }, sendJson: (_, status, body) => { reply = { status, body } }, fetcher: async (url, options) => {
      if (url.endsWith('/api/config')) return Response.json({ has_api_key: true, has_image_api_key: true })
      if (url.includes('/api/styles')) return Response.json({items:[{name:'极简粗线简笔白板风',builtin:true}]})
      received = options.body
      return Response.json({ id: 'upstream123' })
    } })
    await handler({ method: 'GET' }, {}, new URL('http://localhost/api/replica/whiteboard/audio/personal'), 'a')
    assert.equal(reply.status, 404)
    const edited = new FormData(); edited.set('audioId', 'sample'); edited.set('copy', '这是用户重新编写的新文案，需要重新配音。'); edited.set('consent', 'paid-models')
    const editedWire = new Request('http://localhost', { method: 'POST', body: edited })
    const editedRequest = Readable.from([Buffer.from(await editedWire.arrayBuffer())]); editedRequest.method = 'POST'; editedRequest.headers = { 'content-type': editedWire.headers.get('content-type') }
    await handler(editedRequest, {}, new URL('http://localhost/api/replica/whiteboard/jobs'), 'a')
    assert.equal(reply.status, 409)
    assert.match(reply.body.error, /新旁白/)
    assert.equal(received, undefined)
    const form = new FormData(); form.set('audioId', 'sample'); form.set('copy', '这是一段已经确认的完整旁白。'); form.set('consent', 'paid-models')
    const wire = new Request('http://localhost', { method: 'POST', body: form })
    const request = Readable.from([Buffer.from(await wire.arrayBuffer())]); request.method = 'POST'; request.headers = { 'content-type': wire.headers.get('content-type') }
    await handler(request, {}, new URL('http://localhost/api/replica/whiteboard/jobs'), 'a')
    assert.equal(reply.status, 202)
    assert.equal(received.get('copy'), '这是一段已经确认的完整旁白。')
    assert.equal(received.get('audio_mode'), 'finished')
    const id = reply.body.id
    await handler({ method: 'GET' }, {}, new URL(`http://localhost/api/replica/whiteboard/jobs/${id}`), 'b')
    assert.equal(reply.status, 404)
  } finally { await rm(root, { recursive: true, force: true }) }
})
