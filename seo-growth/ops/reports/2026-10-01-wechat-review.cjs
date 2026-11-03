// Local, read-only source audit + editorial title screening. No publication.
// Run: node seo-growth/ops/reports/2026-10-01-wechat-review.cjs
// Output files are new snapshots; existing reports are never overwritten.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sourceRoot = 'C:/1new-code/个人找工作和兼职合作-anytingchina';
const articleDir = path.join(sourceRoot, 'wechat_articles');
const linksPath = path.join(sourceRoot, 'wechat_articles_links.json');
const repoRoot = path.resolve(__dirname, '../../..');
const existingPosts = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/posts.json'), 'utf8'));
const rawLinks = fs.readFileSync(linksPath);
const links = JSON.parse(rawLinks.toString('utf8'));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const norm = s => (s.match(/[\p{L}\p{N}]/gu) || []).join('').toLowerCase();
const files = fs.readdirSync(articleDir).filter(f => f.endsWith('.html')).sort();
const categories = {
  P0: '优先取正文的候选',
  P1: '补证据或改写后考虑',
  MERGE: '合并、更新旧页或维护说明',
  HOLD: '暂不纳入本轮 SEO/GEO 主线',
};
const annotations = new Map();
function add(ids, category, topic, reason, action, queries, requiredEvidence, existingSlug = null) {
  for (const id of ids) {
    if (annotations.has(id)) throw new Error('Duplicate editorial ID: ' + id);
    if (existingSlug && !existingPosts.some(p => p.slug === existingSlug)) throw new Error('Unknown existing slug: ' + existingSlug);
    annotations.set(id, { category, topic, reason, action, proposedQueries: queries,
      requiredEvidence, existingSlug, assessmentBasis: 'title_only', approvedToPublish: false });
  }
}

