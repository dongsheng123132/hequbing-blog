# 《商业咨询进化史》程序化品牌短片工程

从谋士到 AI，从看清局势到做出结果 · 出品：贺去病AI商业咨询

一支 03:02:20（5480 帧，30 fps）的编年品牌短片，以及一支 62.4 秒的竖版短片。全部画面由代码逐帧生成；配乐由代码编排、用 FluidR3_GM 采样乐器（MIT）演奏；旁白当前为离线 Kokoro 男声（Apache-2.0），商业配音（阿里云百炼）已接好待开通。结果可以复现。

## 交付物

| 路径 | 内容 | 状态 |
|---|---|---|
| `output/final/商业咨询进化史_1080p_字幕版.mp4` | 主交付：1920×1080，30 fps，H.264 + AAC 48 kHz，烧录字幕 | 已验收；**不入库**（体积大），`python -m src.build render` 重新生成 |
| `output/final/商业咨询进化史_1080p_无字幕版.mp4` | 同上，不含字幕 | 已验收；不入库，同上 |
| `output/share/商业咨询进化史_720p_分享版.mp4` / `…竖版_720x1280_分享版.mp4` | 轻量分享版（8.1 MB / 2.8 MB），从成片压缩，音频取自无损主混音，帧数与音画对齐已复核 | 已生成 |
| `output/final/商业咨询进化史_竖版_1080x1920_字幕版.mp4` | 竖版短片，62.4 秒，按竖屏重新构图，另有独立节拍网格 | 已验收；不入库，`python -m src.vertical.render_v` 重新生成 |
| `output/share/商业咨询进化史_主混音_音轨.m4a` | 独立音轨（AAC 256k，5.9 MB）；无损版由 `build audio` 生成，不入库 | 已生成 |
| `output/preview/商业咨询进化史_低清预览_960x540.mp4` | 全片低清动态预览，用来检查节奏和可读性 | 不入库，`build preview` 生成 |
| `subtitles.srt` | SRT 字幕，按实测配音时长生成，帧精度 | 已生成 |
| `beat_grid.csv` / `storyboard.csv` | 统一节拍网格（340 拍）和完整分镜（32 个镜头） | 已生成 |
| `historical_facts.md` | 史实表：事实、采用表述、来源、争议、对应镜头 | 已完成，其中 ★ 链接待人工复核 |
| `narration.txt` | 旁白脚本，带时间码和 TTS 读法 | 已生成 |
| `asset_manifest.csv` | 素材来源和许可 | 已完成 |
| `validation_report.md` | 验收报告，逐条回答 12 个问题，全部为实测数据 | 已生成 |
| `output/review/` | 笔顺联系表、切点抽检、手机尺寸缩略图 | 已生成 |

## 环境与依赖

实测环境：Ubuntu 24.04、Python 3.11、ffmpeg 6.1.1（libx264 / aac / ebur128）、cairo 1.18.0。

```bash
apt-get install -y ffmpeg fonts-noto-cjk fonts-noto-cjk-extra fluidsynth fluid-soundfont-gm
pip install -r requirements.txt
python -m src.fetch_assets        # 下载 Ma Shan Zheng 字体、笔顺数据子集、MeloTTS 模型
```

字体不随工程分发：

- **Noto Serif CJK SC / Noto Sans CJK SC**：SIL OFL 1.1，通过系统包 `fonts-noto-cjk` 和 `fonts-noto-cjk-extra` 安装。代码按文件路径加载 TTC 中的简体中文（SC）字面。
- **Ma Shan Zheng**：SIL OFL 1.1，从 google/fonts 仓库下载（`src/fetch_assets.py`）。

验收用的 ASR 模型只在本地使用，不进入成片。要复跑读音检查，需要把 SenseVoice 模型放到 `.cache/`，链接见 `src/audio/asr_check.py`。

## 一条命令从头生成

```bash
python -m src.build all
```

