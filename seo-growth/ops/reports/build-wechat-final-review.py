"""Build an evidence-bounded editorial review of the repaired local exports.

Read-only source access. New report snapshot; no publication or website edits.
Run with: python -X utf8 seo-growth/ops/reports/build-wechat-final-review.py
"""
import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path

REPORT_DIR = Path(__file__).resolve().parent
REPO = REPORT_DIR.parents[2]
BASE = '2026-10-01-wechat-final-review'
corpus = json.loads((REPORT_DIR / '2026-10-01-wechat-extracted.json').read_text(encoding='utf-8'))
posts = json.loads((REPO / 'data/posts.json').read_text(encoding='utf-8'))
slugs = {p['slug'] for p in posts}
labels = {
    'P0': '第一批重点候选',
    'P1': '补材料或纠正后考虑',
    'MERGE': '提取增量并入旧页或专题',
    'HOLD': '暂缓本轮主线',
    'WAIT': '正文空白，待补导出',
}
notes = {}


def add(ids, category, topic, reason, action, evidence='', queries=(), slug=None):
    if slug and slug not in slugs:
        raise ValueError('Missing existing slug: ' + slug)
    for number in ids:
        if number in notes:
            raise ValueError('Duplicate article: ' + str(number))
        notes[number] = dict(category=category, categoryLabel=labels[category], topic=topic,
                             reason=reason, action=action, requiredEvidence=evidence,
                             proposedQueries=list(queries), existingSlug=slug)


# Priority recommendations are based on the body, rather than the original title screen.
add([22], 'P0', 'CAD 对象级统计与审查',
    '有实际 DWG/DXF 输入、对象清单、位置证据、验收口径和能力边界，是这批最强的行业交付候选。',
    '新建具体案例文章，连接本象协议、CAD 服务和官方证据入口；标题减少悬殊数字的对抗表达。',
    '正文自报168窗+22门、190个位置锚点；截图与原件输入不同，不能作模型公平排行。保留候选194与实际190的区别、窗樘定义、轮廓/bbox未恢复和未做人工作业盲测的说明；复核脱敏公开包。',
    ['CAD AI 门窗统计', 'DWG 对象清单', 'CAD 图纸审查 AI'])
add([21], 'P0', 'Task Passport 任务护照',
    '作者开发的明确作品，回答换模型后如何续接任务；包含稳定ID、六项状态、版本冲突及四种入口。',
    '新建作品技术说明：先演示一次任务交接，再解释状态结构和拒绝旧写入的机制。',
    '正文为2026-08-14 v0.2.2；复核公开仓库当前版本、实际交接样例、CLI/MCP入口与冲突结果。独立社区项目；不搬聊天、Git仓库或密钥，不保证自动支持所有工具。',
    ['Task Passport', 'DSH 任务护照', 'Claude Codex 任务交接'])
add([38], 'P0', 'OpenCodex',
    '明确自研开源作品，正文写出多终端、分屏、进程清理、文件拖入和用户自配端点等具体功能。',
    '首页已有作品卡片，补独立作品说明和博客开发实战；与已有Codex中文教程分别承接产品词和教程问题。',
    '4.7MB是历史版本大小，复核当前发行包与MIT范围；说明客户端/模型调用条件。文末另有Redline，不能混写成OpenCodex功能。',
    ['OpenCodex', 'AI 编程多终端工作台', 'Claude Code Codex 分屏'])
add([30], 'P0', 'U-King 一键安装的开发经验',
    '有配置格式、安装状态判断、退出后写配置、进程误杀等真实工程取舍，比泛产品宣言更有独特信息。',
    '新增开发案例文章并回链U-King现有介绍；把u-rescue作为相关开源工具单独介绍。',
    '复核当前实现与版本；保留ClawX关闭顺序、按安装路径识别进程、不夺取用户已有登录等具体边界。u-rescue的19个故障案例为文中自述，需指向实际案例库。',
    ['U-King 一键安装', 'AI 工具配置冲突', 'AI 安装排障'], 'uking-usb-ai-installer')
add([3], 'P0', '贺去病商业咨询定位',
    '清楚说明作者经历、目标客户、诊断/90天试点/年度合作、交付和验收；直接支撑个人品牌与合作需求。',
    '与004共同更新作者介绍和服务定位；可发正式咨询说明。价格与现有服务页先统一，再决定网站版是否保留价目。',
    '文章定位年营收1亿元以上企业，价格3万元诊断、18万元/90天试点、60万元/年起+约定绩效；正在找第一批客户，不是已有增长战绩。冠军/客户经历等需有对应公开证明。',
    ['贺去病 AI 咨询', '企业 AI 落地顾问', 'AI 经营诊断'])