const themes = [
  { ids: [22], name: 'CAD AI 实战', headline: 'CAD 图纸 AI 识别：如何生成可复核的对象清单',
    reason: '标题指向具体交付问题与可复核输出，适合建立 CAD AI 项目能力的证据。',
    action: '候选实战案例，连接官网作品展示与相关服务；取得正文与原始结果后再定稿。',
    queries: ['CAD AI 图纸识别', 'AI 识别 CAD 门窗', 'CAD AI 项目开发'],
    evidence: '样本格式、对象定义、人工基准、源图与输出、运行记录、失败样本；7 与 168 是标题自述，未独立核实。' },
  { ids: [38], name: 'OpenCodex', headline: 'OpenCodex：本地多终端 AI 编程工作台的设计与使用',
    reason: '清晰的产品名、开发过程和实际功能，有机会承接作品品牌词与使用问题。',
    action: '建立或完善作品说明，连接官网已有 OpenCodex 展示与项目仓库。',
    queries: ['OpenCodex', '本地多终端 AI 编程工作台', 'Claude Code Codex 分屏'],
    evidence: '当前仓库与版本、可运行下载、使用截图、限制、与作者的关系；4.7 MB 需对应实际版本。' },
  { ids: [21], name: 'DSH 任务护照', headline: 'DSH 任务护照：更换 AI 后如何继续同一个任务',
    reason: '标题提出一个具体技术问题，并给出自己开发的命名方案。',
    action: '候选技术实战，按问题、结构、恢复流程和演示结果组织。',
    queries: ['DSH 任务护照', 'AI 跨模型任务续接', 'AI 任务状态迁移'],
    evidence: '仓库、稳定产品名、任务护照样本、换模型前后记录、冲突与失败边界；不要表述为普遍保证。' },
  { ids: [30, 58], name: 'U-King 安装与使用', headline: 'U-King AI 装机管家：安装流程、支持工具与使用边界',
    reason: '与已有作品和服务直接相关；安装问题比宽泛的操作系统比喻更具体。',
    action: '优先补充现有 U-King 文章和作品入口，不照原样新增两篇同主题介绍。',
    queries: ['U-King', 'AI 工具一键安装', 'Claude Code Codex 安装'],
    evidence: '当前版本、干净 Windows 安装记录、支持范围、联网与模型调用条件；区分装机工具与完整操作系统。',
    existingSlug: 'uking-usb-ai-installer' },
  { ids: [83], name: 'U-Hermes', headline: 'U-Hermes：便携 AI 工作环境的上手流程与限制',
    reason: '具体作品发布与使用场景，比泛泛讨论 AI 红利更接近作品搜索。',
    action: '候选作品说明；先确认目前产品名称、下载与维护状态，再确定独立页或生态模块。',
    queries: ['U-Hermes', 'Hermes Agent U 盘', '便携 AI 工作环境'],
    evidence: '当前名称与品牌归属、版本、下载地址、支持系统、联网/账户要求、与 U-Claw 的区别。' },
  { ids: [86, 89], name: 'U-Claw 安全与用户反馈', headline: 'U-Claw 的权限边界与使用反馈：部署前需要确认什么',
    reason: '安全疑问与具体用户体验可以支撑作品可信度；反馈仅在核实后可作证据。',
    action: '形成安全说明与反馈模块，回链现有 U-Claw 文章；案例与安全指导分别标明来源。',
    queries: ['U-Claw 安全吗', '龙虾 U 盘权限', 'U-Claw 使用体验'],
    evidence: '真实权限设置、数据流向、云端调用条件、反馈原文与公开引用范围；本地不等于自动安全。',
    existingSlug: 'u-claw-usb-offline-ai' },
  { ids: [94], name: 'AI 草图转效果图', headline: 'AI 草图转效果图实战：输入、结果与人工修正',
    reason: '标题指向本人动手做的可展示结果，适合作品案例与具体需求搜索。',
    action: '候选视觉实战；展示原图、结果、工具、过程和失败边界，连接相关服务。',
    queries: ['AI 草图转效果图', 'AI 建筑效果图', 'AI 设计图实战'],
    evidence: '原图与成图的公开使用范围、工具版本、提示/参数、耗时、人工修正；不宣称可替代全部 PS 或渲染流程。' },
  { ids: [3, 96], name: '贺去病商业咨询与上门服务', headline: '贺去病 AI 商业咨询：服务内容、交付物与合作流程',
    reason: '直接回答贺去病是谁、提供什么服务、如何合作，承接个人品牌与服务需求。',
    action: '合成官网 /services 与 /about 的补充材料；必要时配一篇正式服务说明。',
    queries: ['贺去病 AI 咨询', '企业 AI 落地顾问', 'AI 上门落地服务'],
    evidence: '实际服务范围、交付物、流程、服务地区、费用口径、在用联系方式与已公开案例；未知地区和收益不补写。' },
  { ids: [4, 20, 73], name: '陪伴式 FDE', headline: '陪伴式 FDE：企业 AI 落地中的职责、交付与合作边界',
    reason: '个人方法与服务模式清晰，可解释与客户长期协作时具体做哪些事。',
    action: '合成一个方法/服务主题，链接官网服务页；把 AI 员工总经理等比喻换成可检查职责。',
    queries: ['陪伴式 FDE', '企业 AI 落地 FDE', 'AI 落地长期顾问'],
    evidence: '阶段目标、交付清单、合作节奏、客户与顾问责任、可公开经历；不能把陪伴承诺写成收益保证。' },
  { ids: [12], name: '中国通项目', headline: '中国通：从一个实际业务问题到 AI 产品的开发过程',
    reason: '标题包含自己的命名产品与个人经历，可能支持差异化的作品和作者身份。',
    action: '取得正文后确认产品实际功能与定位，再决定作品页或开发实战。',
    queries: ['中国通 AI', '贺去病 中国通', '中国通 项目开发'],
    evidence: '当前产品地址/仓库、作者归属、真实业务问题、已实现与规划功能的区分；不能继承其他项目的城市或服务事实。' },
  { ids: [1, 97], name: 'GEO 与 AI 营销方法', headline: '企业如何让目标客户在 AI 搜索中找到你：方法与验证',
    reason: '与咨询需求有关，但只有过程和案例支持时才能成为方法证据。',
    action: '合并为一个方法主题；写清目标客户、查询、内容证据与如何测量，不提供买排名承诺。',
    queries: ['企业 GEO 优化', 'AI 搜索品牌可见性', '贺去病 GEO 咨询'],
    evidence: '真实查询与原始搜索回答、引用 URL、观测日期、案例过程；90% 未有样本依据前不作为事实。' },
  { ids: [79], name: 'AI 商业协同过程', headline: '一次 AI 商业协同流程的公开记录：做了什么、如何验证',
    reason: '有机会积累第一手过程资料，但标题只表示决定做，不能据此认定已经完成。',
    action: '先整理真实记录；若仍是计划，发布为进度日志并写清状态，不能写成完成案例。',
    queries: ['AI 商业协同流程', 'AI 业务自动化实战', 'AI 经营流程验证'],
    evidence: '过程记录、输入与产物、人工参与、成本和失败、当前状态；涉及客户信息需确认可公开范围。' },
];
themes.forEach(t => add(t.ids, 'P0', t.name, t.reason, t.action, t.queries, t.evidence, t.existingSlug));

