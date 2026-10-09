import { useEffect, useMemo, useRef, useState } from 'react'
import './DirectorDemo.css'

// 示例剧本（演示用，真实运行由本地 CLI 完成）
const SAMPLE_SCRIPT = `雨夜，女主苏晚回到旧公寓，发现门没锁。
她推开门，桌上放着一封没有署名的信——
信封上，是她自己十年前的笔迹。`

const STAGES = [
  { id: 'intake', label: '输入预检' },
  { id: 'script', label: '剧本分析' },
  { id: 'assets', label: '资产规划' },
  { id: 'storyboard', label: '分镜与音色' },
  { id: 'generate', label: '多平台生成' },
  { id: 'post', label: '后期' },
  { id: 'qc', label: '质检报告' },
  { id: 'ship', label: '发布包' },
]

// 01 剧本分析
const SCRIPT_ANALYSIS = {
  core: '悬疑 / 自我对峙 · 30s 竖屏短剧开场',
  beats: ['雨夜归家', '发现门没锁（异常）', '推门', '桌上匿名信', '发现是自己十年前笔迹（钩子）'],
  characters: ['苏晚 · 女主 · 20s · 旧外套 · 疲惫但警觉'],
  scenes: ['旧公寓门外（雨夜）', '公寓内 · 桌前（暖黄台灯）'],
  props: ['公寓木门', '匿名信封', '十年前笔迹纸条'],
  sound: ['雨声底噪', '木门吱呀', '心跳渐强', '停顿 0.5s 后切黑'],
}

// 02 资产清单（状态来自 asset-manifest.json）
const ASSETS = [
  { id: 'char-suwan-front', cat: '人物', name: '苏晚 · 正脸身份锚', status: 'approved' },
  { id: 'char-suwan-side', cat: '人物', name: '苏晚 · 侧面参考', status: 'planned' },
  { id: 'scene-outside', cat: '场景', name: '公寓外 · 雨夜街道', status: 'generated' },
  { id: 'scene-inside', cat: '场景', name: '公寓内 · 桌前台灯', status: 'generated' },
  { id: 'prop-envelope', cat: '道具', name: '旧信封 + 手写字迹', status: 'approved' },
  { id: 'voice-suwan', cat: '音色', name: '苏晚 · 旁白音色（低沉/克制）', status: 'planned' },
]

// 03 分镜表
const STORYBOARD = [
  { no: '镜1', shot: '远景', action: '雨夜街道，苏晚撑伞走近公寓', dur: '5s', camera: '固定 · 缓推' },
  { no: '镜2', shot: '中景', action: '手推门，门吱呀，她停住', dur: '4s', camera: '过肩 · 手持' },
  { no: '镜3', shot: '特写', action: '桌上信封，台灯侧光', dur: '3s', camera: '微距' },
  { no: '镜4', shot: '大特写', action: '信封上自己十年前的笔迹', dur: '4s', camera: '推近 · 切黑' },
]

// 04 连接器（plan → submit → download，付费前 blocked_approval）
const CONNECTORS = [
  { name: 'LibTV CLI', role: '图像资产 / 分镜图', cost: '本地 ¥0', state: 'ready' },
  { name: 'MiniMax H3', role: '视频片段生成', cost: '已估价 · 待确认', state: 'blocked_approval' },
  { name: 'Seedance 2.x', role: '长镜头运镜', cost: 'plan 已就绪', state: 'ready' },
]

// 05 QC 报告
const QC = [
  { item: '文件可解码 / 时长 / 画幅 / 音视频流', state: 'pass' },
  { item: '首帧 · 中帧 · 末帧 · 切镜一致性', state: 'pass' },
  { item: '人物身份锚未被场景图覆盖', state: 'pass' },
  { item: '镜2→镜3 雨伞位置穿帮', state: 'fail-fix' },
  { item: '字幕时间轴 / 错字 / 安全区', state: 'pass' },
  { item: '旁白可懂度 / 音乐底噪比例', state: 'pass' },
]

