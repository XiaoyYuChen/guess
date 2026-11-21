# 看图猜诗词 · 猜成语

一款水墨国风、移动端优先的「看图猜诗词 / 猜成语」单机网页小游戏。

使用舒尔特方格（Schulte Grid）的注意力训练方式：孩子需要在有限时间内扫视字阵、辨认目标汉字并快速点选，在闯关中完成一次轻量的视觉搜索练习。
- **训练专注力与视觉搜索**：像舒尔特方格一样，孩子要在混有形近字、干扰字的字阵中快速找到目标汉字，锻炼注意力广度、扫视效率和手眼协调。
- **看图联想，锻炼观察力**：先观察画面，再从字阵中找出对应汉字，把图像、语义和字形联系起来。
- **边玩边积累诗词成语**：157 首诗词 + 100 个成语，通关过程中自然接触诗句、作者、朝代和成语典故。
- **强化汉字认知**：字阵中混有形近字和干扰字，需要分辨字形、字义，反复练习选字组词。
- **限时挑战，提升反应速度**：10 秒看图预览、30 秒答题计时，帮助孩子养成专注观察、快速思考的习惯。
- **培养目标感与抗挫折能力**：三星评价、逐关解锁，答错还能使用重试卡，让孩子在鼓励中反复尝试。
- **适合亲子共玩**：家长可以结合画面讲诗句、说成语故事，把游戏变成轻松的亲子阅读时间。
- **无广告、无登录、无内购**：打开即玩，进度保存在本机，孩子使用更省心。

- 在线试玩：<https://xiaoyyuchen.github.io/guess/>
- 关卡规模：**257 关**（157 首诗词 + 100 个成语）
- 技术特点：原生 HTML + CSS + ES Modules，零依赖、零构建即可运行

## 玩法

1. **看图**：每关先展示配图，预览 10 秒，3 秒后可以跳过。
2. **选字**：从下方字阵中依次点选汉字，填满答案后提交；点错可删除最后一个字。
3. **计分**：每阶段限时 30 秒，答对得星。
   - 诗词：依次填写「诗名 → 朝代·作者 → 诗句」，每阶段 1 星，满分 3 星。
   - 成语：一关一个阶段，答对即得 3 星。
4. **判定**：答错时可消耗一张「重试卡」继续本题；超时或放弃则本局失败。
5. **解锁**：单关获得 **2 星及以上**即可解锁下一关，最佳星级与最短用时会被记录。
6. **道具**：每关可使用「提示卡」「加时卡」「重试卡」，次数可在设置中调整（0–9）。

字阵规模会随关卡难度变化，从 2×6 到 9×9 不等，并会混入形近字与干扰字，难度逐关提升。

## 功能特性

- 257 关完整内容，诗词与成语双模式切换
- 水墨风界面、毛笔字体、逐关配图与音效/BGM
- 动态字阵生成：答案字 + 形近字 + 干扰字混合洗牌
- 星级评价、关卡解锁、最佳成绩记录
- 声音与音乐开关、每关道具次数自定义
- 进度自动保存在本机，可单独重置配置或关卡进度
- 移动端全屏适配，桌面端自动居中显示
- 支持构建为离线单文件版（含 iPad 全内嵌版）

## 快速开始

需要任意静态文件服务器（项目自带 `start.bat`，使用 Python 的 `http.server`）。

```bat
:: Windows：双击 start.bat，或执行
start.bat
```

```bash
# 也可以手动启动
python -m http.server 8080
```

打开 <http://localhost:8080/> 即可游玩。

> 注意：在线版通过 `fetch` 加载 `data/` 下的 JSON，**不能直接双击 `index.html`**（`file://` 协议会被浏览器拦截）。离线单文件版没有此限制。

## 项目结构

```text
guess/
├── index.html              # 在线版入口
├── start.bat               # 启动本地静态服务器并打开浏览器
├── css/
│   ├── base.css            # 变量、重置、字体、通用组件
│   ├── screens.css         # 欢迎页、选关页、设置页、声明页
│   ├── game.css            # 预览、答题区、字阵、底栏、结算
│   └── animations.css      # 星星、翻牌、红边等动画
├── js/
│   ├── main.js             # 启动与路由注册
│   ├── config.js           # 计时、字阵规模、道具初始值等常量
│   ├── data.js             # 关卡目录/详情/语料的加载与缓存
│   ├── storage.js          # 本地存档读写与重置
│   ├── audio.js            # BGM 与音效管理
│   ├── router.js           # hash 路由
│   ├── state.js            # 运行时状态
│   ├── utils.js            # 通用工具函数
│   ├── components/         # 弹窗、Toast
│   ├── game/               # 阶段、字阵、结算
│   └── screens/            # 欢迎、选关、答题、设置、声明
├── data/
│   ├── catalog_index.json  # 257 关索引
│   ├── catalog_snippets.json
│   ├── similar_chars.json  # 形近字表
│   └── detail/             # 每关详情（poetry/、idiom/）
├── assets/
│   ├── images/             # 界面素材与 257 张关卡配图
│   ├── bgm/                # 2 首背景音乐
│   ├── sfx/                # 音效
│   └── fonts/              # 马善政毛笔字体（OFL）
└── tools/
    ├── build-offline.mjs   # 离线单文件构建脚本
    ├── ipad-assets.py      # 生成 iPad 自包含版素材映射
    └── game9.png
```