const secondWave = [
  [11, 'AI 操作软件', '具备架构主题相关性，标题预测需要具体实现支撑。', ['AI 操作软件', 'GUI CLI AI 接口'], '已有实现、接口示例、适用和不适用场景，不把预测写成既成事实。'],
  [19, '本地模型部署', '标题过短，尚无法确认模型与项目；读正文后再决定。', ['本地模型部署'], '真实模型名称、权重来源、许可、硬件、部署记录；分清 GPT 品牌与其他模型。'],
  [23, '模型实测', '费用和亲测过程可能有价值，但标题中的模型名和水平对比尚未核实。', ['DeepSeek 模型实测', 'AI 模型任务对比'], '模型精确标识、日期、任务集、参数、原始结果、失败记录、费用；单次测试不外推综合水平。'],
  [24, 'AI 科研机', '命名作品值得追踪，先区分概念、演示与已交付能力。', ['AI 科研工作流', 'AI 科研机'], '公开项目、可运行样例、实际实验结果、目前状态；用研究计划或原型准确标注。'],
  [27, 'AI 组装方案', '可联系自己的装机工作，最大等愿景不能当现实业绩。', ['AI 工作环境搭建', 'AI 组装机'], '实际架构、部署记录、成本口径、用户任务，不虚构规模。'],
  [31, '本象协议', '作品相关性很高，但站内已有介绍，适合技术增量而非换标题重发。', ['本象协议', '2Origin', 'AI 原生数据格式'], '当前规范、样本、验证脚本和版本差异；已发页先核对再补充。', 'benxiang-protocol'],
  [34, 'AI GUI / ActionParity', '若有公开协议和实现，可转成开发者技术文章。', ['AI GUI', 'ActionParity', 'AI 软件接口设计'], '公开协议/代码、示例、设计取舍；宣言与可运行能力分开。'],
  [44, 'AI 编程上手', '具体工具与使用者问题相关，优先写可完成任务而非就业保证。', ['Claude Code 入门', 'Codex 入门'], '实际任务、教程、评估方式和结果；不把学习工具等同于就业效果。', 'codex-cli-chinese-tutorial'],
  [45, 'AI 工具使用条件', '可以回答真实使用问题，但需结合当前支持条件重写。', ['AI 编程工具选择', 'Claude Code 使用条件'], '当前官方支持条件、合法可用替代方案和实测，不承诺绕过服务限制。'],
  [48, '待正文确认的办公工具', '标题无法识别产品，不能直接认定属于某个作品。', [], '先确认正文中的工具、作者关系和实际产物，再选择关键词与承接页。'],
  [49, 'Codex 使用方法', '可改为操作教程，已有 Codex 中文教程应先考虑补充。', ['Codex 使用教程', 'Codex 中文教程'], '当前版本、具体操作任务、步骤和限制，减少汽车比喻。', 'codex-cli-chinese-tutorial'],
  [51, 'AI 培训方法', '培训方向可与服务有关，但需要课程与练习才能成立。', ['企业 AI 培训', 'AI 实战训练'], '真实课程、练习、目标人群、交付物；就业与收益不作保证。'],
  [60, 'AI 科研工作流', '可能支撑科研作品群，先取当前可运行成果。', ['AI 科研工作流', '科研自动化'], '具体作品名、公开实验、人工复核和边界，探索计划不要包装成科研结论。'],
  [63, '校园 AI 实验', '若有实际活动记录，可形成第一手案例；标题只表示决定做。', ['AI 实践教学', 'AI 校园实验'], '日期、实际活动、公开材料和结果；不把学校场景写成官方合作背书。'],
  [67, 'Windows AI 环境', '故障经历能转为故障排查指南，全体用户判断缺乏依据。', ['Windows AI 工具部署', 'AI 工具环境排错'], '真实故障日志、系统版本、解决过程、可重复步骤；不从个人样本外推用户比例。'],
  [74, '本地与云端模型选择', '是长期用户问题，学历类比应换成任务、成本和隐私条件。', ['本地模型 云端模型 对比', 'AI 模型部署选择'], '同任务实测、硬件、费用、数据边界；给出适用条件而非统一结论。'],
  [85, 'OpenClaw 任务设计', '改成具体任务方法可能有用，高手等评价没有证据价值。', ['OpenClaw 使用方法', 'AI Agent 任务设计'], '任务样例、工具组合、结果和失效条件。'],
  [87, '人与 AI 协作', '可以改为需求描述与确认流程方法，概念本身不承接作品词。', ['AI 需求描述', 'AI 协作流程'], '真实需求例子、反馈过程、前后产物；避免空泛比喻。'],
  [91, 'AI 工作方法', '标题没有具体工具或任务，需要正文中的可操作方法。', ['AI 工具使用方法'], '任务、操作、对照结果和边界，不能仅以使用更多权限或成本作为答案。'],
  [93, '营销诊断', '与业务咨询相关，须补本人观察或可复核案例。', ['企业营销诊断', 'AI 营销策略'], '问题定义、案例、分析过程和实际结果；与 001/097 方法主题合并评估。'],
  [95, '产品销售诊断', '可承接咨询问题，但标题不能证明方法有独特价值。', ['产品卖不出去怎么办', '企业营销咨询'], '真实案例、渠道/定价/定位分析、观测结果，不虚构成功率。'],
];
secondWave.forEach(([id, topic, reason, queries, evidence, slug]) =>
  add([id], 'P1', topic, reason, '取得正文后补证据、减少比喻与标题夸张；能补现有页时优先更新。', queries, evidence, slug));