依次执行：节拍网格 → 分镜 → 旁白 → 混音 → 低清预览 → 1080p 两版 → 验收。然后运行下面两条生成竖版和报告：

```bash
python -m src.vertical.audio && python -m src.vertical.render_v
python -m src.report
```

## 分步命令

| 命令 | 作用 |
|---|---|
| `python -m src.build grid` | 生成 `beat_grid.csv`，并自检总帧数 5480、总采样 8,768,000、各章起点时间码 |
| `python -m src.build storyboard` | 校验镜头首尾相接、整拍、章首在小节第一拍，然后生成 `storyboard.csv` |
| `python -m src.build voice` | 合成或读取锁定配音，生成 `narration.txt`、`subtitles.srt` 和帧级字幕表 |
| `python -m src.build audio` | 配乐、音效、旁白混音，输出到 `output/audio/mix_48k.wav` |
| `python -m src.build frame 4376 --scale 1` | 渲染单帧 PNG（本例为审批印章接触帧） |
| `python -m src.build chapter 6 --scale 0.5` | 渲染指定章节的预览 MP4，带字幕和音轨 |
| `python -m src.build preview` | 全片低清预览，960×540 |
| `python -m src.build render --workers 4` | 1080p 正式渲染：两版同时输出，按 120 帧分段 |
| `python -m src.build validate` | 自动验收，结果写入 `output/work/validation.json` |
| `python -m src.preview 100,2000,4376 --sheet 名称` | 关键帧联系表 |

**中断后继续渲染**：再次执行同一命令即可。已完成且帧数正确的分段会用 ffprobe 逐帧计数确认后跳过，中断的分段只留下 `.part` 文件，会被重新渲染。

**确定性**：画面只由 `frame_index` 决定，不依赖播放速度，也没有屏幕录制。所有随机量都使用固定种子，种子不依赖 Python `hash()`。两次独立生成的 `mix_48k.wav` MD5 一致。

## 工程结构

| 模块 | 文件 |
|---|---|
| config | `config.json`：片名、品牌、画幅、帧率、颜色、字体路径、TTS、响度目标 |
| timeline | `src/timeline.py`：章节、BPM（有理数）、整拍帧与采样换算、`beat_grid.csv`；竖版为 `src/vertical/timeline.py` |
| storyboard | `src/storyboard.py`：32 个镜头、关键动作拍、印章事件（画面与声音共用）；旁白在 `src/narration.py` |
| visuals | `src/visuals/`：宣纸与黑金背景、书法逐笔（`hanzi.py`）、线描道具、纹样、印章、HUD；`src/scenes/ch00–07.py` 为各章镜头；`src/compose.py` 负责单帧合成 |
| audio | `src/audio/`：`synth.py` 合成乐器，`score.py` 原创配乐，`sfx.py` 由分镜事件生成音效，`voice.py` 旁白锁定与排布，`mix.py` 混音与响度 |
| render | `src/render.py`：分段并行渲染、续渲、拼接、封装 |
| validate | `src/validate.py` 与 `src/report.py`：检查日期、字形、帧数、节拍、音画同步、音频峰值、文字扫描，并生成报告 |

## 商业配音：阿里云百炼 CosyVoice

旁白引擎可以切换（`config.json` → `tts.engine`）。

- 已提交的成片仍是离线 MeloTTS（`melo`）。
- 商业配音接入的是阿里云百炼 `cosyvoice-v3-plus`（`cosyvoice`），带三项设置：
  - 纪录片旁白风格指令；
  - “贺去病”“权利害”的发音纠正（`pronunciation`）；
  - 固定种子多条取优。

切换步骤：

1. 在云环境设置里做两件事，然后新开会话：
   - 添加环境变量 `DASHSCOPE_API_KEY`，值为百炼控制台的 API Key；
   - 允许网络访问 `dashscope.aliyuncs.com`。
2. 安装依赖：

   ```bash
   pip install -r requirements.txt
   python -m src.fetch_assets --asr     # 离线 ASR，用于多条取优与读音验收
   ```