add([4], 'P0', '陪伴式 FDE 方法与交付',
    '把进企业、业务判断、工具实施、持续复盘和留下可用流程连接起来，体现作者差异化服务方法。',
    '减少军事比喻，保留职责、阶段交付、客户责任、深圳及异地出差的实际说明；服务页链接这篇方法文章。',
    '贺方升与贺去病的身份关系已在正文明确。研发/工艺为探索方向，不冒充已完成十倍提升；不把工时节省直接计成工资节省。',
    ['陪伴式 FDE', '企业 AI 落地陪跑', '贺方升 贺去病'])
add([12], 'P0', 'AnythingChina 中国通',
    '有真实作者经历和具体业务方向：AI资料与获授权的线下工厂核验结合，是另一件有名称的本人项目。',
    '按项目故事发布，链接AnythingChina.net和作者页；用当前阶段说明区分产品现状与愿景。',
    '十万物流站/百万工厂是长期目标，不是现有覆盖量；从深圳东莞起步。工厂走访不能表述为专业认证或审计；历史业务规模为作者自述，需对应材料。',
    ['AnythingChina', '中国通 工厂信息', '贺去病 中国通'])
add([83], 'P0', 'U-Hermes 便携 AI 环境',
    '明确作品、受众、Windows与Linux版本、开源和商业范围，具备独立作品搜索的内容基础。',
    '做当前作品说明，解释与U-Claw的关系、启动步骤、支持系统和模型条件；历史售价及名称按现状复核。',
    '文中199元起、Windows商业启动器/Linux MIT范围是当时口径；确认当前维护与下载。程序本地运行不代表模型离线或免费；不要把U盘当成绕过公司策略的方式。',
    ['U-Hermes', 'Hermes Agent U盘', '便携 AI 工作环境'])
add([1], 'P0', 'GEO 方法与验收',
    '有客户需求、企业能力表达、交付/发现效果/业务结果三层验收；明确不出售自然排名保证，比旧营销口号完整。',
    '作为GEO服务的方法文章；把093/097的少量有用观点并入，不重复发三篇近似营销文章。',
    '电源线工厂为假设示例，不是已交付客户。保留官方政策链接和观察条件；若称实战成果，再提供日期、问题、回答、引用和询盘归因。',
    ['贺去病 GEO', '企业 GEO 如何验收', 'AI 搜索品牌可见性'])

second_wave = [
    (11, 'AI 软件接口', '正文主要是界面变化的预测，尚未形成自己的实施案例。', '与PodApp/接口设计关联，补真实代码与适用条件后再写技术文章。', '实际接口、调用样例、失败场景；预测与实现分开。'),
    (23, 'AbsenceBench 模型实测', '有32条任务、工具、配置、实扣费用与失败样本；原创实验有价值，但文中说原始实验还未公开。', '值得第二批重点做：发布可审计实验包，改成带日期的窄任务测试，减少综合模型优劣结论。', '复核模型实际ID/路由别名、官方来源、thinking关闭配置、四份结果和费用口径；Fable仅完成16/32，不能当完整公平排行。不沿用历史价格作为当前报价。'),
    (24, '格子 AI 科研机', '正文介绍科研探索计划，不能证明已做出科研发现。', '有可运行原型、输入和实验记录后，写研发日志或作品进展。', '原型、已实现模块、重复实验与人工验证；标明研究计划。'),
    (34, 'PodApp 与 AI GUI', '正文出现作者的PodApp方向，解释AI操作与人类确定性界面的取舍；主要仍是宣言。', '标题写明PodApp；补实际演示、动作接口和人工确认流程，作为作品设计文章。', '当前原型、仓库/演示、已实现与计划功能；不要直接把宣言叫成熟产品。'),
    (35, 'AI 实战训练服务', '不只是行业感想，正文含深圳宝安训练营及工具实战方向；是否仍在运营未知。', '如仍提供培训，整理成一页当前课程/服务，其他招生文章只取增量。', '当前地区、课程、练习、交付和招生状态；不把学习工具写成就业保证。'),
    (45, '企业受限工具环境', '回应公司只能用内网工具的真实问题；正文强调上下文和流程，但缺具体完成样例。', '改成企业合规环境中的需求整理与AI协作步骤，再连接自己的工具。', '获授权工具、小任务演示、前后产物与限制；不建议绕过企业安全策略。'),
    (60, '科研虾 / 实验龙虾', '这是论文研究空白与实验自动化的项目愿景，不是已有实验室效率结果。', '有可运行模块或实际实验后发布项目进展；当前可以作为明确标注的研究计划。', '真实模块、论文检索依据、专家复核、设备接口和实验记录；一个月变一晚等设想不能作已实现指标。'),
    (63, '小创工作室', '有名称和校园实战方向，但内容为决定做什么，没有活动成果。', '补实际活动、产品、代码与参与者产出后，做项目案例。', '活动日期、作品与学校关系；不能仅凭地点表述为高校官方合作。'),
    (79, 'AI 商业协同公开实验', '全文明确是第0天，描述以后每日记录；尚无完整协同过程或结果。', '保留为计划/进度入口；取得阶段记录后再写实战复盘。', '实际日志、输入、产物、人工参与、成本和结果；处理可公开范围。'),
    (85, '按任务选 AI 工具', '有按场景选工具的思路，但主要靠武器比喻，缺任务对照。', '补几个自己完成的具体任务与选择条件；可并入U-King使用指南。', '任务、工具、步骤、结果和适用条件，避免高手/最赚钱的无依据标签。'),
    (86, 'U-Claw 权限与数据流', '安全疑问很适合FAQ，但原文把风险归给用户，并把仅API调用说成很安全，存在过度简化。', '纠正后再用于作品安全说明：逐项写实际文件权限、工具执行、云端发送、确认和日志机制。', 'U盘和本地运行都不自动形成沙箱；云端输入也涉及数据风险，工具或依赖也可能有漏洞。只描述当前实现能证明的隔离，不许仅凭概念保证只能读授权路径。'),
    (94, '装修效果图应用观察', '正文是燕子提供SketchUp截图和AI成图的反馈，没有证明工具由作者开发，也未给出完整复现过程。', '可做经授权的行业应用案例，明确谁做了什么；不能列入本人自研作品。标题和实际贡献保持一致。', '工具真实链接、原图/成图使用范围、来源及复现步骤；FLUX/ControlNet与结构不变的主张需验证，80分只是个人评价。'),
]
for number, topic, reason, action, evidence in second_wave:
    add([number], 'P1', topic, reason, action, evidence)

