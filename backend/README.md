# AI 浏览器代理 - 后端服务

这是 AI 浏览器代理的后端服务，需要在本地运行。

## 快速开始

1. 安装依赖：
```bash
npm install
```

2. 安装 Playwright 浏览器：
```bash
npx playwright install chromium
```

3. 启动服务：
```bash
npm start
```

服务将在 http://localhost:3000 启动。

## 前端访问

前端已部署在 GitHub Pages：https://ynly4avq.xyz/aaa/

打开前端页面后，后端地址默认是 `ws://localhost:3000`，无需修改。

## 使用步骤

1. 运行 `npm start` 启动后端
2. 浏览器打开 https://ynly4avq.xyz/aaa/
3. 点击 ⚙️ 设置，填入你选择的 AI 模型的 API Key
4. 输入网址并打开
5. 选择 AI 模型，输入任务指令
6. 点击「开始 AI 控制」

## 支持的 AI 模型

- OpenAI: GPT-4o, GPT-4o Mini
- Google: Gemini 1.5 Flash, Gemini 1.5 Pro
- 智谱: GLM-4V
- 通义千问: Qwen-VL-Max, Qwen-VL-Plus
- 月之暗面: Kimi K2
- Anthropic: Claude 3.5 Sonnet