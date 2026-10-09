import { useState } from 'react'
import './ScriptDemo.css'

const SAMPLE = `雨夜。旧楼电梯停在七层，林澈收到一张写着"00:07"的陌生检修票。
林澈：这栋楼明明只有六张票。
许冬遥撑着透明伞走进大厅，把一份泛黄档案放在桌上。
监控画面忽然缺失七秒，电梯里的停止键自己亮起。
许冬遥：我们还没有做决定，但录像里的你已经按下去了。`

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''

const DIRECTOR_SYSTEM = `你是一位AI短剧导演，正在把剧本文本拆解为专业分镜执行表。参照以下格式输出每个镜头：

每个镜头必须包含：
- number: 镜头编号（如"01"）
- timeRange: 时间范围（如"0—5秒"）
- duration: 时长秒数
- scene: 场景描述
- task: 镜头任务与剧情功能（这个镜头在叙事上做什么）
- timing: 画面与时间分配（按0.000—X.XXX秒分段，写每段画面内容）
- camera: 景别机位与镜头运动（具体到焦距如85mm/50mm、角度如高俯15°/平视/仰拍、运镜如固定/缓推/跟随、快门如1/60 30fps）
- action: 人物动作与表演（具体到手势、表情、节奏）
- audio: 台词声音与灯光（旁白内容、环境音、灯光氛围）
- assets: 资产连接与生成控制（关联的角色母版C01、场景S01、道具A01等，模型参数如SD2.5 16:9 854×480，以及禁止项）

要求：
- 拆成4-8个镜头，每镜3-8秒
- 景别要有变化：大全景→中景→近景→特写交替
- 焦距、机位、运镜要具体，不要写"正常拍摄"
- 资产用C开头=角色、S开头=场景、A开头=道具编号
- 只输出JSON，不要markdown代码块，不要解释文字
- 输出格式：{"shots":[...], "assets":[...], "totalDuration":数字}`

async function generateStoryboard(scriptText) {
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: DIRECTOR_SYSTEM },
        { role: 'user', content: `请把以下剧本拆解为专业分镜执行表：\n\n${scriptText}` },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content ?? ''
  // 清理可能的markdown包裹
  const cleaned = raw.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
  return JSON.parse(cleaned)
}

export default function ScriptDemo() {
  const [text, setText] = useState(SAMPLE)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    const t = text.trim()
    if (!t || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await generateStoryboard(t)
      setResult(data)
    } catch (e) {
      setError('生成失败：' + e.message + '。请检查网络或API Key。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="scriptDemo shell" id="script-demo" aria-labelledby="script-demo-title">
      <div className="sectionHead">
        <div>
          <div className="sectionKicker">LIVE DEMO / 导演Skill在线演示</div>
          <h2 id="script-demo-title">粘贴剧本，生成专业分镜执行表</h2>
        </div>
        <p>
          基于开源 AI 漫剧导演 Skill v2.0 的逻辑：输入剧本，自动拆出每个镜头的任务、时间分配、景别机位、动作表演、台词声音和资产连接——和你片场里用的格式一致。
        </p>
      </div>

      <div className="scriptDemoGrid">
        <div className="sdEditor">
          <div className="sdPanelHead">
            <span className="sdStep">01</span>
            <strong>输入剧本</strong>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            aria-label="剧本文本"
          />
          <div className="sdEditorFoot">
            <span>本地预览 · 调用DeepSeek生成</span>
            <button type="button" onClick={run} disabled={loading}>
              {loading ? '导演拆解中…' : '生成导演预案 ↗'}
            </button>
          </div>
        </div>

        <div className="sdOutput" aria-live="polite">
          <div className="sdPanelHead">
            <span className="sdStep">02</span>
            <strong>导演输出</strong>
            <span className={`sdStatus${result ? ' isReady' : ''}`}>
              {loading ? 'ANALYZING' : result ? 'READY_FOR_REVIEW' : '等待生成'}
            </span>
          </div>

          {loading && (
            <div className="sdEmpty">
              <p className="sdLoading">导演正在拆解剧本…</p>
              <p className="sdEmptyHint">识别角色、切分镜头、配置机位与资产，约需10-20秒</p>
            </div>
          )}

          {error && <div className="sdEmpty sdError"><p>{error}</p></div>}

          {!loading && !error && !result && (
            <div className="sdEmpty">
              <p>点击"生成导演预案"，会按《时光来信》式格式输出每个镜头的6个板块。</p>
              <p className="sdEmptyHint">镜头任务 / 时间分配 / 景别机位 / 动作表演 / 台词声音 / 资产连接</p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="sdSummary">
                <div><span>镜头</span><strong>{result.shots?.length ?? 0}</strong></div>
                <div><span>预计时长</span><strong>{result.totalDuration ?? '—'}s</strong></div>
                <div><span>资产</span><strong>{result.assets?.length ?? 0}</strong></div>
              </div>

              <div className="sdShotList">
                {result.shots?.map((shot, i) => (
                  <div className="sdShotCard" key={i}>
                    <div className="sdShotHead">
                      <h3>镜头 {shot.number} <span>{shot.timeRange}</span></h3>
                      <p>{shot.scene}</p>
                    </div>
                    <div className="sdShotBody">
                      <div className="sdRow"><span className="sdLabel">镜头任务</span><p>{shot.task}</p></div>
                      <div className="sdRow"><span className="sdLabel">时间分配</span><p>{shot.timing}</p></div>
                      <div className="sdRow"><span className="sdLabel">景别机位</span><p>{shot.camera}</p></div>
                      <div className="sdRow"><span className="sdLabel">动作表演</span><p>{shot.action}</p></div>
                      <div className="sdRow"><span className="sdLabel">台词声音</span><p>{shot.audio}</p></div>
                      <div className="sdRow"><span className="sdLabel">资产连接</span><p>{shot.assets}</p></div>
                    </div>
                  </div>
                ))}
              </div>

              {result.assets?.length > 0 && (
                <div className="sdBlock">
                  <h3>资产清单</h3>
                  <div className="sdAssets">
                    {result.assets.map((a, i) => (
                      <span className="sdAsset" key={i}>
                        <b>{a.type ?? '资产'}</b>{a.name ?? a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