merge_items = [
    (2, '咨询定位', 'AI装备与经营组织的比喻，003/004已经展开得更完整。', '提取可用的经营问题，合入003/004，不新增同类宣言。', None),
    (5, 'AI 常驻环境', '短观点和未来环境计划，站内已有AI住房时代。', '仅有新实验时更新旧页；删除过期群邀请。', 'ai-housing-era'),
    (6, 'AI 常驻环境', 'Omarchy与AI操作系统的未来评论，尚无自己的安装与运行测试。', '保留为旧页背景观点；新教程必须另有实测。', 'ai-housing-era'),
    (13, 'U-King 定位', '主要讨论产业机会，末尾联系作者U-King，但没有新增交付证据。', '只取明确产品价值，补现有U-King介绍。', 'uking-usb-ai-installer'),
    (14, 'AI 常驻环境', 'AI住房/硬件未来观点与已有网站文章重叠。', '合并观点，不再生成同义新URL。', 'ai-housing-era'),
    (20, 'FDE 活动预告', '正文有08.22直播报名，AI员工总经理为作者比喻，并非通用职业定义。', '取职责内容并入004；去掉旧报名和职业保证式表达。', None),
    (25, '长程 AI 计算机', '站内已有几乎同主题作品文章；正文有更多方法及边界。', '把确有增量的挑战、测试与链接更新到旧页；全球首台为自述。', 'long-term-ai-computer-challenge'),
    (27, 'U-King 组装方案', '主要讲AI组装机定位与未来规模，不是已经成为最大厂商。', '并入产品背景，与030具体工程经验互链。', 'uking-usb-ai-installer'),
    (29, '本象技能发布', '与网站现有同名文章内容高度重合，已有三技能和验证口径。', '对照补版本与安装增量；不换标题再发。', 'benxiang-skills-launch'),
    (31, '本象协议', '617字概念说明；网站已有更完整的协议介绍。', '补作者说明或链接，不新增重复介绍。', 'benxiang-protocol'),
    (40, 'AI 培训', '宝安AI夜校与培训思路，主要是招生表达。', '如仍运营，取课程信息并入035对应的当前培训服务页。', None),
    (41, '共创与培训', '深圳Hacker House两个月招募计划，当前状态未知。', '只在项目仍有效时更新合作栏目；不把旧招募当常设服务。', None),
    (42, '企业 AI 顾问', '军队类比描述驻场、培训和部署，004已给出更清楚的方法。', '合入004的职责与协作方式。', None),
    (43, 'AI 训练服务', '面向AI实战训练的宣传，缺可复核的学员成果。', '与035统一当前课程；就业与效率倍数不照搬。', None),
    (44, 'AI 编程学习', '毕业生竞争力评论与培训表达，没有完整工具教程。', '取学习主题补当前课程或既有教程；不因标题就改称实战教程。', 'codex-cli-chinese-tutorial'),
    (48, 'AI 办公与培训', 'Codex办公评论及清湖工作室计划，不是某个自研办公产品发布。', '取有效服务信息合入当前培训说明；地点按现状核对。', None),
    (49, 'Codex / OpenCodex', '工具比喻与生态愿景，结尾联系自己的OpenCodex/U-King。', '用038的已实现功能为准；将不同工具整合的愿景与现实分开。', 'codex-cli-chinese-tutorial'),
    (51, 'AI 培训服务', 'AI驾校/机会评论与社群邀请，缺当前课程细节。', '若课程有效，合入035，不单独发机会宣传文。', None),
    (53, 'U-Claw 背景', '第三方发布新闻与OpenClaw前景评论，末尾是U-Claw创作理念。', '取本人理念补作品页；第三方新闻先查当时官方原文。', 'u-claw-usb-offline-ai'),
    (56, 'U-Claw 预期与支持', '真实退款触发产品边界说明，主要解释学习成本和陪跑。', '补作品页适用范围、学习成本和支持方式。', 'u-claw-usb-offline-ai'),
    (58, 'U-King 创作背景', '早期0.1版本愿景与招募，功能列表混合了尝试与未来。', '保留历史创作背景，当前功能由版本与实现证明；030为更强开发案例。', 'uking-usb-ai-installer'),
    (59, 'U-Claw 创作背景', '主要是双AI架构理念与市场估计，首创和销售规模没有独立依据。', '只留实际产品设计理由，市场金额不作作者业绩。', 'u-claw-usb-offline-ai'),
    (65, 'U-Claw 学习与上手', '教练车类比产品学习方式，与其他入门介绍接近。', '合入真实上手流程和支持模块。', 'u-claw-usb-offline-ai'),
    (67, '安装排障背景', '个人蓝屏经历和平台判断，尚无故障日志与完整修复步骤。', '只取创作动机；有日志再写真正排障案例，用户90%不作统计。', 'uking-usb-ai-installer'),
    (69, 'U-Claw 作者经历', '亿元为相关生态估计/他人市场情况，不是作者产品已实现营收。', '抽取有依据的项目时间线；标题不得让人误解本人卖了一个亿。', 'u-claw-usb-offline-ai'),
    (70, 'U-Claw 作者经历', '2000万元明确来自听说，正文反而谈到自己的14单与店铺状态。', '只用有证据的本人经历，不继承他人传闻金额。', 'u-claw-usb-offline-ai'),
    (73, 'U-Claw 陪跑支持', '面向产品用户的持续支持与实际使用，不是企业FDE经营顾问案例。', '并入U-Claw售后/使用说明，避免与004企业咨询混为一个服务。', 'u-claw-usb-offline-ai'),
    (74, '模型使用条件', '本地/云端以学历作比喻，没有同任务对照与成本实测。', '仅提炼任务选择和调用条件FAQ；没有数据不保留高低绝对判断。', 'u-claw-usb-offline-ai'),
    (75, '运行与计费说明', '围绕HERMES.md传闻说明产品目标，技术与自动消费结论缺验证。', '按实际能力重写FAQ，解释调用费、权限和限制；不沿用不会秘密扣费保证。', 'u-claw-usb-offline-ai'),
    (77, '官方名称与来源', '在先使用声明，可作历史品牌记录，不是获客实战文章。', '保留日期与原始版本；当前名字、官方地址和开源许可另做统一说明。', None),
    (78, 'U-Claw 入门与合作', '作品定位、双AI与代理/带货招募，和现有介绍重合。', '产品能力并入旧页；有效合作招募放合作栏目。', 'u-claw-usb-offline-ai'),
    (82, '官方名称与来源', '名称使用声明与077同类，虾米/马盘历史名称也需区分。', '并入官方品牌说明；不由此推断已注册商标或他人违法。', None),
    (87, '协作与上下文', '主要是沟通带宽比喻，AI零偏差/完整上下文的概括不准确。', '改成实际交接问题，作为021任务护照的背景，删除绝对能力主张。', None),
    (88, '官方渠道与支持', '仿冒声明带历史店铺状态和对他方评价，不宜整体当新SEO文。', '只更新已核实的官方入口和支持范围；争议留原公告语境。', None),
    (89, 'U-Claw 用户反馈', '有一个程序员成功启动的反馈，但不是安装效率统计或变现证明。', '经允许后匿名放作品页反馈模块；补系统版本与实际启动条件。', 'u-claw-usb-offline-ai'),
    (93, 'GEO 方法素材', '有真实认知表达主题，但固定最多5个答案、90%等说法缺依据。', '采用001更完整的新方法，删除平台普遍排名规则和数字保证。', None),
    (95, '营销咨询素材', '488字表达产品力与传播力，缺具体诊断步骤或实战。', '仅取少量观点并入003/001，不单独占一个长尾问题页。', None),
    (96, '上门服务旧价目', '仅86字加海报；企业9999起/个人2999起与003新服务价格不同。', '作历史素材；统一服务范围与新旧价格，删无证据的最好/胜过50万MBA比较。', None),
    (97, 'GEO 营销素材', '493字观点表达与001/093同主题，90%没有调查依据。', '并入001，不把真实认知整理写成能控制AI推荐结果。', None),
]
for number, topic, reason, action, slug in merge_items:
    add([number], 'MERGE', topic, reason, action,
        '只用正文中可核对的增量；当前版本、状态与历史日期分开。', slug=slug)