const STATUS_META = {
  approved: { label: '已审核', cls: 'ok' },
  generated: { label: '已生成', cls: 'mid' },
  planned: { label: '待生成', cls: 'wait' },
  ready: { label: '就绪', cls: 'ok' },
  blocked_approval: { label: '待授权', cls: 'warn' },
}

function StageBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: 'wait' }
  return <span className={`demoBadge demoBadge--${meta.cls}`}>{meta.label}</span>
}

export default function DirectorDemo() {
  const [step, setStep] = useState(0) // 0..7
  const [running, setRunning] = useState(false)
  const timerRef = useRef(null)

  const run = () => {
    if (running) return
    setStep(0)
    setRunning(true)
  }

  useEffect(() => {
    if (!running) return undefined
    if (step >= STAGES.length - 1) {
      setRunning(false)
      return undefined
    }
    timerRef.current = window.setTimeout(() => setStep((s) => s + 1), 1100)
    return () => window.clearTimeout(timerRef.current)
  }, [running, step])

  const progressPct = useMemo(() => Math.round((step / (STAGES.length - 1)) * 100), [step])

  return (
    <section className="directorDemo" id="director" aria-label="AI 漫剧导演工作流演示">
      <div className="shell">
        <div className="demoHead">
          <div>
            <div className="sectionKicker">WORKFLOW / 流水线演示</div>
            <h2>一段剧本，怎么变成一条可发布的短剧</h2>
            <p className="demoLead">
              下面是 <b>MOMOCO AIGC Director v2.0</b> 的真实流程示意（纯前端演示，不调用付费 API）。
              点"运行"，看流水线从剧本一路走到 QC 报告——每一步的状态、证据、失败点都可见。
            </p>
          </div>
          <div className="demoControls">
            <button type="button" className="demoRunBtn" onClick={run} disabled={running}>
              {running ? '运行中…' : '▶ 运行流水线'}
            </button>
            <span className="demoPct">{progressPct}%</span>
          </div>
        </div>

        {/* 状态机条 */}
        <div className="demoStateStrip" aria-label="流水线状态机">
          {STAGES.map((s, i) => (
            <div key={s.id} className={`demoStateNode${i === step ? ' isActive' : ''}${i < step ? ' isDone' : ''}`}>
              <span className="demoStateDot" />
              <span className="demoStateLabel">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="demoBody">
          {/* 左：输入剧本 */}
          <div className="demoScriptPanel">
            <div className="demoPanelTitle">输入 · script.txt</div>
            <pre className="demoScript">{SAMPLE_SCRIPT}</pre>
            <div className="demoSpec">
              <span>竖屏 9:16</span>
              <span>中文</span>
              <span>≤ 30s</span>
              <span>抖音开场</span>
            </div>
            <div className="demoAnomaly">
              <span className="demoAnomalyTitle">异常状态机</span>
              <code>blocked_input / blocked_connector / blocked_approval / submission_uncertain / qc_failed</code>
              <small>状态为 complete 时必须附 evidence；手工改写状态不能代替产物检查。</small>
            </div>
          </div>

          {/* 右：当前阶段输出 */}
          <div className="demoOutputPanel">
            {step <= 0 && (
              <div className="demoEmpty">
                <p>⏎ 等待输入。最低要求：剧本 + 目标平台 + 画幅 + 时长。</p>
                <p className="demoEmptySub">缺少不影响结构分析的信息标记待确认；会改变人物数 / 付费额度 / 发布对象的，必须在动作前确认。</p>
              </div>
            )}

            {step === 1 && (
              <div className="demoCard">
                <h3>① 剧本分析 · script-analysis.json</h3>
                <p className="demoRow"><b>核心：</b>{SCRIPT_ANALYSIS.core}</p>
                <div className="demoRow"><b>节拍：</b>
                  <div className="demoChips">{SCRIPT_ANALYSIS.beats.map((b) => <span key={b} className="chip">{b}</span>)}</div>
                </div>
                <p className="demoRow"><b>人物：</b>{SCRIPT_ANALYSIS.characters[0]}</p>
                <p className="demoRow"><b>场景：</b>{SCRIPT_ANALYSIS.scenes.join(' · ')}</p>
                <p className="demoRow"><b>道具：</b>{SCRIPT_ANALYSIS.props.join(' · ')}</p>
                <p className="demoRow"><b>声音：</b>{SCRIPT_ANALYSIS.sound.join(' · ')}</p>
              </div>
            )}

            {step === 2 && (
              <div className="demoCard">
                <h3>② 资产规划 · asset-manifest.json</h3>
                <p className="demoHint">先做人物身份锚，再做正/侧/背；场景图不能覆盖人物锚。</p>
                <ul className="demoAssetList">
                  {ASSETS.map((a) => (
                    <li key={a.id}>
                      <span className="demoAssetCat">[{a.cat}]</span> {a.name}
                      <StageBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 3 && (
              <div className="demoCard">
                <h3>③ 分镜表 · storyboard.json</h3>
                <table className="demoTable">
                  <thead><tr><th>镜号</th><th>景别</th><th>动作</th><th>时长</th><th>运镜</th></tr></thead>
                  <tbody>
                    {STORYBOARD.map((r) => (
                      <tr key={r.no}><td>{r.no}</td><td>{r.shot}</td><td>{r.action}</td><td>{r.dur}</td><td>{r.camera}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="demoHint">音色卡先行：角色 / 情绪 / 节奏 / 授权状态；真人生成受连接器与授权约束。</p>
              </div>
            )}

            {step === 4 && (
              <div className="demoCard">
                <h3>④ 多平台生成 · generation-plan.json</h3>
                <p className="demoHint">先 plan 不花钱；提交前展示估价，付费必须当次、明确、可追溯授权。</p>
                <ul className="demoConnectorList">
                  {CONNECTORS.map((c) => (
                    <li key={c.name}>
                      <div><b>{c.name}</b> — {c.role}</div>
                      <div className="demoConnectorMeta"><span>{c.cost}</span><StageBadge status={c.state} /></div>
                    </li>
                  ))}
                </ul>
                <p className="demoHint">网络超时 → submission_uncertain：按 task_id 对账，绝不重提重复扣费。</p>
              </div>
            )}

            {step === 5 && (
              <div className="demoCard">
                <h3>⑤ 后期 · 确定性工具</h3>
                <div className="demoChips">
                  <span className="chip">转录/字幕</span>
                  <span className="chip">配音（已确认音色）</span>
                  <span className="chip">字幕烧录</span>
                  <span className="chip">初剪</span>
                  <span className="chip">混音</span>
                </div>
                <p className="demoHint">FFmpeg 只做确定性转码/拼接/烧录；它不会凭空造出准确字幕——没有可靠转录就停止语义剪辑。</p>
              </div>
            )}

            {step === 6 && (
              <div className="demoCard">
                <h3>⑥ 质检 · qc-report.json</h3>
                <ul className="demoQcList">
                  {QC.map((q) => (
                    <li key={q.item} className={`demoQcItem--${q.state}`}>
                      <span className="demoQcMark">{q.state === 'pass' ? '✓' : q.state === 'fail-fix' ? '⟳' : '·'}</span>
                      {q.item}
                      {q.state === 'fail-fix' && <em>→ 只重做镜3，不整片重拍</em>}
                    </li>
                  ))}
                </ul>
                <p className="demoHint">overall=pass 不能只由"文件存在"得出；技术可解码 ≠ 创意/合同验收通过。</p>
              </div>
            )}

            {step >= 7 && (
              <div className="demoCard demoCard--done">
                <h3>✓ ready_for_review · 发布包就绪</h3>
                <ul className="demoShipList">
                  <li>final.mp4（已下载本地 · ffprobe 通过 · SHA-256 已记录）</li>
                  <li>publish-copy.md（可复制发布文案）</li>
                  <li>qc-report.json 副本 + 素材追溯摘要</li>
                </ul>
                <p className="demoHint">默认 <code>not_published</code>：不登录、不发布、不投流，等你验收。</p>
              </div>
            )}
          </div>
        </div>

        <p className="demoFooter">
          完整生产（真实图像/视频生成、付费、登录发布）需本地 CLI 与平台凭据；此页为流程与状态设计预览。
          开源仓库链接见联系区。
        </p>
      </div>
    </section>
  )
}
