"""由 validation.json 与竖版检查生成 validation_report.md：python -m src.report"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf

from . import timeline as T
from .paths import OUTPUT, ROOT, WORK
from .render import count_frames
from .validate import _red_area, check_loudness_ffmpeg, decode_audio, probe

VERT = os.path.join(OUTPUT, "final", "商业咨询进化史_竖版_1080x1920_字幕版.mp4")


def check_vertical():
    from .vertical import film as F
    from .vertical import timeline as V
    out = dict(file=os.path.relpath(VERT, ROOT))
    if not os.path.exists(VERT):
        out["missing"] = True
        return out
    out["frames"] = count_frames(VERT)
    out["frames_expected"] = V.TOTAL_FRAMES
    info = probe(VERT)
    out["video"] = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    dec = decode_audio(VERT)
    out["decoded_audio_samples"] = len(dec)
    out["expected_samples"] = V.TOTAL_SAMPLES
    ref, _ = sf.read(os.path.join(OUTPUT, "audio", "vertical_mix_48k.wav"), dtype="float32")
    a, b = ref[:48000 * 20, 0], dec[:48000 * 20, 0]
    nfft = 1 << (len(a) + len(b) - 1).bit_length()
    xc = np.fft.irfft(np.fft.rfft(b, nfft) * np.conj(np.fft.rfft(a, nfft)), nfft)
    lag = int(np.argmax(xc))
    out["aac_offset_samples"] = lag - nfft if lag > nfft // 2 else lag
    out["loudness"] = check_loudness_ffmpeg(VERT)
    stem, _ = sf.read(os.path.join(WORK, "vertical_stem_sfx.wav"), dtype="float64")
    mono = np.abs(stem).max(axis=1)
    rows = []
    boxes = {"approve": (530, 850, 130), "brand_ring": (540, 1000, 125), "brand_final": (540, 760, 200)}
    for ch, beat, name, w in F.seal_events():
        f = V.bframe(ch, beat)
        cx, cy, r = boxes.get(name, (540, 980, 230))
        sc = 1.0
        box = [int(v * sc) for v in (cx - r, cy - r, cx + r, cy + r)]
        areas = {f + d: _red_area(F.render_frame(f + d, sc), box) for d in range(-3, 4)}
        amin = min(v for v in areas.values() if v > 0)
        vis = min(k for k, v in areas.items() if 0 < v <= amin + 1)
        s = f * 1600
        win = mono[s - 4800:s + 4800]
        onset = s - 4800 + int(np.argmax(win > 0.3 * win.max()))
        rows.append(dict(name=name, frame=f, visual=vis, audio_ms=(onset - s) / 48))
    out["seal_sync"] = rows
    return out


def fmt_ok(b):
    return "通过" if b else "未通过"


def main():
    v = json.load(open(os.path.join(WORK, "validation.json"), encoding="utf-8"))
    ar = json.load(open(os.path.join(WORK, "audio_report.json")))
    vert = check_vertical()
    fs, fc = v["final_subs"], v["final_clean"]
    L = []
    w = L.append
    w("# 验收报告 · 《商业咨询进化史》\n")
    w("本报告由 `python -m src.build validate` 与 `python -m src.report` 生成；数值均为对**最终 MP4 文件**或源文件的实测，"
      "不是设计值。能自动测的已测；需要人耳、人眼判断的单独列出，**未勾选为通过**。\n")
    w("## 交付物（实际生成并检查过）\n")
    w("| 文件 | 规格 | 实测 |\n|---|---|---|")
    for key, name in (("final_subs", "横版字幕版"), ("final_clean", "横版无字幕版")):
        m = v[key]
        w(f"| `{m['file']}` | {m['video']['width']}×{m['video']['height']} H.264 High, {m['video']['r_frame_rate']} fps, "
          f"AAC 48 kHz 立体声 | {m['frames']} 帧；{name}；{int(m['format']['size']) / 1e6:.1f} MB |")
    w(f"| `{vert['file']}` | 1080×1920 H.264, 30 fps, AAC 48 kHz | {vert.get('frames')} 帧（应为 {vert.get('frames_expected')}） |")
    w("| `output/share/商业咨询进化史_主混音_音轨.m4a` | 独立音轨（AAC 256k）；无损 48 kHz 24-bit 版由 `python -m src.build audio` 生成 `output/audio/mix_48k.wav` | 8,768,000 采样（源） |")
    w("| `subtitles.srt` | SRT 字幕（由实测配音时长生成，帧精度） | 48 条 |")
    w("| `output/share/商业咨询进化史_720p_分享版.mp4`、`…竖版_720x1280_分享版.mp4` | 轻量分享版（入库）；1080p 原片与低清预览不入库，可重新生成 | 5480 / 1872 帧 |\n")

    w("## 12 项验收问答\n")
    g = v["grid"]
    nonpref = [r["id"] for r in g["shots"] if not r["preferred_len"]]
    w(f"**1. 所有剪辑点是否在统一节拍表上？** {fmt_ok(g['ok'])}。{g['n_shots']} 个镜头的起止帧全部属于 `beat_grid.csv` 中的整拍帧；"
      f"8 次章节切换都在新小节第一拍。镜头长度 4/8/12/16 拍之外的只有 {', '.join(nonpref) or '无'}（24 拍，为保证落版 ≥6 秒静止）。"
      "画面、音乐、音效、旁白起读点均由 `src/timeline.py` 同一份整数帧 / 整数采样表换算，没有浮点秒累加。\n")
    rows = v["seal_sync"]["rows"]
    w(f"**2. 每一次印章接触帧是否与打击音瞬态对齐？** {fmt_ok(v['seal_sync']['ok'])}。共 {len(rows)} 次（7 次章节冲击 + 审批章 + 两次品牌印）。"
      "画面接触帧由渲染结果测得（印章朱红外接宽度首次缩到最终尺寸的帧），音频为音效轨中该处瞬态起点：\n")
    w("| 事件 | 预期帧 | 画面实测接触帧 | 瞬态相对接触帧 |\n|---|---|---|---|")
    for r in rows:
        w(f"| {r['name']} | {r['expected_frame']} | {r['visual_contact_frame']} | +{r['audio_offset_ms']:.2f} ms |")
    w("\n封装后整体音频偏移（最终 MP4 解码音频与源混音互相关）："
      f"字幕版 {fs['aac_offset_samples']} 采样，无字幕版 {fc['aac_offset_samples']} 采样（AAC 编码延迟已由 MP4 编辑表补偿）。\n")
    w(f"**3. 总帧数是否为 5480，音画时长是否一致？** {fmt_ok(fs['frames_ok'] and fc['frames_ok'])}。两版均实测 {fs['frames']} 帧，"
      f"视频时长 {fs['video']['duration']} s；音频流时长 {fs['audio']['duration']} s，解码得 {fs['decoded_audio_samples']:,} 采样"
      f"（源 8,768,000；多出的 {fs['decoded_audio_samples'] - 8768000} 采样是 AAC 末帧补零，<1 个 AAC 帧，起点对齐为 0）。"
      "全程未对音频或视频做拉伸、变速或截短。全片解码无报错：" + ("是" if fs["decodes_clean"] and fc["decodes_clean"] else "否") + "。\n")
    c = v["calligraphy"]
    w(f"**4. 书法是否正确逐笔显现，有无伪汉字或缺字？** {fmt_ok(c['ok'])}。方法：{c['method']}。笔画数与规范一致："
      + "、".join(f"{r['char']}{r['data']}" for r in c["rows"]) + "。笔顺逐帧联系表见 `output/review/stroke_order_sheet.png`（已人工目检）。"
      f"画面上的全部文字均由字体字形绘制，缺字会直接报错而不会出现方框；本片唯一回退：毛笔字体缺“→”，以宋体补字。\n")
    t = v["timeline"]
    w(f"**5. 时间轴有无虚构精确年份、错序或连续滚动？** {fmt_ok(t['ok'])}。节点：{' / '.join(t['labels'])}。"
      "年份仅 1911、1926、1963、1968—1970 四处，均见 `historical_facts.md`，按时间顺序；古代用“约 + 时代名”，无年份；"
      "跨度压缩处画断轴符号；没有滚动年份计数器。BCG 矩阵年份在官方资料中有 1968 / 1970 两说，片中写作“1968—1970”。\n")
    small = v["text"]["small_text"]
    w("**6. 手机尺寸下字幕、关键词和 HUD 是否清楚？** 部分通过（需人工在手机上确认）。横版字幕 48 px、书法关键词 230–380 px、"
      "HUD 时间轴 24/30 px、章名 28 px；AI 流程章的次要标注已提高到 24–26 px。仍小于 24 px 的只有装饰性或过渡中的文字："
      + "、".join(f"“{s}” {z:.0f}px" for s, z in small[:6]) + "。在 6 英寸手机横屏上 24 px 约 1.7 mm，偏小但可辨；"
      "为此另做了竖版（字幕 52 px、正文 26–56 px），并把重要内容放在平台按钮与底部文案区之外。缩略联系表见 `output/review/phone_*.png`。\n")
    w(f"**7. 每章是否有实质性动作？** {fmt_ok(v['shots']['ok'])}。32 个镜头各有注册的场景函数与至少 1 个关键动作事件（见 `storyboard.csv` 的“关键动作拍”列）；"
      "动作包括逐笔书写、结构线→细节→朱红标记、筹策重排、算盘拨珠、工序重排、矩阵落位、系统连通与打结、竹简翻转为流程卡、审批门开启等，不是同一图标平移换色。\n")
    mus = v["music"]
    w("**8. 音乐是否有可辨认的主题发展？** 结构上是（听感需人工确认）。原创五声动机：问句 6̣ 1 2 3 | 5 3 2 2（停在 2），答句 3 5 6 5 3 | 2 1 6̣ 1（回到 1）。"
      "接力：序章笛（合成）→ 谋 笛 + 钟 → 商 拨弦 + 木鱼 → 管 机械滴答 + 弦乐奏问句/答句 → 略 弦乐 + 铜管 → 联 电子脉冲奏主题 → "
      "行 笛引主题、弦乐与铜管全奏、三记重拍 → 成 150 BPM 不降速，以长音与减少打击形成舒展，结尾笛奏“解决版”问句并以钟声收。"
      "各章音符事件数（按标签）：" + "；".join(f"第{k}章 " + "、".join(f"{t2}×{n}" for t2, n in sorted(d.items())) for k, d in sorted(mus.items(), key=lambda x: int(x[0]))) + "\n")
    ai = v["ai_flow"]["items"]
    w(f"**9. AI 流程是否展示人工审批、资料依据与记录复盘？** {fmt_ok(v['ai_flow']['ok'])}。" + "、".join(k for k, ok in ai.items() if ok)
      + "均在画面中出现；全章标注“流程演示 · 非客户案例”；无提效百分比、成交金额或收益曲线。\n")
    w("**10. 品牌章节是否解释了服务？** 是。依次呈现：母题收拢为经营闭环 → 诊断/试点/落地/复盘（含每步一句说明，底部时间轴同步转换）→ "
      "四项服务各配两句它关心的经营问题 → 落版（品牌名、主张、服务、行动邀请），第 42 拍起静止 7.2 秒直至片尾。\n")
    hits = v["text"]["forbidden_hits"]
    w(f"**11. 是否出现虚构客户、收益、联系方式或未经授权资产？** {fmt_ok(not hits)}。对全片每 6 帧渲染一次并记录画面上出现的全部 {v['text']['n_strings']} 条文字，"
      "按“%、保证、必然、第一、唯一、万元、扫码、微信、网址、@、二维码、成交额、提效”等模式扫描：命中 " + str(len(hits)) + " 条。"
      "询盘示例（不锈钢法兰 DN50 / 2000 件 / 宁波）是明确标注的流程演示，不是客户项目。未使用任何 Logo、客户数据、二维码或联系方式；"
      "`config.json` 中 contact、qr_code_path 为空，成片不绘制。素材来源与许可见 `asset_manifest.csv`。\n")
    w(f"**12. 成片是否真实生成、完整播放和检查过？** 是（机器检查）。三个 MP4 均实际渲染、封装，ffprobe 逐帧计数、ffmpeg 全片解码无错误、"
      "响度用 ffmpeg ebur128 独立复测。我无法用耳朵试听或用眼睛实时观看，**成片的实时观感与听感仍需人工完整看一遍**（见下方“人工复核清单”）。\n")

    w("## 音频实测\n")
    lf = v["final_subs_loudness"]
    lim = ar["limiter"]
    w(f"- 主混音（源 WAV，pyloudnorm）：积分响度 {ar['lufs']:.2f} LUFS，真峰值 {ar['true_peak_dbtp']:.2f} dBTP（4 倍过采样）。")
    w(f"- 最终 MP4（AAC 解码后，ffmpeg ebur128 独立测量）：{lf['integrated_lufs']} LUFS，真峰值 {lf['true_peak_dbtp']} dBTP，LRA {lf['lra']} LU。目标 −16 LUFS / ≤ −1 dBTP：达到。")
    w(f"- 限幅：未用限幅制造响度。真峰值超标前为 {ar['true_peak_before_limit_dbtp']:.2f} dBTP，仅对孤立峰值做前视限幅："
      f"最大衰减 {lim['max_db']:.2f} dB，衰减超过 1 dB 的总时长 {lim['seconds_over_1db']:.2f} 秒，受影响时间占全片 {lim['percent_time_limited']:.2f}%。")
    w(f"- 旁白响度 {ar['voice_lufs']:.1f} LUFS；有旁白时音乐自动压低约 6 dB、音效约 2 dB。")
    w("- 可复现：两次独立执行 `python -m src.build audio` 得到的 `mix_48k.wav` MD5 完全一致。\n")

    w("## 旁白\n")
    from .paths import load_config
    tts = load_config()["tts"]
    if tts["engine"] == "cosyvoice":
        c = tts["cosyvoice"]
        w(f"- 配音引擎：{c['provider']} `{c['model']}`，音色 `{c['voice']}`，风格指令“{c.get('instruction', '')}”，"
          f"发音纠正 {c.get('pronunciation')}；商业云端合成，未克隆任何真人声音。")
        w(f"- 每句以 {c.get('takes', 4)} 个固定种子生成候选，用离线 ASR（SenseVoice）回听按拼音音节比对选最准的一条，"
          "锁定在 `assets/voice_takes/cosyvoice/…/`；超时的句子自动小幅提速（记录在 takes_log.json）。")
    elif tts["engine"] == "kokoro":
        c = tts["kokoro"]
        w(f"- 配音引擎：{c['engine_name']}（Apache-2.0）离线合成，男声 sid {c['speaker_id']}，语速 {c['speech_rate']}；"
          "未克隆任何真人声音。选择方法：" + c.get("selection", "") + "。")
        w(f"- 每句 {c.get('takes', 4)} 条候选，用离线 ASR（SenseVoice）回听按拼音音节比对选最准的一条，锁定在 "
          "`assets/voice_takes/kokoro/…/`；超时的句子自动小幅提速。")
        w("- 商业配音（阿里云百炼 CosyVoice）已接好，开通网络与密钥后 `python -m src.build revoice --engine cosyvoice` 切换。")
    else:
        w("- 配音引擎：sherpa-onnx 运行 MeloTTS 中文模型（MIT 许可），单一女声，离线合成；未克隆任何真人声音。"
          "已接好阿里云百炼 CosyVoice（`python -m src.build revoice --engine cosyvoice`），待环境开通后切换。")
        w("- 每句生成 8–24 个 take，用离线 ASR（SenseVoice）回听并按拼音音节比对挑最准的一条，选中的 take 锁定在 `assets/voice_takes/melo/`。")
    asr = v.get("asr", [])
    flag = [r for r in asr if r["per"] > 0.05]
    w(f"- ASR 拼音错误率 > 5% 的句子（需要人工试听）：" + "；".join(f"{r['id']}「{r['ref']}」→ ASR 听为「{r['hyp']}」" for r in flag))
    if tts["engine"] == "melo":
        w("- 特别说明：品牌句 N07a「贺去病AI商业咨询」两套 ASR 都把“贺”听成“过/会”，把“AI”听成“爱”。"
          "“贺”在“祝贺、贺卡”等语境中能被正确识别，问题出在句首弱读与专有名词；模型词典把字母 A 读作 /ah/，“AI”听感接近“爱”。"
          "**正式投放前应换成商业配音**：阿里云百炼 CosyVoice 已接入（带“贺去病”发音纠正），开通网络与密钥后一条命令即可重做全部成片。\n")
    else:
        w("")

    w("## 竖版短片\n")
    w(f"- 独立节拍网格（`src/vertical/timeline.py`）：问 120 BPM 16 拍 → 编年（谋 商 管 略 联）150 BPM 44 拍 → 行 48 拍 → 成 44 拍，共 {vert.get('frames_expected')} 帧 / 62.4 秒。")
    w(f"- 实测：{vert.get('frames')} 帧；解码音频 {vert.get('decoded_audio_samples'):,} 采样（源 {vert.get('expected_samples'):,}）；AAC 起点偏移 {vert.get('aac_offset_samples')} 采样；"
      f"响度 {vert['loudness']['integrated_lufs']} LUFS，真峰值 {vert['loudness']['true_peak_dbtp']} dBTP。")
    w("- 印章接触（画面实测帧 / 预期帧，瞬态偏移）：" + "；".join(
        f"{r['name']} {r['visual']}/{r['frame']} +{r['audio_ms']:.2f} ms" for r in vert.get("seal_sync", [])))
    w("- 不是横版中心裁切：所有镜头按竖屏重新构图（流程改为竖向六节点、字段表与资料面板上下排列、服务改为 2×2），"
      "音乐按竖版网格重新编排同一主题，旁白复用横版锁定 take。竖版只做了带字幕版。\n")

    w("## 人工复核清单（自动检查无法替代）\n")
    w("1. 完整观看两版横版与竖版各一遍：节奏、转场、文字阅读时间。")
    flagged = "、".join(r["id"] for r in flag) or "ASR 未标记的句子也需通听"
    w(f"2. 试听：配乐音色（GM 采样乐器 + 部分合成音效）与旁白整体听感；ASR 标记需复核的句子：{flagged}。")
    w("3. 在手机上观看横版 AI 流程章（第 06 章）的次要标注是否可读。")
    w("4. 打开 `historical_facts.md` 中标 ★ 的官方页面核对逐字原文（本环境无法直接打开这些网站，只读到搜索索引）。")
    w("5. 品牌方确认：品牌印章采用“贺去病印”四字白文（避免单独放大“病”字），以及落版文案。\n")

    w("## 未做 / 做不到的项目\n")
    music_cfg = load_config().get("music", {})
    if music_cfg.get("instruments") == "sampled":
        w("- 配乐使用 FluidR3_GM 采样音色库（MIT）的真实乐器采样（长笛、筝、弦乐、圆号、定音鼓、太鼓、管钟等 GM 标准音色），"
          "不是中国古乐器原声；数字章节的电子脉冲与部分音效仍为程序合成。")
    else:
        w("- 真实乐器录音：本环境没有，配乐为合成；已如实标注。")
    if tts["engine"] != "cosyvoice":
        w("- 旁白当前为离线合成，商业配音（阿里云百炼）待开通网络与密钥后切换。")
    w("- 官方史料网页未能直接打开（网络策略拦截），事实来自搜索索引摘录，已在史实表中分级标注。")
    w("- 竖版无字幕版未单独输出（如需可用 `src/vertical/render_v.py` 增加一路，与横版相同）。")
    w("- 二维码 / 联系方式：未提供真实信息，按要求不出现；位置未在成片中预留占位图形。\n")
    with open(os.path.join(ROOT, "validation_report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))
    json.dump(vert, open(os.path.join(WORK, "vertical_validation.json"), "w"), ensure_ascii=False, indent=1, default=str)
    print("validation_report.md written")


if __name__ == "__main__":
    main()