hold_groups = [
    ([7, 8, 9, 64, 68], '城市与创业评论', '主要是城市/创业环境观点，与当前本人作品或具体企业交付问题关联较弱。'),
    ([15, 16, 17, 18], '开源比赛评审观点', '主要讨论赛事评审与公开规则，不是自己的产品使用或技术交付；可保留作者观点栏目。'),
    ([10, 37, 39, 50, 57, 66, 76], '行业和第三方趋势', '主要是供应商、人物或行业走势评论；第一批投入优先自己的作品、开发方法和证据。'),
    ([26, 28, 54, 62, 80], '通知与招募', '主要是致歉、研究招募、夏季活动、考前邀请或渠道招募；时效与现状需核对。'),
    ([32, 33, 36, 46, 52, 55, 61, 71, 72, 90, 91], '泛 AI 观点', '以未来想象、比喻或社会评论为主，目前没有足够具体的本人作品/实战增量。'),
    ([81, 84, 92], 'Web3 观点', '观点或招募内容，与本轮AI落地、作品与个人技术能力主线关联较弱。'),
]
for ids, topic, reason in hold_groups:
    add(ids, 'HOLD', topic, reason,
        '保留公众号或可选观点栏目；暂不为本轮SEO/GEO优先迁移。',
        '这是内容投入顺序，不能据此断言文章质量差或一定影响排名。')