3. 试音：`python -m src.audio.audition`。
   - 每个候选音色合成五句代表句，输出到 `output/audition/`。
   - 候选音色写在 `config.json` → `tts.cosyvoice.audition_voices`。音色名以百炼官方《CosyVoice 音色列表》为准，并且必须与模型版本匹配。
4. 听完挑定音色，写入 `tts.cosyvoice.voice`。
5. 一条命令重做：`python -m src.build revoice --engine cosyvoice`。
   - 按顺序执行：新旁白 → 混音 → 重渲带字幕版（无字幕版画面不变，只重新封装）→ 竖版 → 预览 → 验收 → 报告。
   - 字幕按新配音的实测长度自动重排。
   - 如果某句会压到下一句，会自动把这句的语速提高 6% 左右后重新合成，最多提高到 1.25 倍。

投放前，在百炼控制台确认所选音色的商用授权。

## 常见修改

- **更换旁白**：替换 `assets/voice_takes/` 中同名文件，或删除对应文件后修改 `src/narration.py` 的文本，再执行 `build voice` 和 `build audio`。起读点固定在整拍上，字幕与混音按新配音的实测长度自动重排。句子超出本章或与下一句重叠时，`build voice` 会报出。换成真人配音时，把 48 kHz 录音按 `{句子ID}_{hash}.flac` 命名放进去，或直接修改 `voice.synth_line` 的读取路径。
- **替换品牌信息**：修改 `config.json` 的 `brand`（名称、印文、主张、服务、行动邀请）。`contact` 与 `qr_code_path` 为空时，成片不画任何联系方式或二维码。提供真实信息后，落版会在行动邀请下方显示联系方式。
- **重新生成节拍与字幕**：改 BPM 或拍数只能按整小节增减。改完后依次执行 `build grid` → `storyboard` → `voice` → `audio` → `render` → `validate`。时间表只有一份，画面和音乐不会各自维护时间。

## ffmpeg 命令（已执行）

分段编码，每段 120 帧，原始 BGR 帧从管道输入：

```
ffmpeg -f rawvideo -pix_fmt bgr0 -s 1920x1080 -r 30 -i - \
  -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p \
  -c:v libx264 -preset slow -tune animation -crf 19 -g 60 -bf 2 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -r 30 -an chunk.mp4
```

拼接（不重编码）：

```
ffmpeg -f concat -safe 0 -i list.txt -c copy video.mp4
```

封装，音频为 AAC 256k。AAC 的编码延迟由 MP4 编辑表补偿，已用互相关实测起点偏移为 0：

```
ffmpeg -i video.mp4 -i output/audio/mix_48k.wav -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart final.mp4
```

每次执行的实际命令记录在 `output/work/ffmpeg_commands.txt`。这个目录不提交，重新渲染后生成。

## 声明与限制

- 配乐使用 FluidR3_GM 采样音色库（MIT）的真实乐器采样：长笛、筝（Koto）、弦乐、圆号、定音鼓、太鼓、管钟等 GM 标准音色。它们不是骨笛、编钟、琵琶等中国古乐器原声，也不代表还原各时代的真实音乐；数字章节的电子脉冲与部分音效为程序合成。主题旋律为原创五声音阶短动机。
- 当前成片的旁白为 Kokoro-82M v1.1-zh（Apache-2.0）离线合成的男声（sid 60）：从 100 个中文音色中按 ASR 读音准确率与音高筛选，全稿仅 1 句被 ASR 标记（见 `validation_report.md`）。早期的 MeloTTS 版本读音问题较多，已弃用。正式投放前建议切换到阿里云百炼商业配音（见上文）。
- 史实来自搜索索引摘录，本环境无法直接打开官方网页，可信度分级见 `historical_facts.md`。
- 片中的询盘流程是标注过的**流程演示**，不是客户项目。片中没有价格、提效百分比、收益曲线、客户名称、Logo、二维码或联系方式。