const merges = [
  [5, 'AI 常驻工作环境', 'AI 住房时代主题已在网站发布，先核对是否有新实测。', 'ai-housing-era', '有增量时更新原页；Mac mini / Omarchy 对比需实测，不能只替换比喻。'],
  [6, 'AI 常驻工作环境', 'Omarchy 可作为工作环境主题的具体子节，先核对软件事实。', 'ai-housing-era', '补实际安装、任务与兼容性；十亿是愿景，不作为用户统计。'],
  [14, 'AI 常驻工作环境', '与已有 AI 住房时代文章主题相近，避免同观点多次新发。', 'ai-housing-era', '先做正文对照；若没有新增实验，合并为已有页的补充。'],
  [25, '长程 AI 计算机', '站内已经有几乎同题文章；标题相似不等于正文完全重复。', 'long-term-ai-computer-challenge', '核对更新内容与实验记录；全球首台不能当作独立认证。'],
  [29, '本象技能发布', '站内存在规范化后相同标题的文章，优先更新版本和安装方法。', 'benxiang-skills-launch', '逐段核对正文；只有实质变化才更新日期。'],
  [56, 'U-Claw 定位', '产品比喻可用于品牌说明，但站内已有 U-Claw 正式介绍。', 'u-claw-usb-offline-ai', '提取真实使用价值与边界，补现有产品页。'],
  [59, 'U-Claw 创作理念', '创作理念与其他虾盘文章重叠，主线应落在产品和用户任务上。', 'u-claw-usb-offline-ai', '保留少量作者观点；能补实际案例时再使用。'],
  [65, 'U-Claw 上手方法', 'AI 教练车是产品定位比喻，适合转换为上手流程。', 'u-claw-usb-offline-ai', '更新初次使用任务、步骤、工具与结果。'],
  [69, 'U-Claw 市场辨识', '销售额与市场数字尚无证据，不适合直接迁移成品牌业绩。', 'u-claw-usb-offline-ai', '去掉无依据金额，区分作者产品与其他团队；可补正式辨识说明。'],
  [70, 'U-Claw 市场辨识', '标题明确是听说，不能把传闻写成自己的收入证据。', 'u-claw-usb-offline-ai', '只提取可核验的产品差异，未经核实的传闻不进入作品主张。'],
  [75, '便携环境说明', '谣言相关内容若有技术澄清，可补入当前文档/FAQ。', 'u-claw-usb-offline-ai', '核对原始技术问题与当前实现；避免以争论作为主要标题。'],
  [77, '官方名称与来源说明', '声明应保留可核查版本，适合统一官方来源页而非普通 SEO 文章。', null, '与 082/088 核对名称、时间和状态；旧声明保留日期，不制造法律结论。'],
  [78, 'U-Claw 入门', '普通人使用场景可补已有产品页，不必新增一篇泛红利文章。', 'u-claw-usb-offline-ai', '替换为具体任务、使用步骤、成本与限制。'],
  [82, '官方名称与来源说明', '与其他命名声明同主题，需要保留历史版本与当前说明。', null, '整理当前名称、官方仓库、下载和联系渠道；旧公告保留历史日期。'],
  [88, '官方产品辨识与支持', '适合作为官网支持/官方渠道说明，不能据标题认定他方违法事实。', null, '仅使用可核实产品来源和检测结果；诉求与事实分开，不扩大原始声明。'],
];
merges.forEach(([id, topic, reason, slug, action]) =>
  add([id], 'MERGE', topic, reason, action, [], '必须先恢复正文并对照原始依据；合并主题并不意味着已经验证重复或主张。', slug));