add([19], 'HOLD', '过期服务状态短讯',
    '正文仅54字，是Claude/OpenAI服务状态评论，没有本地GPT部署内容。',
    '不改写成不存在的部署教程，保留历史短讯。')
add([98], 'HOLD', '智能眼镜短观点',
    '正文28字，没有自己的智能眼镜作品、实验或教程。',
    '暂不作为作品文章迁移。')
add([47], 'WAIT', '空导出', '标题和js_content均为空，0字、0图；不能审核正文。',
    '待重新导出；本轮不阻塞其他文章选择。', '真实正文。')

assert len(corpus) == 98 and set(notes) == set(range(1, 99)), (len(corpus), sorted(set(range(1, 99))-set(notes)))
priority_ids = [22, 21, 38, 30, 3, 4, 12, 83, 1]
rows = []
for article in corpus:
    number = int(article['id'])
    source_file = Path(article['file'])
    raw = source_file.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != article['sha256']:
        raise RuntimeError(f'Source changed after extraction: {number}; extract and review again.')
    if article['is_verification_page']:
        raise RuntimeError('Unexpected verification page: ' + str(number))
    row = dict(id=article['id'], originalTitle=article['title'], sourceUrl=article['url'],
               sourceFile=str(source_file), bytes=len(raw), sha256=digest,
               contentStatus=article['content_status'], textChars=article['text_chars'],
               imageCount=article['image_count'], embeddedImageCount=article['embedded_image_count'],
               sourceEvidencePreview=article['text'][:240],
               reviewBasis='extracted_body_text' if article['text_chars'] else 'empty_export',
               reviewDepth='priority_detail' if number in priority_ids or number in [23, 58, 79, 86, 89, 94] else 'key_passages',
               originalPublishedAt=None, imageVisualReviewPerformed=False,
               currentExternalClaimsIndependentlyVerified=False, publicationPerformed=False,
               **notes[number])
    row['existingArticleUrl'] = 'https://blog.hequbing.com/post?slug=' + row['existingSlug'] if row['existingSlug'] else None
    rows.append(row)
