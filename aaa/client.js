/**
 * AI Browser Agent - Client
 * Handles WebSocket communication, browser view rendering, and user interactions
 */

// Free AI models powered by Puter.js (no API key required, free Puter account login)
const FREE_MODELS = [
    { id: 'free-gemini-3.8-flash', name: '🆓 Gemini 3.8 Flash (免费)', provider: 'free', puterModel: 'google/gemini-3.8-flash', vision: true, speed: 'fast', free: true },
    { id: 'free-gemini-2.5-flash', name: '🆓 Gemini 2.5 Flash (免费)', provider: 'free', puterModel: 'google/gemini-2.5-flash', vision: true, speed: 'fast', free: true },
    { id: 'free-reka-edge', name: '🆓 Reka Edge (免费)', provider: 'free', puterModel: 'rekaai/reka-edge', vision: true, speed: 'fast', free: true },
];

class AIBrowserAgentClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.currentUrl = 'about:blank';
        this.viewport = { width: 1280, height: 800 };
        this.agentRunning = false;
        this.agentPaused = false;
        this.models = [];
        this.apiKeys = {};
        this.backendUrl = 'ws://localhost:3000';
        this.canvas = null;
        this.ctx = null;
        this.scale = 1;
        this.reconnectAttempts = 0;

        // Free AI agent state (Puter.js)
        this.freeAgent = null;
        this.freeAgentRunning = false;
        this.freeAgentPaused = false;
        this.freeAgentStopped = false;
        this.freeAgentAuthed = false;

        this.init();
    }

    init() {
        this.canvas = document.getElementById('browser-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.loadSettings();
        this.populateModelSelect(); // Show free models immediately
        this.connectWebSocket();
        this.setupEventListeners();
    }

    // --- WebSocket ---

    connectWebSocket() {
        const wsUrl = this.backendUrl;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected to', wsUrl);
            this.connected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected. Reconnecting in 2s...');
            this.connected = false;
            this.updateConnectionStatus(false);
            this.reconnectAttempts++;
            const delay = Math.min(2000 * this.reconnectAttempts, 10000);
            setTimeout(() => this.connectWebSocket(), delay);
        };

        this.ws.onerror = (e) => {
            console.error('WebSocket error:', e);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };
    }

    updateConnectionStatus(connected) {
        const el = document.getElementById('connection-status');
        if (!el) return;
        const dot = el.querySelector('.conn-dot');
        const text = el.querySelector('.conn-text');
        if (connected) {
            el.classList.add('connected');
            el.classList.remove('disconnected');
            text.textContent = '已连接';
        } else {
            el.classList.remove('connected');
            el.classList.add('disconnected');
            text.textContent = '未连接';
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected');
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'init':
                this.models = message.models || [];
                this.viewport = message.viewport || this.viewport;
                this.currentUrl = message.currentUrl || 'about:blank';
                this.populateModelSelect();
                this.updateUrlDisplay();
                break;

            case 'screenshot':
                this.renderScreenshot(message.data, message.viewport);
                break;

            case 'screenshot_taken':
                // Fresh screenshot requested by free agent - also render it
                this.renderScreenshot(message.data, message.viewport);
                break;

            case 'agent_screenshot':
                // AI's screenshot - also render it
                this.renderScreenshot(message.data, this.viewport);
                break;

            case 'navigation_start':
                document.getElementById('browser-overlay').classList.add('hidden');
                break;

            case 'navigation_complete':
                this.currentUrl = message.url;
                this.updateUrlDisplay();
                break;

            case 'navigation_error':
                this.addThinkingEntry(`Navigation error: ${message.error}`, 0);
                break;

            case 'agent_started':
                this.setAgentActive(true);
                this.clearThinkingLog();
                this.clearActionsLog();
                this.showAgentControls('running');
                break;

            case 'agent_stopped':
                this.setAgentActive(false);
                this.showAgentControls('idle');
                break;

            case 'agent_paused':
                this.agentPaused = true;
                this.setAgentActive(false);
                this.showAgentControls('paused');
                break;

            case 'agent_resumed':
                this.agentPaused = false;
                this.setAgentActive(true);
                this.showAgentControls('running');
                break;

            case 'agent_done':
                this.addThinkingEntry(`✅ ${message.message}`, message.step || 0);
                this.setAgentActive(false);
                this.showAgentControls('idle');
                break;

            case 'agent_error':
                this.addThinkingEntry(`❌ Error: ${message.error}`, 0);
                this.setAgentActive(false);
                this.showAgentControls('idle');
                break;

            case 'step':
                break;

            case 'agent_thinking':
                this.addThinkingEntry(message.text, message.step || 0);
                break;

            case 'agent_action':
                this.addActionEntry(message.action);
                break;

            case 'action_executed':
                break;

            case 'agent_ask':
                this.showQuestion(message.question, message.step || 0);
                break;

            case 'agent_status':
                break;
        }
    }

    // --- Screenshot Rendering ---

    renderScreenshot(base64Data, viewport) {
        if (viewport) {
            this.viewport = viewport;
        }

        const img = new Image();
        img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);

            // Update overlay
            const overlay = document.getElementById('browser-overlay');
            if (this.currentUrl && this.currentUrl !== 'about:blank') {
                overlay.classList.add('hidden');
            }
        };
        img.src = `data:image/jpeg;base64,${base64Data}`;
    }

    // --- URL Navigation ---

    navigate() {
        const urlInput = document.getElementById('url-input');
        let url = urlInput.value.trim();
        if (!url) return;

        this.sendMessage({ type: 'navigate', url });
        document.getElementById('browser-overlay').classList.add('hidden');
    }

    updateUrlDisplay() {
        document.getElementById('browser-url').textContent = this.currentUrl;
        document.getElementById('url-input').value = this.currentUrl === 'about:blank' ? '' : this.currentUrl;
    }

    // --- Model Selection ---

    populateModelSelect() {
        const select = document.getElementById('model-select');
        select.innerHTML = '<option value="">选择 AI 模型...</option>';

        // Group by provider
        const grouped = {};

        // Add free models first
        for (const model of FREE_MODELS) {
            if (!grouped['free']) grouped['free'] = [];
            grouped['free'].push(model);
        }

        // Add backend models (paid)
        for (const model of this.models) {
            if (!grouped[model.provider]) grouped[model.provider] = [];
            grouped[model.provider].push(model);
        }

        const providerNames = {
            free: '🆓 免费模型 (无需 API Key)',
            openai: 'OpenAI',
            google: 'Google',
            zhipu: '智谱 Zhipu',
            qwen: '通义千问 Qwen',
            moonshot: '月之暗面 Moonshot',
            anthropic: 'Anthropic'
        };

        // Free models first
        if (grouped['free']) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = providerNames['free'];
            for (const model of grouped['free']) {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                optgroup.appendChild(option);
            }
            select.appendChild(optgroup);
        }

        for (const [provider, models] of Object.entries(grouped)) {
            if (provider === 'free') continue;
            const optgroup = document.createElement('optgroup');
            optgroup.label = providerNames[provider] || provider;
            for (const model of models) {
                const option = document.createElement('option');
                option.value = model.id;
                const speedLabel = model.speed === 'very-fast' ? '⚡' : model.speed === 'fast' ? '🚀' : '🐢';
                option.textContent = `${speedLabel} ${model.name}`;
                optgroup.appendChild(option);
            }
            select.appendChild(optgroup);
        }
    }

    getSelectedModel() {
        return document.getElementById('model-select').value;
    }

    isFreeModel(modelId) {
        return FREE_MODELS.some(m => m.id === modelId);
    }

    getFreeModel(modelId) {
        return FREE_MODELS.find(m => m.id === modelId);
    }

    getApiKeyForModel(modelId) {
        if (this.isFreeModel(modelId)) return 'free'; // No API key needed
        const model = this.models.find(m => m.id === modelId);
        if (!model) return null;
        return this.apiKeys[model.provider] || null;
    }

    // --- Agent Control ---

    startAgent() {
        const model = this.getSelectedModel();
        const task = document.getElementById('task-input').value.trim();

        if (!model) {
            alert('请先选择一个 AI 模型');
            return;
        }

        // Free models don't need API key
        if (!this.isFreeModel(model)) {
            const apiKey = this.getApiKeyForModel(model);
            if (!apiKey) {
                alert(`请先在设置中配置该模型的 API Key`);
                document.getElementById('settings-btn').click();
                return;
            }
        }

        if (!task) {
            alert('请输入任务指令');
            return;
        }

        if (this.currentUrl === 'about:blank') {
            alert('请先打开一个网页');
            return;
        }

        if (this.isFreeModel(model)) {
            // Use frontend-based free AI agent (Puter.js)
            this.startFreeAgent(model, task);
        } else {
            // Use backend-based agent (requires API key)
            const apiKey = this.getApiKeyForModel(model);
            this.sendMessage({
                type: 'start_agent',
                model,
                apiKey,
                task
            });
        }
    }

    pauseAgent() {
        if (this.freeAgentRunning) {
            this.freeAgentPaused = true;
            this.addThinkingEntry('Agent paused by user.', 0);
            this.setAgentActive(false);
            this.showAgentControls('paused');
        } else {
            this.sendMessage({ type: 'pause_agent' });
        }
    }

    resumeAgent() {
        if (this.freeAgentRunning) {
            this.freeAgentPaused = false;
            this.addThinkingEntry('Agent resumed.', 0);
            this.setAgentActive(true);
            this.showAgentControls('running');
        } else {
            this.sendMessage({ type: 'resume_agent' });
        }
    }

    stopAgent() {
        if (this.freeAgentRunning) {
            this.freeAgentStopped = true;
            this.freeAgentRunning = false;
            this.freeAgentPaused = false;
            this.addThinkingEntry('Agent stopped by user.', 0);
            this.setAgentActive(false);
            this.showAgentControls('idle');
        } else {
            this.sendMessage({ type: 'stop_agent' });
        }
    }

    // --- Free AI Agent (Puter.js) ---

    async startFreeAgent(modelId, task) {
        const model = this.getFreeModel(modelId);
        if (!model) return;

        // Check Puter.js is loaded
        if (typeof puter === 'undefined' || !puter.ai) {
            alert('免费 AI 引擎加载中，请稍候再试...');
            return;
        }

        // Ensure user is authenticated with Puter (free account)
        if (!this.freeAgentAuthed) {
            try {
                this.addThinkingEntry('正在检查 Puter 登录状态...', 0);
                await puter.auth();
                this.freeAgentAuthed = true;
                this.addThinkingEntry('Puter 登录成功！', 0);
            } catch (e) {
                this.addThinkingEntry('❌ 需要登录 Puter 账号才能使用免费 AI。请在弹出的窗口中登录（免费注册）。', 0);
                alert('需要登录 Puter 账号才能使用免费 AI。\n\nPuter 账号完全免费，登录后即可免费使用 AI 浏览网页。\n\n请点击"开始 AI 控制"并在弹出的 Puter 登录窗口中登录。');
                return;
            }
        }

        this.freeAgentRunning = true;
        this.freeAgentPaused = false;
        this.freeAgentStopped = false;
        this.freeAgentStep = 0;
        this.freeAgentTask = task;
        this.freeAgentModel = model;
        this.freeAgentHistory = [];

        this.setAgentActive(true);
        this.clearThinkingLog();
        this.clearActionsLog();
        this.showAgentControls('running');
        this.addThinkingEntry(`开始任务: ${task}\n使用免费模型: ${model.name}`, 0);

        // Run the agent loop
        await this.freeAgentLoop();
    }

    async freeAgentLoop() {
        const maxSteps = 50;

        while (this.freeAgentRunning && this.freeAgentStep < maxSteps) {
            if (this.freeAgentStopped) break;

            if (this.freeAgentPaused) {
                await this.sleep(300);
                continue;
            }

            this.freeAgentStep++;

            try {
                // Step 1: Request fresh screenshot from backend
                this.addThinkingEntry(`[步骤 ${this.freeAgentStep}] 正在截图...`, this.freeAgentStep);
                const screenshot = await this.requestScreenshot();
                if (!screenshot) {
                    this.addThinkingEntry('截图失败，重试中...', this.freeAgentStep);
                    await this.sleep(500);
                    continue;
                }

                // Step 2: Analyze with Puter.js
                this.addThinkingEntry(`[步骤 ${this.freeAgentStep}] 正在用 ${this.freeAgentModel.name} 分析...`, this.freeAgentStep);

                const prompt = this.buildFreeAgentPrompt();
                const imageDataUrl = `data:image/jpeg;base64,${screenshot}`;

                const startTime = Date.now();
                const aiResponse = await puter.ai.chat(prompt, imageDataUrl, false, {
                    model: this.freeAgentModel.puterModel,
                    normalize: true,
                    temperature: 0.3,
                    max_tokens: 800,
                });
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                const responseText = this.extractPuterResponseText(aiResponse);
                this.addThinkingEntry(`[Step ${this.freeAgentStep}] AI response (${elapsed}s):\n${responseText}`, this.freeAgentStep);

                // Step 3: Parse action
                const action = this.parseFreeAgentAction(responseText);
                if (!action) {
                    this.addThinkingEntry('无法解析 AI 响应中的操作，重试中...', this.freeAgentStep);
                    await this.sleep(500);
                    continue;
                }

                // Step 4: Execute action
                this.addActionEntry(action);
                const shouldContinue = await this.executeFreeAction(action);

                if (!shouldContinue) break;

                await this.sleep(600);

            } catch (error) {
                console.error('Free agent error:', error);
                const errMsg = this.getErrorMessage(error);
                this.addThinkingEntry(`[Step ${this.freeAgentStep}] 错误: ${errMsg}`, this.freeAgentStep);

                // Handle authentication errors
                if (errMsg.includes('auth') || errMsg.includes('login') || errMsg.includes('canceled')) {
                    this.freeAgentAuthed = false;
                    this.addThinkingEntry('需要重新登录 Puter 账号。请重新点击"开始 AI 控制"。', this.freeAgentStep);
                    break;
                }

                // Handle rate limit errors
                if (errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('rate')) {
                    this.addThinkingEntry('AI 调用频率限制，等待 5 秒后重试...', this.freeAgentStep);
                    await this.sleep(5000);
                } else {
                    await this.sleep(1000);
                }
            }
        }

        if (this.freeAgentStep >= maxSteps) {
            this.addThinkingEntry('达到最大步骤数，停止。', 0);
        }

        this.freeAgentRunning = false;
        this.setAgentActive(false);
        this.showAgentControls('idle');
    }

    getErrorMessage(error) {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        if (error.error && typeof error.error === 'object') {
            if (error.error.message) return error.error.message;
            if (error.error.code) return String(error.error.code);
        }
        try {
            return JSON.stringify(error);
        } catch (e) {
            return String(error);
        }
    }

    extractPuterResponseText(response) {
        if (!response) return '';
        if (typeof response === 'string') return response;

        // Normalized OpenAI format: response.message.content is a string
        if (response.message && typeof response.message.content === 'string') {
            return response.message.content;
        }

        // Anthropic native format: message.content is an array of content blocks
        if (response.message && Array.isArray(response.message.content)) {
            return response.message.content
                .filter(block => block.type === 'text' && block.text)
                .map(block => block.text)
                .join('\n');
        }

        // Some models return response.text directly
        if (typeof response.text === 'string') return response.text;

        // Fallback
        return JSON.stringify(response);
    }

    buildFreeAgentPrompt() {
        let historyText = '';
        const recentHistory = this.freeAgentHistory.slice(-8);
        for (const h of recentHistory) {
            historyText += `${h.role}: ${h.content}\n`;
        }

        return `You are an expert browser automation AI agent. You can see the current webpage screenshot and need to complete the user's task.

Task: ${this.freeAgentTask}
Current URL: ${this.currentUrl}
Step: ${this.freeAgentStep}

${historyText ? 'Previous actions:\n' + historyText : ''}

Available actions (respond with ONLY one JSON object, no markdown, no explanation):
1. Click: {"action": "click", "x": <number>, "y": <number>, "reason": "why"}
2. Type text: {"action": "type", "text": "text to type", "reason": "why"}
3. Press key: {"action": "press", "key": "Enter|Backspace|Tab|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight", "reason": "why"}
4. Scroll: {"action": "scroll", "direction": "up|down|left|right", "amount": <number>, "reason": "why"}
5. Navigate: {"action": "navigate", "url": "https://...", "reason": "why"}
6. Wait: {"action": "wait", "ms": <number>, "reason": "why"}
7. Ask question: {"action": "ask", "question": "your question", "reason": "why"}
8. Done: {"action": "done", "message": "completion summary", "reason": "why"}

Rules:
- Look at the screenshot carefully before deciding.
- Only ONE action per turn.
- x,y are pixel coordinates on the screenshot (0,0 is top-left).
- Click on the center of buttons/links/inputs.
- When task is complete, use "done".
- Respond with ONLY the JSON object.`;
    }

    parseFreeAgentAction(content) {
        if (!content) return null;

        let jsonStr = content;

        // Remove markdown code blocks
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

        // Extract JSON object
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        try {
            const action = JSON.parse(jsonStr);
            if (action.action || action.type) return action;
            return null;
        } catch (e) {
            return null;
        }
    }

    async executeFreeAction(action) {
        const actionType = action.action || action.type;

        switch (actionType) {
            case 'click': {
                const x = action.x, y = action.y;
                if (x === undefined || y === undefined) {
                    this.addThinkingEntry('无效的点击操作：缺少 x 或 y 坐标', this.freeAgentStep);
                    return true;
                }
                this.addThinkingEntry(`点击 (${x}, ${y}) - ${action.reason || ''}`, this.freeAgentStep);
                this.sendMessage({ type: 'click', x, y });
                this.freeAgentHistory.push({ role: 'assistant', content: `Click at (${x}, ${y})` });
                await this.sleep(500);
                return true;
            }
            case 'type': {
                const text = action.text;
                if (!text) {
                    this.addThinkingEntry('无效的输入操作：缺少文本内容', this.freeAgentStep);
                    return true;
                }
                this.addThinkingEntry(`输入文本: "${text}" - ${action.reason || ''}`, this.freeAgentStep);
                this.sendMessage({ type: 'type', text });
                this.freeAgentHistory.push({ role: 'assistant', content: `Type: ${text}` });
                await this.sleep(300);
                return true;
            }
            case 'press': {
                const key = action.key;
                if (!key) return true;
                this.addThinkingEntry(`按键: ${key} - ${action.reason || ''}`, this.freeAgentStep);
                this.sendMessage({ type: 'keypress', key });
                this.freeAgentHistory.push({ role: 'assistant', content: `Press: ${key}` });
                await this.sleep(300);
                return true;
            }
            case 'scroll': {
                const direction = action.direction || 'down';
                const amount = action.amount || 500;
                let deltaX = 0, deltaY = 0;
                if (direction === 'down') deltaY = amount;
                else if (direction === 'up') deltaY = -amount;
                else if (direction === 'left') deltaX = -amount;
                else if (direction === 'right') deltaX = amount;
                this.addThinkingEntry(`滚动 ${direction} ${amount}px - ${action.reason || ''}`, this.freeAgentStep);
                this.sendMessage({ type: 'scroll', deltaX, deltaY });
                this.freeAgentHistory.push({ role: 'assistant', content: `Scroll ${direction} ${amount}px` });
                await this.sleep(400);
                return true;
            }
            case 'navigate': {
                const url = action.url;
                if (!url) return true;
                this.addThinkingEntry(`跳转到: ${url} - ${action.reason || ''}`, this.freeAgentStep);
                this.sendMessage({ type: 'navigate', url });
                this.freeAgentHistory.push({ role: 'assistant', content: `Navigate: ${url}` });
                await this.sleep(2000);
                return true;
            }
            case 'wait': {
                const ms = action.ms || 2000;
                this.addThinkingEntry(`等待 ${ms}ms - ${action.reason || ''}`, this.freeAgentStep);
                await this.sleep(ms);
                this.freeAgentHistory.push({ role: 'assistant', content: `Wait ${ms}ms` });
                return true;
            }
            case 'ask': {
                const question = action.question || 'I have a question.';
                this.addThinkingEntry(`询问用户: ${question}`, this.freeAgentStep);
                this.showQuestion(question, this.freeAgentStep);
                // Wait for user answer - we need to handle this differently
                // For now, just continue after showing the question
                this.freeAgentHistory.push({ role: 'assistant', content: `Ask: ${question}` });
                return true;
            }
            case 'done': {
                const message = action.message || 'Task completed.';
                this.addThinkingEntry(`✅ 任务完成: ${message}`, this.freeAgentStep);
                return false;
            }
            default:
                this.addThinkingEntry(`未知操作: ${actionType}`, this.freeAgentStep);
                return true;
        }
    }

    requestScreenshot() {
        return new Promise((resolve) => {
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) { resolved = true; resolve(null); }
            }, 10000);

            // Set up a one-time handler for screenshot_taken
            const handler = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'screenshot_taken' && !resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.ws.removeEventListener('message', handler);
                        resolve(message.data);
                    } else if (message.type === 'screenshot_error' && !resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.ws.removeEventListener('message', handler);
                        resolve(null);
                    }
                } catch (e) {}
            };

            this.ws.addEventListener('message', handler);
            this.sendMessage({ type: 'take_screenshot' });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setAgentActive(active) {
        this.agentRunning = active;
        const border = document.getElementById('ai-border');
        const status = document.getElementById('agent-status');

        if (active) {
            border.classList.add('active');
            status.classList.add('active');
            status.querySelector('.status-text').textContent = 'AI 控制中';
            document.getElementById('thinking-indicator').style.display = 'inline-flex';
        } else {
            border.classList.remove('active');
            status.classList.remove('active');
            status.querySelector('.status-text').textContent = '空闲';
            document.getElementById('thinking-indicator').style.display = 'none';
        }
    }

    showAgentControls(state) {
        const startBtn = document.getElementById('start-agent-btn');
        const pauseBtn = document.getElementById('pause-agent-btn');
        const resumeBtn = document.getElementById('resume-agent-btn');
        const stopBtn = document.getElementById('stop-agent-btn');

        startBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';

        if (state === 'idle') {
            startBtn.style.display = 'flex';
        } else if (state === 'running') {
            pauseBtn.style.display = 'flex';
            stopBtn.style.display = 'flex';
        } else if (state === 'paused') {
            resumeBtn.style.display = 'flex';
            stopBtn.style.display = 'flex';
        }
    }

    // --- Thinking Log ---

    clearThinkingLog() {
        const log = document.getElementById('thinking-log');
        log.innerHTML = '';
    }

    addThinkingEntry(text, step) {
        const log = document.getElementById('thinking-log');

        const entry = document.createElement('div');
        entry.className = 'thinking-entry';

        const stepLabel = step > 0 ? `<div class="thinking-step">步骤 ${step}</div>` : '';
        entry.innerHTML = `${stepLabel}<div class="thinking-text"></div>`;
        entry.querySelector('.thinking-text').textContent = text;

        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    // --- Actions Log ---

    clearActionsLog() {
        const log = document.getElementById('actions-log');
        log.innerHTML = '<div class="actions-empty">暂无操作</div>';
    }

    addActionEntry(action) {
        const log = document.getElementById('actions-log');
        const empty = log.querySelector('.actions-empty');
        if (empty) empty.remove();

        const actionType = action.action || action.type || 'unknown';
        const icons = {
            click: '👆',
            type: '⌨️',
            press: '⌨️',
            scroll: '📜',
            navigate: '🌐',
            wait: '⏳',
            ask: '❓',
            done: '✅'
        };

        let detail = '';
        switch (actionType) {
            case 'click': detail = `(${action.x}, ${action.y})`; break;
            case 'type': detail = `"${(action.text || '').substring(0, 30)}"`; break;
            case 'press': detail = action.key; break;
            case 'scroll': detail = `${action.direction} ${action.amount}px`; break;
            case 'navigate': detail = action.url; break;
            case 'wait': detail = `${action.ms}ms`; break;
            case 'ask': detail = (action.question || '').substring(0, 50); break;
            case 'done': detail = (action.message || '完成').substring(0, 50); break;
        }

        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const entry = document.createElement('div');
        entry.className = 'action-entry';
        entry.innerHTML = `
            <span class="action-icon">${icons[actionType] || '⚡'}</span>
            <span class="action-text">${actionType} ${detail}</span>
            <span class="action-time">${time}</span>
        `;

        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;

        // Limit entries
        while (log.children.length > 50) {
            log.removeChild(log.firstChild);
        }
    }

    // --- AI Question ---

    showQuestion(question, step) {
        const questionDiv = document.getElementById('ai-question');
        const questionText = document.getElementById('question-text');
        questionText.textContent = question;
        questionDiv.style.display = 'block';
        document.getElementById('answer-input').focus();
    }

    hideQuestion() {
        document.getElementById('ai-question').style.display = 'none';
    }

    submitAnswer() {
        const answer = document.getElementById('answer-input').value.trim();
        if (!answer) return;

        this.sendMessage({ type: 'answer', answer });
        this.addThinkingEntry(`User answer: ${answer}`, 0);
        document.getElementById('answer-input').value = '';
        this.hideQuestion();
    }

    // --- User Interaction with Browser ---

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Make sure click is within canvas bounds
        if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) {
            return;
        }

        this.showClickIndicator(e.clientX, e.clientY);
        this.sendMessage({ type: 'click', x, y });
    }

    showClickIndicator(clientX, clientY) {
        const wrapper = document.getElementById('browser-view-wrapper');
        const rect = wrapper.getBoundingClientRect();
        const indicator = document.getElementById('click-indicator');

        indicator.style.left = (clientX - rect.left + wrapper.scrollLeft) + 'px';
        indicator.style.top = (clientY - rect.top + wrapper.scrollTop) + 'px';
        indicator.classList.remove('show');
        void indicator.offsetWidth; // trigger reflow
        indicator.classList.add('show');

        // Remove show class after animation
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 800);
    }

    handleCanvasWheel(e) {
        e.preventDefault();
        this.sendMessage({
            type: 'scroll',
            deltaX: e.deltaX,
            deltaY: e.deltaY
        });
    }

    // --- Settings Management ---

    loadSettings() {
        try {
            const saved = localStorage.getItem('ai-browser-agent-keys');
            if (saved) {
                const data = JSON.parse(saved);
                this.apiKeys = data.keys || data;
                this.backendUrl = data.backendUrl || 'ws://localhost:3000';
            }
        } catch (e) {
            this.apiKeys = {};
            this.backendUrl = 'ws://localhost:3000';
        }

        // Populate settings fields
        const backendInput = document.getElementById('backend-url');
        if (backendInput) backendInput.value = this.backendUrl;
        document.getElementById('api-key-openai').value = this.apiKeys.openai || '';
        document.getElementById('api-key-google').value = this.apiKeys.google || '';
        document.getElementById('api-key-zhipu').value = this.apiKeys.zhipu || '';
        document.getElementById('api-key-qwen').value = this.apiKeys.qwen || '';
        document.getElementById('api-key-moonshot').value = this.apiKeys.moonshot || '';
        document.getElementById('api-key-anthropic').value = this.apiKeys.anthropic || '';
    }

    saveApiKeys() {
        const backendInput = document.getElementById('backend-url');
        let newBackendUrl = backendInput ? backendInput.value.trim() : 'ws://localhost:3000';
        if (!newBackendUrl) newBackendUrl = 'ws://localhost:3000';

        this.apiKeys = {
            openai: document.getElementById('api-key-openai').value.trim(),
            google: document.getElementById('api-key-google').value.trim(),
            zhipu: document.getElementById('api-key-zhipu').value.trim(),
            qwen: document.getElementById('api-key-qwen').value.trim(),
            moonshot: document.getElementById('api-key-moonshot').value.trim(),
            anthropic: document.getElementById('api-key-anthropic').value.trim(),
        };

        const backendChanged = newBackendUrl !== this.backendUrl;
        this.backendUrl = newBackendUrl;

        localStorage.setItem('ai-browser-agent-keys', JSON.stringify({
            keys: this.apiKeys,
            backendUrl: this.backendUrl
        }));

        this.closeSettings();
        alert('设置已保存');

        // If backend URL changed, reconnect
        if (backendChanged && this.ws) {
            this.ws.close();
        }
    }

    openSettings() {
        document.getElementById('settings-modal').style.display = 'flex';
    }

    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    // --- Event Listeners ---

    setupEventListeners() {
        // Model selection - show Puter login hint for free models
        document.getElementById('model-select').addEventListener('change', (e) => {
            const modelId = e.target.value;
            const hint = document.getElementById('free-model-hint');
            if (hint) {
                hint.style.display = this.isFreeModel(modelId) ? 'block' : 'none';
            }
        });

        // URL navigation
        document.getElementById('navigate-btn').addEventListener('click', () => this.navigate());
        document.getElementById('url-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.navigate();
        });

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            if (this.currentUrl && this.currentUrl !== 'about:blank') {
                this.sendMessage({ type: 'navigate', url: this.currentUrl });
            }
        });

        // Canvas interactions - attach to wrapper to catch all clicks in the browser area
        const browserWrapper = document.getElementById('browser-view-wrapper');
        browserWrapper.addEventListener('click', (e) => {
            if (e.target === this.canvas || e.target.closest('#browser-canvas')) {
                this.handleCanvasClick(e);
            }
        });
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e), { passive: false });

        // Keyboard input for browser (when canvas focused)
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.addEventListener('keydown', (e) => {
            if (e.key.length === 1) {
                this.sendMessage({ type: 'type', text: e.key });
            } else {
                const keyMap = {
                    'Enter': 'Enter',
                    'Backspace': 'Backspace',
                    'Tab': 'Tab',
                    'Escape': 'Escape',
                    'ArrowUp': 'ArrowUp',
                    'ArrowDown': 'ArrowDown',
                    'ArrowLeft': 'ArrowLeft',
                    'ArrowRight': 'ArrowRight',
                };
                if (keyMap[e.key]) {
                    this.sendMessage({ type: 'keypress', key: keyMap[e.key] });
                }
            }
        });

        // Browser control buttons
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                switch (action) {
                    case 'back':
                        this.sendMessage({ type: 'go_back' });
                        break;
                    case 'forward':
                        this.sendMessage({ type: 'go_forward' });
                        break;
                    case 'scroll-up':
                        this.sendMessage({ type: 'scroll', deltaX: 0, deltaY: -500 });
                        break;
                    case 'scroll-down':
                        this.sendMessage({ type: 'scroll', deltaX: 0, deltaY: 500 });
                        break;
                }
            });
        });

        // Agent control buttons
        document.getElementById('start-agent-btn').addEventListener('click', () => this.startAgent());
        document.getElementById('pause-agent-btn').addEventListener('click', () => this.pauseAgent());
        document.getElementById('resume-agent-btn').addEventListener('click', () => this.resumeAgent());
        document.getElementById('stop-agent-btn').addEventListener('click', () => this.stopAgent());

        // AI question
        document.getElementById('submit-answer-btn').addEventListener('click', () => this.submitAnswer());
        document.getElementById('answer-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });

        // Settings modal
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.closeSettings());
        document.getElementById('save-settings').addEventListener('click', () => this.saveApiKeys());
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') this.closeSettings();
        });

        // Task input - Ctrl+Enter to start
        document.getElementById('task-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.startAgent();
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.aiAgent = new AIBrowserAgentClient();
});
