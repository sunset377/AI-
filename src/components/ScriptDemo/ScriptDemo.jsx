import { useState } from 'react'
import './ScriptDemo.css'

const SAMPLE = `雨夜。旧楼电梯停在七层，林澈收到一张写着"00:07"的陌生检修票。
林澈：这栋楼明明只有六张票。
许冬遥撑着透明伞走进大厅，把一份泛黄档案放在桌上。
监控画面忽然缺失七秒，电梯里的停止键自己亮起。
许冬遥：我们还没有做决定，但录像里的你已经按下去了。`

const STORYBOARD_URL = import.meta.env?.VITE_INTERVIEW_API_URL
  ? import.meta.env.VITE_INTERVIEW_API_URL.replace(/\/interview$/, '/storyboard')
  : '/api/storyboard'

async function generateStoryboard(scriptText) {
  const response = await fetch(STORYBOARD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script: scriptText,
    }),
  })
  if (!response.ok) throw new Error('生成暂时不可用，请稍后重试。')
  return response.json()
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
    } catch {
      setError('生成暂时不可用，请稍后重试。')
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
            maxLength={2500}
            disabled={loading}
          />
          <div className="sdEditorFoot">
            <span>导演 Skill · {text.length}/2500</span>
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
