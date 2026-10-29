const assetPath = (path) => `${import.meta.env.BASE_URL}${path}`

const projects = [
  {
    title: 'PixelFit · AI 像素健身房',
    subtitle: '可交互健身小游戏 · 浏览器直接试玩',
    type: 'mini',
    image: 'assets/pixelfit-user-cover-20261029.jpg',
    meta: '四位原创角色 / 器械归位 / 饮食分类 / 睡眠与热身',
    description: '围绕原创健身角色制作的竖屏互动小游戏。选择角色后进入个人健身房，在限时器械归位中完成 22 件器械分类，也可以体验饮食分类、睡眠恢复和拳击热身；进度保存在当前浏览器。',
    href: 'pixelfit/',
    actionLabel: '打开 PixelFit · 立即试玩',
  },
  {
    title: '达州升华 · 3D 门店漫游',
    subtitle: 'V4 结构白模 · 浏览器直接体验',
    type: 'product',
    image: 'dazhou-store/preview.png',
    meta: 'Codex / Blender / Three.js / 旋转缩放 / 店内漫游',
    description: '依据门店图纸制作墙体、地面、双入口、转角侧窗与仓库隔墙，用 Blender 输出 GLB，并通过 Three.js 实现视角切换、电脑和手机漫游。本版用于前期空间方案预演；墙厚及部分洞口尺寸待复核，不含货架和软装，不作为施工交付。',
    href: 'dazhou-store/',
    actionLabel: '打开 3D 门店 · 自由漫游',
  },
  {
    title: 'MineFlow · 矿山智慧运输调度',
    subtitle: '可交互业务 Demo · 浏览器直接体验',
    type: 'product',
    image: 'assets/mineflow-preview.png',
    meta: '需求 / 车辆推荐 / 人工派单 / 排队 / 称重 / 异常 / 看板',
    description:
      '基于公开招聘场景开发的运输调度演示：创建需求、确认车辆推荐、推进运输、处理超载与故障，再核对电子磅单和运营指标。全部为模拟数据，每位访客使用独立浏览器会话；不包含真实司机接单 App 或生产设备接入。',
    href: 'mineflow/',
    actionLabel: '进入 MineFlow · 开始90秒互动演示',
  },
  {
    title: '定制化视频工作流 · 预言',
    subtitle: '已跑通的定时任务 · 同系列、不同选题',
    type: 'product',
    image: 'assets/production/cover-hualong.png',
    meta: '定时调度 / 系列风格 / 视频与发布包',
    href: '#workflow',
    actionLabel: '查看生产流程',
    description:
      '将选题、脚本、画面制作、字幕、配乐和发布文案串成可复用的内容生产流程，已跑通定时任务，并完成塞翁失马、愚公移山、画龙点睛等系列视频。先用样片确认风格，再按不同选题组织生产；内容交付与平台发布分别检查。',
  },
  {
    title: '量产样片 · 愚公移山',
    subtitle: '同一条生产线 · 实际样片',
    type: 'video',
    image: 'assets/production/cover-yugong.png',
    preview: 'assets/production/preview-yugong-30-40.mp4',
    previewLabel: '10 秒自动预览',
    meta: 'Vox 风格 / 横版精选 / 10 秒片段',
    description:
      '以“愚公移山”为主题的工作流样片，呈现画面制作、重点字词字幕与剪辑节奏。这里展示既有 10 秒精选视频及系列封面，制作方法见上方工作流案例。',
  },
  {
    title: 'AI 漫剧导演工作流',
    subtitle: 'MOMOCO AIGC Director · 开源 Agent 流水线 v2.0',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-004.webp',
    meta: '剧本→资产→分镜→多平台API→后期→QC · 全程状态机',
    description:
      '独立投入 3 个月进行 AI 漫剧导演开发与测试，最终沉淀为标准化导演 Skill：根据剧本自动确认人物、道具与资产，生成资产图和分镜，编写分时段强制提示词，并通过失败样本持续校准，视频抽卡成功率达到 90%。工作流保留人工审核与授权闸门，失败可对账、可重试、可复现。',
    href: '#script-demo',
    actionLabel: '在线演示 · 粘贴剧本即出分镜',
  },
  {
    title: '《星际穷途 X》',
    subtitle: '个人科幻比赛项目 · AI 导演',
    type: 'video',
    image: 'assets/starry-destitute-cover.jpg',
    preview: 'assets/starry-preview-113-130.mp4',
    previewLabel: '17 秒精选预览',
    meta: '2′52″ 成片 / 科幻叙事 / 多模型协作',
    description:
      '统筹世界观、美术资产、分镜、AI 生成与后期交付，建立双模型提示词体系、负面提示词库与版本记录；围绕角色与画面一致性多轮校准，验证复杂 AIGC 项目的全流程组织能力。',
  },
  {
    title: '品牌产品宣传片',
    subtitle: '生活方式产品广告 · 10 秒精选',
    type: 'video',
    image: 'assets/brand-promo-preview-cover.jpg',
    preview: 'assets/brand-promo-preview-37-47.mp4',
    previewLabel: '10 秒精选预览',
    meta: '居家 / 户外 / 通勤 / 1280×720',
    description:
      '通过居家品尝、户外分享与通勤场景，串联产品在不同生活节奏中的使用情境；本站展示原片 37—47 秒精选片段。',
    href: 'assets/brand-promo-preview-37-47.mp4',
    actionLabel: '打开 10 秒视频',
  },
  {
    title: '爆款视频复刻工作台',
    subtitle: 'Hypit 本地剪辑 · 原片低成本复刻',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-006.webp',
    meta: '原片保留 / 开头节奏 / 字幕包装 / MP4 导出',
    description:
      '保留参考视频画面，用 Hypit 调整开头与剪辑节奏，再添加字幕和蓝紫视觉包装。浏览器先看效果，本地执行器制作真实 MP4；默认不调用付费视频模型。',
    view: 'replica',
    href: '?view=replica',
    actionLabel: '打开视频复刻工作台',
  },
  {
    title: 'AI创作聚合平台',
    subtitle: '第三方模型服务 · 个人智能体接入实践',
    type: 'product',
    image: 'assets/aigc-hub-product.png',
    meta: '多模型对话 / 图像 / 视频 / 创作工具',
    description:
      '作为客户充值使用的第三方中转站，不是本人开发的平台。个人作品集在自己的工作台中整合模型目录、智能体和 Skill；聊天与图片的真实付费验收尚未完成，视频体验保持锁定。',
    href: '?view=studio',
    view: 'studio',
    actionLabel: '在工作台查看模型',
  },
  {
    title: '《时光来信》· 屈臣氏 185 周年',
    subtitle: '国家级三等奖 · AIGC 商业比赛',
    type: 'video',
    image: 'assets/competition/shiguang-cover.png',
    preview: 'assets/production/preview-shiguang-0-10.mp4',
    previewLabel: '10 秒自动预览',
    meta: '国家级三等奖 / 185 周年命题 / 竖屏成片 + A3 海报×3',
    description:
      '屈臣氏 185 周年 AIGC 命题比赛国家级三等奖作品。以“一封跨越 185 年的信”为叙事，用 AI 生成民国药铺与现代药房跨时空对照的成片，配套《跨越 / 抵达 / 陪伴》三张 A3 海报与 AIGC 制作报告，从分镜、角色一致性到品牌氛围统一走完整链路。',
  },
  {
    title: '小刘带你挖三星堆',
    subtitle: '线上互动考古工具 · 小红书已发布',
    type: 'mini',
    image: 'assets/sanxingdui-tool-cover.jpg',
    meta: 'H5 / 1927—今天 / 16 件文物互动探索 / 离线可运行',
    description:
      '把线下讲解中的提问、看展顺序与文物知识，转成可自己推进的互动考古体验。迭代至第 16 版，检查 62 处图片引用与离线资源完整性后交付。',
    href: 'sanxingdui/',
    actionLabel: '打开互动工具',
  },
  {
    title: '镜面落日 · 六帧视觉系列',
    subtitle: '个人视觉创作 · 连续画面',
    type: 'image',
    image: 'assets/mirror-sunset/scene-01.jpg',
    meta: '落日 / 倒影 / 超现实场景',
    description: '以落日、倒影与超现实宴席组织的六幅连续画面，探索同一主题下的视觉变化。',
    href: '#style',
    galleryGroup: 'mirrorSunset',
    actionLabel: '查看六张组图',
  },
].map((project) => ({
  ...project,
  image: assetPath(project.image),
  preview: project.preview ? assetPath(project.preview) : undefined,
  href: project.view || project.href?.startsWith('https://') || project.href?.startsWith('#')
    ? project.href
    : project.href ? assetPath(project.href) : undefined,
}))