counts = dict(Counter(r['category'] for r in rows))
audit = dict(assessedAt='2026-10-01', timezone='Asia/Shanghai',
             scope='body_based_editorial_screening_with_priority_detail',
             totalArticles=len(rows), readableTextArticles=sum(r['textChars'] > 0 for r in rows),
             emptyExports=[r['id'] for r in rows if r['contentStatus'] == 'empty_export'],
             totalHtmlBytes=sum(r['bytes'] for r in rows), verificationPages=0,
             totalExtractedTextChars=sum(r['textChars'] for r in rows),
             uniqueSourceUrls=len({r['sourceUrl'] for r in rows}), sourceHashesVerified=True,
             categoryCounts=counts, existingWebsiteArticleCount=len(posts),
             reviewMethod='逐篇检查抽取正文的开头、结尾与相关段落；重点作品、服务和事实边界深入复核。未逐张审核图片，未独立重跑文中实验。',
             actualSearchTraffic=None, keywordSearchVolumes=None, rankingChanges=None,
             actualAiSearchCitations=None, qualifiedInquiries=None,
             publicationPerformed=False, websiteCodeChanged=False, articleDataChanged=False,
             limitations=[
                 '047空导出，不能判断正文；其余97篇有文字，不等于所有图片可离线展示。',
                 '作者开发及实测主张来自公众号正文，不等于独立认证；当前发行、实验数据和业务范围发布前需复核。',
                 '编号仅表示导出顺序；原文发布日期未统一可靠抽取，未按编号猜日期。',
                 '图片未逐张视觉审核；客户内容/反馈是否获准再次公开尚未确认。',
                 '网页技术判断来自本地源代码，尚未完成当前生产环境抓取验收。',
                 '没有GSC和AI搜索引用基线，不能承诺排名、引用或获客提升。',
             ], articles=rows)


def flat(value):
    return ' '.join(str(value or '').split()).replace('|', '／')


def link(row):
    return '[' + row['id'] + ' · ' + flat(row['originalTitle']) + '](' + row['sourceUrl'] + ')'


out = []


def write(value=''):
    out.append(value)


write('# 贺去病公众号文章：网站 SEO / GEO 正文筛选')
write()
write('评估日期：2026-10-01。目标：让客户和AI搜索更容易了解贺去病、贺方升、本人作品，以及企业AI落地能力。以下是编辑建议，不是排名预测或发布授权。')
write()
write('**建议第一批选9篇，围绕8组作品/服务主题整理；不要一次迁移98篇。** 最有价值的是实际工程、命名作品、第一手业务经历与清楚的交付方法。泛观点可以保留，迁移投入排后。')
write()
write('## 本次材料与判断边界')
write()
write(f'新版98个HTML合计{audit["totalHtmlBytes"]:,}字节，约{audit["totalHtmlBytes"]/1024/1024:.1f} MiB；97篇有可提取文字，047《致Web3青年的第三封信》是空导出，0字、0图。全部文件没有检出此前的验证页。源文件逐一校验SHA-256，与抽取时一致。')
write()
write(audit['reviewMethod'] + ' 各行保留原文链接、文件名、正文证据片段和具体处理建议。文中自报的计数、收入、成本、版本与体验不自动变成独立核实结果。')
write()
write('文件名001～098用于对照；不把编号当发布日期。前8篇的内嵌图片与后90篇的远程图片格式不同，网站版仍需检查图片与引用来源。没有修改原导出、网站正文或代码，也没有发布。此前标题初筛已被本报告替代。')
write()
write('| 分档 | 篇数 | 处理方式 |')
write('| --- | ---: | --- |')
for category in labels:
    meanings = {'P0': '最值得优先整理，不表示所有事实和当前版本已放行。',
                'P1': '有价值，但缺当前产品、实验或实际结果；部分需纠正主张。',
                'MERGE': '仅取可核实增量，不把每篇都生成新URL。',
                'HOLD': '保留公众号或观点栏目；暂缓不是质量或排名处罚结论。',
                'WAIT': '补真实正文后重新判断。'}
    write(f'| {labels[category]} | {counts.get(category,0)} | {meanings[category]} |')