const holdReasons = {
  2: '老板竞争的比喻性标题，可作为咨询素材，缺具体作品或案例指向。',
  7: '城市与创业环境评论，当前不直接承接 AI 服务与作品问题。',
  8: '城市评价主题，先保留公众号观点，不作为当前服务主线。',
  9: '城市与参会感想，若有具体项目成果可另行提取。',
  10: '供应商行业趋势评论，标题没有本人作品或实测指向。',
  13: '宏观生意机会主题；可提供观点，但当前先建设自己的作品证据。',
  15: '赛事评审争论，不能替代作品与交付证明。',
  16: '公开建议应保留原始语境，当前不作为服务获客文章。',
  17: '赛事评价主题，相关事实与措辞需完整正文才能审核。',
  18: '赛事争论的标题与当前作品、服务搜索主题关联弱。',
  26: '致歉通知属于历史公告，先保留日期与语境，不用作常青选题。',
  28: '招募/探索计划，先保留计划属性；有实际研究产物后再形成项目实战。',
  32: '愿景性比喻，正文未知，当前优先具体产品能力。',
  33: '标题不足以识别内容，暂缓；若正文是实际协议/工具，再调整分类。',
  35: '泛行业概念，没有具体任务和本人作品指向。',
  36: '大范围预测与百分比尚未有依据，当前优先可复核成果。',
  37: '供应商观点评论，缺少亲测或作者产品的明确标题信号。',
  39: '模型发布与十年预测偏时效，当前不作为作品主线。',
  40: '系列比喻与经营观点，可作作者观点档案，不作为首批作品页。',
  41: '区域产业愿景，若正文有具体自研软硬件再提取案例。',
  42: '行业竞争的大话题，当前先写本人提供的具体方案。',
  43: '就业比喻性文章，优先选 044 的具体工具与任务切入。',
  46: '神话类比的观点文，当前缺少搜索任务与作品指向。',
  47: 'Web3 青年议题与当前 AI 咨询/作品主线关联较弱。',
  50: '技术时代思考，先保留观点渠道；有本人项目可另写实战。',
  52: '升学/成长议题，尚未确认相应服务或作品。',
  53: '外部公司站台的时效新闻，须原始出处核实；不是本人作品证据。',
  54: '2026 夏季活动计划，日期已过去；有实施记录时可转复盘。',
  55: '泛工作心法，当前标题不含可操作任务或可核验成果。',
  57: '公众人物与宏观议题，和当前作品/服务主题关联弱。',
  61: '大学生成长与社会观点，当前不作为服务和作品承接页。',
  62: '高考前限时邀约，不能改日期重新包装为当前活动。',
  64: '城市创业环境评论，当前不直接证明 AI 交付能力。',
  66: '第三方企业评价，当前优先自己的作品与使用案例。',
  68: '地域与做事方式评论，若有实际交付过程再单独提取。',
  71: '劳动与节日的哲学话题；与 072 同标题，正文恢复后才可判断重复。',
  72: '与 071 同标题但链接不同，先查正文，不能当作两份独立常青内容。',
  76: '全行业判断较泛，先保留观点渠道，再提取具体行业案例。',
  80: '渠道招募通知，属于合作/招聘信息；当前需求有效才进入官网相应栏目。',
  81: 'Web3 青年观点系列，当前不优先扩展站点主题。',
  84: 'Web3 青年观点系列，和本轮核心作品与服务需求关联弱。',
  90: 'AI 与表达的泛观点，标题不足以形成独特作品证据。',
  92: 'Web3 行业评论，当前不作为 AI 作品/服务内容主线。',
  98: '消费硬件趋势预测，未从标题看到本人相关作品或实测。',
};
for (const [id, reason] of Object.entries(holdReasons)) {
  add([Number(id)], 'HOLD', '非本轮主线或需正文确认', reason,
    '保留原文，不代表删除或判断质量差；正文若含原创交付证据，可重新归类。', [],
    '当前正文未读，不能据标题判定原创性、文章质量或事实真伪。');
}