const projectOrder = [
  'PixelFit · AI 像素健身房',
  '达州升华 · 3D 门店漫游',
  'MineFlow · 矿山智慧运输调度',
  '定制化视频工作流 · 预言', '量产样片 · 愚公移山', 'AI 漫剧导演工作流',
  '小刘带你挖三星堆', '品牌产品宣传片', '《星际穷途 X》',
  '《时光来信》· 屈臣氏 185 周年',
  'AI创作聚合平台', '爆款视频复刻工作台', '镜面落日 · 六帧视觉系列',
]
projects.sort((a, b) => projectOrder.indexOf(a.title) - projectOrder.indexOf(b.title))

const projectSummaries = {
  'PixelFit · AI 像素健身房': '选择原创角色进入个人健身房，体验器械归位、饮食分类、睡眠恢复和拳击热身。',
  '达州升华 · 3D 门店漫游': '从门店图纸到可旋转、缩放、进入行走的 3D 空间白模，支持电脑与手机。',
  'MineFlow · 矿山智慧运输调度': '从业务需求、车辆推荐与人工派单，到排队、称重、异常和运营看板的可交互调度演示。',
  '定制化视频工作流 · 预言': '以已跑通的定时任务与系列样片，展示从选题到成片、封面和发布文案的生产方法。',
  '量产样片 · 愚公移山': '同一套工作流的实际视频，直接查看画面风格、字幕和剪辑节奏。',
  'AI 漫剧导演工作流': '独立开发测试 3 个月，沉淀从剧本、人物道具资产到分镜和分时段提示词的标准化导演 Skill。',
  '小刘带你挖三星堆': '把文物知识和考古时间线，做成可以直接打开体验的互动 H5。',
  '品牌产品宣传片': '围绕产品使用场景组织镜头，展示营销视频与生活方式内容的制作能力。',
  '《星际穷途 X》': '个人科幻比赛项目：从世界观、美术资产到分镜和完整成片。',
  '《时光来信》· 屈臣氏 185 周年': '屈臣氏 185 周年 AIGC 命题比赛国家级三等奖，包含成片、三张海报与制作说明。',
  'AI创作聚合平台': '第三方模型服务接入实践：在个人工作台中整合入口，真实付费验收尚未完成。',
  '爆款视频复刻工作台': '本地剪辑与包装演示，将参考视频、字幕和制作结果组织成一个工作台。',
  '镜面落日 · 六帧视觉系列': '在同一主题下探索色彩、构图与连续画面的表达。',
}