write()
write('## 第一批9篇：建议次序、网站题目与承接')
write()
headlines = {
    22: 'CAD AI如何生成可复核的门窗对象清单：DWG与DXF实践',
    21: 'Task Passport任务护照：Claude、Codex、DSH如何接力同一任务',
    38: 'OpenCodex：本地多终端AI编程工作台的设计与使用',
    30: 'U-King一键安装的开发实践：配置、进程与排障',
    3: '贺去病商业咨询：AI经营诊断、增长试点与合作流程',
    4: '陪伴式FDE：企业AI落地怎样交付、验收与持续复盘',
    12: 'AnythingChina中国通：从物流与工厂经历到AI项目',
    83: 'U-Hermes便携AI工作环境：版本、上手与运行条件',
    1: 'GEO如何验收：交付、被发现与真实业务结果',
}
for order, number in enumerate(priority_ids, 1):
    r = rows[number-1]
    write(f'### {order}. {r["topic"]}（{r["id"]}）')
    write()
    write('原文：' + link(r) + '。')
    write()
    write('网站标题草案：**' + headlines[number] + '**。')
    write()
    write('为什么选：' + r['reason'])
    write()
    write('处理：' + r['action'])
    write()
    write('核对要点：' + r['requiredEvidence'])
    write()
    write('候选查询：' + '；'.join(r['proposedQueries']) + '。这些是内容定位建议，未测搜索量。')
    write()
    if r['existingArticleUrl']:
        write('已有相关页：[站内文章](' + r['existingArticleUrl'] + ')。')
        write()

write('## 最容易迁移错的地方')
write()
for text in [
    '023值得做实验文章，但不是当前完整公开的测评包。保留窄任务、样本、路由、预算截断与日期，补可审计材料后再推；当前模型/价格不能靠旧文章确认。',
    '019仅54字服务状态评论，不是本地GPT部署教程。098只有28字观点，不是智能眼镜作品介绍。',
    '079为第0天实验计划，不是已跑完的业务流程。060/024是科研愿景，063是工作室启动计划；不能改写成已有科研或校园成果。',
    '094描述客户提供的AI效果图，不证明是作者开发的产品。可做行业案例，需要注明实际贡献、来源和复现过程。',
    '086适合安全FAQ，但仅本地运行/U盘不证明权限隔离；风险不全来自用户。按当前实现写清数据流和授权机制，删绝对安全结论。',
    '069/070的亿元、2000万元不能当作者营收；012的十万站点/百万工厂是目标，不是已覆盖的规模。',
    '025更新现有长程AI计算机页；029更新现有本象技能页；031补现有本象协议。005/006/014与AI住房时代合并。',
    '071/072同标题，是长短版本的同主题观点；不需要两个新页面，不能因为同标题就宣称逐字相同。',
    '077/082/088可留下历史公告和当前官方渠道说明；虾米/马盘、店铺状态与开源范围按时间核对，不能由声明推断已注册权利或他方违法。',
]:
    write('- ' + text)