## 数据与存档

- 关卡详情按需加载，不会一次性读取全部配图。
- 存档使用 `localStorage`：
  - `guesspoems_progress_v1`：解锁进度、最佳星级与用时
  - `guesspoems_profile_v1`：声音/音乐开关、每关道具次数等
- 设置页提供「重置配置」和「重置关卡」两个独立入口。

## 构建离线版

在线版零构建；离线版需要 Node.js（生成全内嵌 iPad 版还需要 Python）。

```bash
node tools/build-offline.mjs
```

输出到 `离线版/`：

| 产物 | 说明 |
| --- | --- |
| `看图猜诗词.html` | 单文件页面，需与同目录 `assets/` 一起使用 |
| `看图猜诗词-iPad.html` | 图片、音频、字体全部内嵌，单个 HTML 即可运行（约 30 MB） |
| `assets/` | 离线资源目录 |

iPad 自包含版依赖：

```bash
pip install pillow fonttools imageio-ffmpeg
```

> `tools/build-offline.mjs` 中的 `ROOT` 默认指向 `D:\AIProjects\guess`，克隆到其他路径时请先改成你的项目目录。

离线包是构建产物，已被 `.gitignore` 忽略（`离线版/`、`*.zip`），不会提交到仓库。

## 部署到 GitHub Pages

本项目是纯静态站点，不需要编译，推荐直接用分支部署：

1. 将代码推送到 GitHub 仓库的 `main` 分支。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment → Source** 选择 **Deploy from a branch**。
4. **Branch** 选择 `main`，目录选择 `/ (root)`，点击 **Save**。
5. 等待一两分钟，访问 `https://<你的用户名>.github.io/guess/`。

示例地址：<https://xiaoyyuchen.github.io/guess/>

GitHub Pages 的站点根目录就是仓库根目录，`index.html`、`data/`、`assets/` 都能被直接访问，无需额外配置。

## 离线包如何分发

**不建议把 `离线版/` 或 64 MB 的 zip 直接提交进 Git 仓库**，原因：

- 仓库体积和克隆时间会明显变大；
- 构建产物每次重新生成都会产生新的二进制版本，历史记录会持续膨胀；
- GitHub 对单个文件有 100 MB 限制，Pages 站点也有体积限制。

推荐做法是把离线包作为 **GitHub Release 附件**发布，Pages 只托管在线版：

1. 在本地执行 `node tools/build-offline.mjs`。
2. 将 `离线版/` 打包为 zip。
3. 打开仓库 **Releases → Draft a new release**，填写版本号并上传 zip。
4. 在 README 或社区帖子中链接 Releases 页面。

也可以使用 GitHub CLI 一条命令发布：

```bash
gh release create v1.0.0 "看图猜诗词-离线版.zip" \
  --title "v1.0.0 离线版" \
  --notes "解压后双击 看图猜诗词.html 即可离线游玩。"
```

> Release 附件支持最大 2 GB 的单文件，64 MB 的离线包完全没问题。

## 技术栈

- 原生 HTML / CSS / JavaScript（ES Modules）
- Hash 路由与 DOM 渲染，无框架、无打包器
- 原生 `Audio` 播放 BGM 与音效，首次交互后解锁
- 本地 `localStorage` 存档
- Node.js 脚本将 ES Modules 与 JSON 内联为离线单文件

## 声明与致谢

- 游戏内文字、图像、代码与关卡内容由 AI 工具辅助生成（豆包、DeepSeek）。
- 背景音乐与部分音效来源于「爱给网」，遵循 CC0 1.0 公共领域贡献声明。
- 毛笔字体为马善政毛笔字体（Ma Shan Zheng），遵循 SIL Open Font License。
- 特别献词：献给我的女儿可心。

## 许可证

本项目代码采用 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 开源协议，可自由使用、修改和分发，但需保留版权与许可声明，并遵守协议条款。

> 字体、背景音乐、音效等第三方素材仍遵循各自原有许可（如字体的 SIL Open Font License）。
