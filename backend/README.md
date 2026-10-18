# 🤖 AI Browser Agent - AI 浏览器代理

一个让 AI 自动控制浏览器的网页应用。AI 通过视觉模型查看网页截图，理解任务，自动执行点击、输入、滚动、导航等操作。

## ✨ 功能特性

- 🌐 **网页浏览** — 在左侧浏览器视图中打开任意网址，实时截图流
- 🖱️ **用户控制** — 可直接点击、滚动、输入操作浏览器
- 🤖 **AI 自动控制** — 输入任务指令，AI 自动操作网页完成任务
- 💡 **实时思考过程** — 右侧面板实时显示 AI 的分析和决策
- 🟠 **AI 控制高亮** — AI 操作时浏览器边框橙色发光高亮
- ⏸️ **随时暂停/插手** — 暂停/继续/停止；用户点击页面自动暂停 AI
- ❓ **AI 提问** — AI 遇到困难时向用户提问，获得回答后继续
- 🆓 **免费 AI 模型** — 支持 Puter.js 免费模型（无需 API Key，免费 Puter 账号登录即可）
- 🔧 **9 个付费视觉 AI 模型** — 支持 GPT-4o、Gemini、GLM-4V、Qwen-VL、Kimi、Claude 等

## 🧠 支持的 AI 模型

### 免费模型（无需 API Key）

| 模型 | 说明 |
|------|------|
| 🆓 Gemini 3.8 Flash | Google 多模态模型，速度快 |
| 🆓 Gemini 2.5 Flash | Google 多模态模型，稳定 |
| 🆓 Reka Edge | Reka AI 视觉语言模型，轻量快速 |

> 免费模型通过 Puter.js 在浏览器端运行，无需 API Key。首次使用时需登录免费的 Puter 账号。

### 付费模型（需 API Key）

| 提供商 | 模型 | 速度 |
|--------|------|------|
| OpenAI | GPT-4o, GPT-4o Mini | ⚡🚀 |
| Google | Gemini 1.5 Flash, Gemini 1.5 Pro | ⚡🐢 |
| 智谱 Zhipu | GLM-4V | 🐢 |
| 通义千问 Qwen | Qwen-VL-Max, Qwen-VL-Plus | 🚀⚡ |
| 月之暗面 Moonshot | Kimi K2 | 🚀 |
| Anthropic | Claude 3.5 Sonnet | 🐢 |

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务

```bash
npm start
```

服务运行在 http://localhost:3000

### 3. 访问前端

**方式一（推荐）：直接访问本地后端**
- 打开浏览器访问 `http://localhost:3000`
- 这样可以避免 HTTPS 混合内容问题

**方式二：通过 GitHub Pages 访问**
- 访问 `https://ynly4avq.xyz/aaa/`
- 如果连接失败，请改用 `http://localhost:3000`

### 4. 使用免费 AI

1. 从模型下拉框选择带 🆓 的免费模型
2. 顶部 URL 栏输入网址并打开
3. 右侧输入任务指令
4. 点击「开始 AI 控制」
5. 首次使用时在弹出的 Puter 登录窗口中登录（免费注册）
6. AI 自动截图、分析、操作网页

## ⚠️ 常见问题

### 无法打开网页 / 后端未连接

1. 确保后端已启动：`npm start`
2. 确保后端地址为 `ws://localhost:3000`
3. 如果从 GitHub Pages (HTTPS) 访问仍无法连接，请改用 `http://localhost:3000` 打开本页

### 免费 AI 无法使用

1. 确保已登录 Puter 账号（点击「开始 AI 控制」时会弹出登录窗口）
2. Puter 账号完全免费，注册即可使用

## 📁 项目结构

```
├── server.js          # 后端服务器 (Express + WebSocket + Playwright)
├── agent.js           # AI 代理核心逻辑 (截图→分析→执行 循环)
├── ai-providers.js    # 9个视觉AI模型集成
├── package.json       # 依赖配置
└── public/
    ├── index.html     # 前端页面
    ├── style.css      # 深色主题样式
    └── client.js      # 前端交互逻辑
```

## 🔧 技术栈

- **后端**: Node.js + Express + WebSocket + Playwright
- **前端**: 原生 HTML/CSS/JavaScript
- **免费 AI**: Puter.js (浏览器端运行，无需后端 AI 调用)
- **付费 AI**: 9 个视觉大模型 API 统一接口

## 📄 License

MIT