if (links.length !== 98 || files.length !== 98) throw new Error('Source count changed; re-review the snapshot.');
if (annotations.size !== 98) throw new Error('Editorial coverage mismatch: ' + annotations.size);
const rows = links.map((link, idx) => {
  const id = idx + 1;
  const file = files.find(f => f.startsWith(String(id).padStart(3, '0') + '_'));
  if (!file) throw new Error('Missing numbered file: ' + id);
  const body = fs.readFileSync(path.join(articleDir, file));
  const html = body.toString('utf8');
  const gate = html.includes('当前环境异常') && html.includes('去验证');
  const hasBody = /id=["']js_content["']/.test(html);
  const titleMatch = norm(link.title) === norm(file.replace(/^\d+_/, '').replace(/\.html$/, ''));
  const editorial = annotations.get(id);
  if (!titleMatch) throw new Error('Link/file title mismatch: ' + id);
  if (!editorial) throw new Error('Missing editorial entry: ' + id);
  return { id: String(id).padStart(3, '0'), originalTitle: link.title,
    sourceUrl: link.url, sourceFile: path.join(articleDir, file), bytes: body.length,
    sha256: sha256(body), linkFileTitleMatch: titleMatch,
    exportStatus: gate ? 'wechat_verification_page' : 'requires_inspection',
    hasArticleContentMarker: hasBody, hasArticleTitleMarker: html.includes('rich_media_title'),
    articleBodyRead: false, originalPublishedAt: null,
    ...editorial,
    existingArticleUrl: editorial.existingSlug ? 'https://blog.hequbing.com/post?slug=' + editorial.existingSlug : null,
  };
});
const counts = Object.fromEntries(Object.keys(categories).map(k => [k, rows.filter(r => r.category === k).length]));
const audit = {
  assessedAt: '2026-10-01', timezone: 'Asia/Shanghai',
  scope: 'title_screening_and_local_export_audit', sourceRoot, linksPath,
  linksSha256: sha256(rawLinks), totalArticles: rows.length,
  totalHtmlBytes: rows.reduce((n, r) => n + r.bytes, 0),
  verificationPages: rows.filter(r => r.exportStatus === 'wechat_verification_page').length,
  articleContentMarkers: rows.filter(r => r.hasArticleContentMarker).length,
  articleTitleMarkers: rows.filter(r => r.hasArticleTitleMarker).length,
  articleBodiesRead: 0, uniqueSourceUrls: new Set(rows.map(r => r.sourceUrl)).size,
  allLinkFileTitlesMatch: rows.every(r => r.linkFileTitleMatch), categoryCounts: counts,
  existingBlogPosts: existingPosts.length,
  actualSearchTraffic: null, keywordVolumes: null, rankingChanges: null,
  actualAiSearchCitations: null, qualifiedInquiries: null,
  publicationPerformed: false, articleDataChanged: false,
  limitations: [
    '全部 HTML 是微信验证页，未取得任何一篇公众号正文。',
    '选题分档是基于标题、现有网站内容与目标的编辑初筛，不是正文审核结论。',
    '微信公众号原文的公开抓取失败；浏览器读取尝试未成功，不能据此断言原文章失效。',
    '标题里的原创标识、作者、日期、金额、模型水平、对象计数等尚未核实。',
    '与旧页的主题重合已检查；正文是否重复仍待原文。',
    '没有 GSC 或实际 AI 搜索引用观测，不能声明排名、收录或 GEO 效果。',
  ],
  articles: rows,
};
const cell = value => String(value ?? '').replace(/\s+/g, ' ').replace(/\|/g, '／');
const idList = ids => ids.map(id => String(id).padStart(3, '0')).join('、');
const base = '2026-10-01-wechat-screening';
const sources = [
  ['Google 有用内容与第一手经验', 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'],
  ['Google 搜索的 AI 功能与网站', 'https://developers.google.com/search/docs/appearance/ai-features'],
  ['Google JavaScript SEO', 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics'],
  ['Google 规范 URL', 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls'],
  ['OpenAI 爬虫与搜索访问', 'https://developers.openai.com/api/docs/bots'],
];
let md = `# 贺去病公众号文章：网站 SEO/GEO 标题初筛\n\n评估日期：2026-10-01（Asia/Shanghai）。**这是标题初筛，不是 98 篇正文审核。**\n\n`;
md += `目标是让目标客户能找到并理解贺去病、具体作品和可验证的服务能力；实际排名与 AI 引用变化尚未测量。\n\n`;
md += `## 先说明导出问题\n\n逐一检查了 ${audit.totalArticles} 个 HTML，合计 ${audit.totalHtmlBytes.toLocaleString('en-US')} 字节。**${audit.verificationPages} 个都是微信“环境异常、去验证”页面，文章正文标记 ${audit.articleContentMarkers} 个，文章标题标记 ${audit.articleTitleMarkers} 个。** 文件名像文章、文件大小约 18 KB，并不代表正文导出成功。\n\n`;
md += `标题/链接清单有 ${links.length} 条，链接全部不同，编号与文件名标题全部对应。这些标题可以支持选题初筛，不能用来审核正文质量、原创性或里面的事实。正文抓取失败也不代表公众号文章已失效。\n\n`;
md += `原始文件保留在 \`${articleDir}\`，未修改。逐文件状态、大小与 SHA-256 见同目录 \`${base}.json\`，完整清单见 \`${base}.csv\`。当前日期与原文发布日期分开记录；原文日期未知，未按编号猜日期。\n\n`;
md += `## 选题判断与目标\n\n我的编辑判断：先选能说明“谁做的、做了什么、解决什么问题、别人怎么验证”的文章。品牌词、产品词与具体任务相关问题各有承接页；泛 AI 感想可以保留在公众号，不作为第一轮站点建设的主要投入。\n\n`;
md += `第一手经验、清晰作者与可靠来源是官方有用内容指南中的关注点；不应靠许多无关联主题或夸张标题来追流量。[Google 有用内容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)\n\n`;
md += `Google 的 AI Overviews/AI Mode 沿用 SEO 基础要求，没有额外专用标记的入场要求，也不保证被收录或引用。这条官方说明只适用于 Google 的这些功能，不能推论所有 AI 产品的算法都相同。[Google AI 功能指南](https://developers.google.com/search/docs/appearance/ai-features)\n\n`;
md += `| 分档 | 数量 | 如何使用 |\n| --- | ---: | --- |\n`;
md += `| 优先取正文 | ${counts.P0} | 取回原文并核验后，整理成 ${themes.length} 组作品/服务/实战主题；不是 ${counts.P0} 个新 URL。 |\n`;
md += `| 补证据或改写 | ${counts.P1} | 需要具体步骤、作品归属、实测与边界，随后考虑。 |\n`;
md += `| 合并或维护说明 | ${counts.MERGE} | 对照站内旧页，更新有增量的内容；声明保留版本和语境。 |\n`;
md += `| 暂缓本轮主线 | ${counts.HOLD} | 不代表文章差或要删除；目前服务/作品关联弱、时效过期或标题信息不足。 |\n\n`;
md += `这些分档不含关键词搜索量与“GEO 分数”。下列查询是内容定位建议，不是已经测到的搜索需求。\n\n`;
md += `## 第一批：18 篇候选，整理成 12 组主题\n\n`;
md += `推荐执行次序：CAD、OpenCodex、DSH、U-King 等作品与实战先行；服务说明同步整理；尚未完成的商业协同流程排在取得真实记录之后。以下站点标题都是草案，不能直接冒充审核后的原文。\n\n`;
themes.forEach((t, i) => {
  md += `### ${i + 1}. ${t.name}（${idList(t.ids)}）\n\n`;
  for (const id of t.ids) { const r = rows[id - 1]; md += `- [${r.id} · ${cell(r.originalTitle)}](${r.sourceUrl})\n`; }
  md += `\n建议网站题目：**${t.headline}**。\n\n`;
  md += `${t.reason}\n\n处理：${t.action}\n\n`;
  md += `候选查询：${t.queries.join('；')}。\n\n`;
  md += `必须补的依据：${t.evidence}\n\n`;
  if (t.existingSlug) md += `已有相关页：[${cell(existingPosts.find(p => p.slug === t.existingSlug).title)}](https://blog.hequbing.com/post?slug=${t.existingSlug})。\n\n`;
});
md += `## 已有内容怎样使用\n\n站内目前有 ${existingPosts.length} 篇文章。025 与长程 AI 计算机页主题几乎相同，029 与本象技能发布页的规范化标题相同；这两篇先做正文对照，不直接新发。031 适合更新本象协议技术介绍，或只针对确有增量的新内容另立主题。005/006/014 先与“AI 住房时代”对照；056/059/065/078 先补 U-Claw 的实际使用说明。\n\n`;
md += `让官网已有 /about 与 /services 承接作者身份和合作需求，让作品展示承接产品名，让博客实战回答具体问题。文章与作品页、作者页、官方仓库相互链接；同一件作品的名称、作者和官方地址保持一致。文章数量不代替证据数量。此结构是本项目的编辑建议，非排名公式。\n\n`;
md += `077/082/088 不宜当作普通获客文章照搬。可整理当前官方名称、下载与支持渠道，原始声明保留日期与版本。069/070 的销售额和传闻没有核实，不能当自己的收入证明。071/072 同标题、不同链接，目前只能叫“疑似重复”，需要正文后再决定。\n\n`;
md += `## 发布前先补的技术环节\n\n`;
md += `1. **每篇页面直接返回正文 HTML。** 本地 \`public/post.html\` 的标题/正文容器为空，\`public/post.js\` 获取 API 后写入内容和 meta。建议预渲染或服务端生成全文、独立 title/description 与规范链接，保留目前 URL 或做明确迁移。Google 会执行 JS，但并非所有机器人都能执行；不能据此断言现有文章一定未收录。[Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)\n\n`;
md += `2. **规范版本和链接一致。** 本地文章模板未发现 rel=canonical；目前同站有 www 和 blog 两个域名入口。为同一文章确定规范 URL，内部链接、sitemap 与规范指向一致。公众号文章可标注原始来源；本站 canonical 不是微信文章的可控设置，也不能据此强制搜索引擎把本站当首发。[Google 规范 URL 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)\n\n`;
md += `3. **作者和作品信息可见且可核对。** 正文显示“贺去病”、作者页、作品名、实测日期、版本和原始证据。作品现状、历史指标与计划分开。现有 BlogPosting 数据要与页面事实一致；不要把任何 schema 当作 AI 推荐的保证。[Google AI 功能指南](https://developers.google.com/search/docs/appearance/ai-features)\n\n`;
md += `4. **区分搜索访问和训练访问。** 本地 robots.txt 当前 Allow: /；上线后还需看站点响应、CDN/WAF 的实际行为。OpenAI 把 OAI-SearchBot 搜索访问与 GPTBot 训练访问分开，可分别设置。允许搜索访问只是访问条件，不保证引用。[OpenAI 爬虫说明](https://developers.openai.com/api/docs/bots)\n\n`;
md += `技术检查来自本地源文件。公开主页的读取结果是旧抓取快照，不能证明生产环境和本地完全一致；没有完成实时线上源码或抓取链路验收。上述是建议，本轮未改网站代码。\n\n`;
md += `## 网站版内容应补什么\n\n`;
md += `保留原文的第一手叙述，补充：具体读者问题；作品/服务定义；作者与日期；输入和可检查输出；工具版本；原始依据；操作步骤；失败与适用范围；相关作品和咨询入口。问答可用于帮助读者理解，但不要批量制造同义问题页。对“第一”“99%”“90%”“卖了一个亿”等标题主张，只有相应证据存在才保留为事实；否则准确标明观点、计划或传闻。\n\n`;
md += `目前没有正文，无法代替你写最终网站稿，也无法确认哪些内容可直接迁移。取得正文后，先核对原创/转载类型、作者、图片与第三方材料的使用范围，再逐篇编辑。\n\n`;
md += `## 如何判断之后是否有效\n\n`;
md += `记录上线前与上线后的同一组问题：贺去病是谁/有哪些作品、OpenCodex 做什么、U-King 如何安装 AI、U-Claw 是否适合当前任务、CAD AI 如何验证、企业怎样找 AI 落地顾问。品牌词与泛需求分开。用 Search Console 查看查询和页面的展示/点击/位置；实际 AI 搜索按产品、地区、语言、日期记录原始回答和引用 URL。有人提到名字、爬虫访问、实际引用与有效询盘分别记录，未测量保持为空。Google 的 AI 搜索流量在 GSC Web 中汇总，不能从总流量拆出未经测量的独立 GEO 增長。[Google AI 功能指南](https://developers.google.com/search/docs/appearance/ai-features)\n\n`;
md += `## 98 篇完整清单\n\n每篇均为 title_only；“优先”表示优先恢复并审核，不是发布放行。链接指向原始公众号文章。\n\n`;
for (const category of Object.keys(categories)) {
  md += `### ${categories[category]}（${counts[category]}）\n\n| 编号 | 原始标题 | 主题/承接 | 理由与处理 |\n| --- | --- | --- | --- |\n`;
  for (const r of rows.filter(r => r.category === category)) {
    md += `| ${r.id} | [${cell(r.originalTitle)}](${r.sourceUrl}) | ${cell(r.topic)} | ${cell(r.reason)} ${cell(r.action)} |\n`;
  }
  md += '\n';
}
md += `## 官方资料（本轮查阅）\n\n`;
sources.forEach(([title, url]) => { md += `- [${title}](${url})\n`; });
md += `\n当前完成的是逐文件导出审计、98 条标题筛选、旧页主题对照与编辑建议。没有发布、部署或改动 posts.json，效果仍未测量。下一步所需材料是成功导出的正文或原始写作文件。\n`;

const csvHeaders = ['id', 'originalTitle', 'sourceUrl', 'category', 'topic', 'reason', 'action',
  'proposedQueries', 'requiredEvidence', 'existingArticleUrl', 'sourceFile', 'exportStatus',
  'assessmentBasis', 'articleBodyRead', 'approvedToPublish'];
function csvCell(value) {
  let s = Array.isArray(value) ? value.join('；') : String(value ?? '');
  // Prevent a title from being treated as an Excel formula.
  if (/^[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
const csv = '\uFEFF' + csvHeaders.map(csvCell).join(',') + '\r\n'
  + rows.map(r => csvHeaders.map(h => csvCell(r[h])).join(',')).join('\r\n') + '\r\n';
const outputs = [[base + '.json', JSON.stringify(audit, null, 2) + '\n'], [base + '.csv', csv], [base + '.md', md]];
for (const [name] of outputs) if (fs.existsSync(path.join(__dirname, name))) throw new Error('Snapshot already exists: ' + name);
for (const [name, text] of outputs) fs.writeFileSync(path.join(__dirname, name), text, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ categoryCounts: counts, candidateThemes: themes.length,
  articleBodiesRead: 0, verificationPages: audit.verificationPages,
  outputs: outputs.map(([name]) => path.join(__dirname, name)) }, null, 2));
