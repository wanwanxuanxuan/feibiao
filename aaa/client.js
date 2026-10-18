/**
 * AI Browser Agent - Client
 * Handles WebSocket communication, browser view rendering, and user interactions
 */

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

        this.init();
    }

    init() {
        this.canvas = document.getElementById('browser-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.loadSettings();
        this.connectWebSocket();
        this.setupEventListeners();
    }

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
            console.log('WebSocket disconnected. Reconnecting...');
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
            case 'agent_screenshot':
                this.renderScreenshot(message.data, message.viewport);
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

            case 'agent_thinking':
                this.addThinkingEntry(message.text, message.step || 0);
                break;

            case 'agent_action':
                this.addActionEntry(message.action);
                break;

            case 'agent_ask':
                this.showQuestion(message.question, message.step || 0);
                break;
        }
    }

    renderScreenshot(base64Data, viewport) {
        if (viewport) {
            this.viewport = viewport;
        }

        const img = new Image();
        img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);

            const overlay = document.getElementById('browser-overlay');
            if (this.currentUrl && this.currentUrl !== 'about:blank') {
                overlay.classList.add('hidden');
            }
        };
        img.src = `data:image/jpeg;base64,${base64Data}`;
    }

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

    populateModelSelect() {
        const select = document.getElementById('model-select');
        select.innerHTML = '<option value="">选择 AI 模型...</option>';

        const grouped = {};
        for (const model of this.models) {
            if (!grouped[model.provider]) grouped[model.provider] = [];
            grouped[model.provider].push(model);
        }

        const providerNames = {
            openai: 'OpenAI',
            google: 'Google',
            zhipu: '智谱 Zhipu',
            qwen: '通义千问 Qwen',
            moonshot: '月之暗面 Moonshot',
            anthropic: 'Anthropic'
        };

        for (const [provider, models] of Object.entries(grouped)) {
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

    getApiKeyForModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return null;
        return this.apiKeys[model.provider] || null;
    }

    startAgent() {
        const model = this.getSelectedModel();
        const task = document.getElementById('task-input').value.trim();

        if (!model) {
            alert('请先选择一个 AI 模型');
            return;
        }

        const apiKey = this.getApiKeyForModel(model);
        if (!apiKey) {
            alert(`请先在设置中配置该模型的 API Key`);
            document.getElementById('settings-btn').click();
            return;
        }

        if (!task) {
            alert('请输入任务指令');
            return;
        }

        if (this.currentUrl === 'about:blank') {
            alert('请先打开一个网页');
            return;
        }

        this.sendMessage({
            type: 'start_agent',
            model,
            apiKey,
            task
        });
    }

    pauseAgent() { this.sendMessage({ type: 'pause_agent' }); }
    resumeAgent() { this.sendMessage({ type: 'resume_agent' }); }
    stopAgent() { this.sendMessage({ type: 'stop_agent' }); }

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

    clearThinkingLog() {
        document.getElementById('thinking-log').innerHTML = '';
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

    clearActionsLog() {
        document.getElementById('actions-log').innerHTML = '<div class="actions-empty">暂无操作</div>';
    }

    addActionEntry(action) {
        const log = document.getElementById('actions-log');
        const empty = log.querySelector('.actions-empty');
        if (empty) empty.remove();

        const actionType = action.action || action.type || 'unknown';
        const icons = {
            click: '👆', type: '⌨️', press: '⌨️', scroll: '📜',
            navigate: '🌐', wait: '⏳', ask: '❓', done: '✅'
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

        while (log.children.length > 50) {
            log.removeChild(log.firstChild);
        }
    }

    showQuestion(question, step) {
        const questionDiv = document.getElementById('ai-question');
        document.getElementById('question-text').textContent = question;
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

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) return;

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
        void indicator.offsetWidth;
        indicator.classList.add('show');

        setTimeout(() => { indicator.classList.remove('show'); }, 800);
    }

    handleCanvasWheel(e) {
        e.preventDefault();
        this.sendMessage({
            type: 'scroll',
            deltaX: e.deltaX,
            deltaY: e.deltaY
        });
    }

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

    setupEventListeners() {
        document.getElementById('navigate-btn').addEventListener('click', () => this.navigate());
        document.getElementById('url-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.navigate();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => {
            if (this.currentUrl && this.currentUrl !== 'about:blank') {
                this.sendMessage({ type: 'navigate', url: this.currentUrl });
            }
        });

        const browserWrapper = document.getElementById('browser-view-wrapper');
        browserWrapper.addEventListener('click', (e) => {
            if (e.target === this.canvas || e.target.closest('#browser-canvas')) {
                this.handleCanvasClick(e);
            }
        });
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e), { passive: false });

        this.canvas.setAttribute('tabindex', '0');
        this.canvas.addEventListener('keydown', (e) => {
            if (e.key.length === 1) {
                this.sendMessage({ type: 'type', text: e.key });
            } else {
                const keyMap = {
                    'Enter': 'Enter', 'Backspace': 'Backspace', 'Tab': 'Tab',
                    'Escape': 'Escape', 'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
                    'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
                };
                if (keyMap[e.key]) {
                    this.sendMessage({ type: 'keypress', key: keyMap[e.key] });
                }
            }
        });

        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                switch (action) {
                    case 'back': this.sendMessage({ type: 'go_back' }); break;
                    case 'forward': this.sendMessage({ type: 'go_forward' }); break;
                    case 'scroll-up': this.sendMessage({ type: 'scroll', deltaX: 0, deltaY: -500 }); break;
                    case 'scroll-down': this.sendMessage({ type: 'scroll', deltaX: 0, deltaY: 500 }); break;
                }
            });
        });

        document.getElementById('start-agent-btn').addEventListener('click', () => this.startAgent());
        document.getElementById('pause-agent-btn').addEventListener('click', () => this.pauseAgent());
        document.getElementById('resume-agent-btn').addEventListener('click', () => this.resumeAgent());
        document.getElementById('stop-agent-btn').addEventListener('click', () => this.stopAgent());

        document.getElementById('submit-answer-btn').addEventListener('click', () => this.submitAnswer());
        document.getElementById('answer-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });

        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.closeSettings());
        document.getElementById('save-settings').addEventListener('click', () => this.saveApiKeys());
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') this.closeSettings();
        });

        document.getElementById('task-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.startAgent();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.aiAgent = new AIBrowserAgentClient();
});