const schematicCovers = {
  'AI 漫剧导演工作流': { label: 'DIRECTOR WORKFLOW', title: '让镜头有叙事，\n让角色有连续性。', items: ['剧本分析', '角色与场景', '分镜制作', '后期交付'] },
  '爆款视频复刻工作台': { label: 'VIDEO WORKBENCH / 本地演示', title: '从参考素材，\n到剪辑与交付。', items: ['参考视频', '剪辑包装', '字幕', 'MP4 导出'] },
}

const galleryGroups = [
  {
    id: 'dailyLife',
    label: '生活方式组图',
    count: 6,
    description: '围绕日常状态与情绪片段展开的连续视觉叙事',
  },
  {
    id: 'characterSketch',
    label: '角色设定草图',
    count: 8,
    description: '以同一角色为核心的造型、姿态与道具设定探索',
  },
  {
    id: 'portraitStudy',
    label: '人物肖像',
    count: 2,
    description: '自然光与生活感人物肖像练习',
  },
  {
    id: 'mirrorSunset',
    label: '镜面落日组图',
    count: 6,
    description: '落日、倒影与超现实宴席的连续画面',
  },
  {
    id: 'portrait',
    label: '竖幅作品',
    count: 49,
    description: '人物、角色、服装与叙事型竖幅视觉',
  },
  {
    id: 'landscape',
    label: '横幅作品',
    count: 21,
    description: '世界观、角色设定与宽幅视觉方案',
  },
  {
    id: 'square',
    label: '方形作品',
    count: 7,
    description: '肖像、插画与方形构图实验',
  },
]