write()
write('003新服务：3万元诊断、18万元/90天试点、60万元/年起+约定绩效；本地网站仍有免费30分钟诊断、3000元起方案、8000元起POC、2万元起陪跑；096又是企业9999元起/个人2999元起。它们可能属于不同阶段或服务范围，网站版须说明区别并统一当前入口，不能同时当成同一服务的现行价目。本文不替你决定采用哪一套，也不修改价目。')
write()
write('## 文章之外，还值得补的本人作品')
write()
write('038文末的**Redline**值得另立作品介绍：对多种文件进行圈画批注，把意图交给AI；正文明确Redline本身不改原始文件。030提及的**u-rescue**也值得做安装排障工具/案例库说明。这两项当前材料很短，先读公开仓库与实际演示再写，不能从一段简介扩写成完整已验证产品能力。')
write()
write('- [OpenCodex公开仓库](https://github.com/dongsheng123132/opencodex)')
write('- [Redline公开仓库](https://github.com/dongsheng123132/redline)')
write('- [u-rescue公开仓库](https://github.com/dongsheng123132/u-rescue)')
write('- [Task Passport公开仓库](https://github.com/dongsheng123132/task-passport)')
write()
write('这些地址来自原文，不表示本轮验收了仓库当前代码和下载。')
write()
write('## 网站如何承接个人品牌与作品')
write()
write('作者页把“贺方升，笔名贺去病”及本人项目串起来。作品页说明具体用途、当前状态、作者、仓库/下载与运行条件。博客案例回答真实任务：输入是什么，做了哪些步骤，产物在哪里，怎样复核，哪些情况不适合。服务页承接合作目标、交付和验收。案例链接作品及服务，作品回链案例，作者页链接两者。')
write()
write('这是基于本项目的编辑建议：优先使每个问题有清楚的承接页；不是靠反复插入“贺去病”或复制产品介绍来增加排名。清晰作者、原创信息、第一手经验和可靠来源是[Google有用内容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)强调的方向。')
write()
write('例如读者看到CAD案例后，能了解本象协议和真实交付；看到OpenCodex后，能找到仓库、使用说明和作者；问“贺去病能做什么”，作者页与咨询页能给出一致回答。品牌词和CAD/安装/任务交接等具体需求分别观察，不假设都有很大搜索量。')
write()
write('## 批量上线前，先修一项技术问题')
write()
write('本地public/post.html的标题、正文和JSON-LD容器为空，public/post.js请求API后才填内容。建议预渲染或服务端生成每篇完整HTML、独立标题/描述、作者和canonical。Google可以渲染JavaScript，但不是所有机器人都能；这不能证明目前文章一定未收录。[Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)')
write()
write('同一文章在www与blog入口有可访问路径，模板未发现canonical。先确定规范URL，让文章链接、sitemap与canonical保持一致。保留公众号原文链接和真实日期；本站不能替微信设置canonical，也不能强制被认定为首发。[Google规范URL指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)')
write()
write('Google AI Overviews/AI Mode仍采用SEO基础条件，没有额外专用schema或AI文本文件的必要入场要求；重要信息用可读文字呈现，结构化数据与页面一致。满足条件也不保证展示或引用；这条官方说明不能推论所有平台算法一样。[Google AI搜索功能说明](https://developers.google.com/search/docs/appearance/ai-features)')
write()
write('本地robots.txt是Allow: /，线上还需核对响应、CDN/WAF与访问情况。若希望ChatGPT搜索访问，OAI-SearchBot与GPTBot训练爬虫可分别设置；允许访问不等于得到推荐。[OpenAI爬虫说明](https://developers.openai.com/api/docs/bots)')
write()
write('上述来自本地源码；没有完成当前生产环境或真实AI搜索链路验收。本轮只交付筛选，不改模板或部署。')
write()
write('## 怎样判断发布后有没有帮助')
write()
write('记录Search Console的品牌词/任务词、对应页面展示与点击；AI搜索按平台、问题、日期、语言和地区留原始回答、名字是否正确与引用URL；真实询盘另记录来源、需求及是否符合业务。访问、收录、名字被提到、实际引用和咨询分别计数。缺数据保持未测量。Google的AI功能流量在GSC Web中汇总，不能从总流量臆造独立GEO增长。[Google AI搜索功能说明](https://developers.google.com/search/docs/appearance/ai-features)')
write()
write('建议先整理9篇候选及承接页面，记录当前基线后上线，再观察具体查询和询盘；后续有新实验或读者问题再更新，避免把篇数当成获客结果。')
write()
write('## 全部98篇逐项清单')
write()
write('JSON附文字证据片段、源文件与SHA-256；CSV可在Excel筛选。每条“优先”都只是编辑投入建议。')
write()
for category in labels:
    write('### ' + labels[category] + '（' + str(counts.get(category, 0)) + '篇）')
    write()
    write('| 编号与原文 | 主题 | 正文判断与处理 |')
    write('| --- | --- | --- |')
    for r in rows:
        if r['category'] == category:
            write('| ' + link(r) + ' | ' + flat(r['topic']) + ' | ' + flat(r['reason']) + ' ' + flat(r['action']) + ' |')
    write()

write('本报告完成新版导出复核、逐篇正文筛选、重点事实边界检查、现有25篇网站文章的相关页对照与建议。实际排名、AI引用和获客改善尚未测量。')
markdown = '\n'.join(out) + '\n'
headers = ['id', 'originalTitle', 'categoryLabel', 'topic', 'reason', 'action', 'requiredEvidence',
           'proposedQueries', 'existingArticleUrl', 'sourceUrl', 'textChars', 'imageCount',
           'contentStatus', 'reviewBasis', 'reviewDepth', 'sourceEvidencePreview', 'sourceFile', 'sha256']
buf = io.StringIO(newline='')
writer = csv.writer(buf)
writer.writerow(headers)
for row in rows:
    cells = []
    for field in headers:
        value = row.get(field)
        value = '；'.join(value) if isinstance(value, list) else str(value if value is not None else '')
        if value.startswith(('=', '+', '-', '@')):
            value = "'" + value
        cells.append(value)
    writer.writerow(cells)

outputs = {
    '.json': json.dumps(audit, ensure_ascii=False, indent=2) + '\n',
    '.csv': '\ufeff' + buf.getvalue(),
    '.md': markdown,
}
paths = [REPORT_DIR / (BASE + suffix) for suffix in outputs]
if any(p.exists() for p in paths):
    raise FileExistsError('Snapshot exists; use a fresh BASE for a new review.')
for suffix, text in outputs.items():
    with (REPORT_DIR / (BASE + suffix)).open('x', encoding='utf-8', newline='') as f:
        f.write(text)
print(json.dumps(dict(categoryCounts=counts, readableTextArticles=audit['readableTextArticles'],
                      emptyExports=audit['emptyExports'], sourceHashesVerified=True,
                      outputs=[str(p) for p in paths]), ensure_ascii=False, indent=2))