const landscapeShots = new Set([4, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 29, 45, 46, 50, 51, 52, 53, 54, 55])
const squareShots = new Set([1, 2, 3, 28, 63, 66, 78])
const excludedArchiveShots = new Set([31, 32, 33, 34, 35, 36])

const archiveShots = Array.from({ length: 83 }, (_, index) => index + 1)
  .filter((number) => !excludedArchiveShots.has(number))
  .map((number) => {
    const categoryId = landscapeShots.has(number)
      ? 'landscape'
      : squareShots.has(number)
        ? 'square'
        : 'portrait'
    const group = galleryGroups.find((item) => item.id === categoryId)

    return {
      id: `selected-${String(number).padStart(3, '0')}`,
      title: `视觉作品 · ${String(number).padStart(2, '0')}`,
      category: group.label,
      categoryId,
      description: group.description,
      src: assetPath(`assets/portfolio-gallery/gallery-${String(number).padStart(3, '0')}.webp`),
    }
  })

const mirrorSunsetTitles = [
  '暮色长桌',
  '临水而立',
  '宴席延展',
  '镜中来者',
  '离席时刻',
  '余晖回望',
]

const latestCreationGroups = [
  {
    categoryId: 'dailyLife',
    category: '生活方式组图',
    description: '围绕日常状态与情绪片段展开的连续视觉叙事',
    prefix: 'daily',
    titles: ['早安被窝', '自我护理', '蓝天下听歌', '深夜学习', '披萨治愈', '星空下做梦'],
  },
  {
    categoryId: 'characterSketch',
    category: '角色设定草图',
    description: '以同一角色为核心的造型、姿态与道具设定探索',
    prefix: 'character',
    titles: ['角色动作设定', '滑板造型设定', '街头造型设定', '摄影角色设定', '服装轮廓设定', '道具互动设定', '音乐角色设定', '耳机造型设定'],
  },
  {
    categoryId: 'portraitStudy',
    category: '人物肖像',
    description: '自然光与生活感人物肖像练习',
    prefix: 'portrait',
    titles: ['晨光饮品', '被窝与猫'],
  },
]

const latestCreationShots = latestCreationGroups.flatMap((group) =>
  group.titles.map((title, index) => ({
    id: `${group.prefix}-${String(index + 1).padStart(2, '0')}`,
    title,
    category: group.category,
    categoryId: group.categoryId,
    description: group.description,
    src: assetPath(`assets/latest-creations/${group.prefix}-${String(index + 1).padStart(2, '0')}.webp`),
  })),
)

const styleShots = [
  ...archiveShots,
  ...mirrorSunsetTitles.map((title, index) => ({
    id: `mirror-sunset-${String(index + 1).padStart(2, '0')}`,
    title: `镜面落日 · ${title}`,
    category: '镜面落日组图',
    categoryId: 'mirrorSunset',
    description: '落日、倒影与超现实宴席的连续画面',
    src: assetPath(`assets/mirror-sunset/scene-${String(index + 1).padStart(2, '0')}.jpg`),
  })),
  ...latestCreationShots,
]

export { projects, projectSummaries, schematicCovers, galleryGroups, styleShots }
