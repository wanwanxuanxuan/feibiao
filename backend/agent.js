/**
 * Browser Agent - Controls the browser using AI vision models
 */

const { createProvider } = require('./ai-providers');

class BrowserAgent {
  constructor(page, ws, providerConfig) {
    this.page = page;
    this.ws = ws;
    this.provider = createProvider(providerConfig.model, providerConfig.apiKey);
    this.modelName = providerConfig.model;
    this.task = '';
    this.history = [];
    this.running = false;
    this.paused = false;
    this.waitingForAnswer = false;
    this.userAnswer = null;
    this.maxSteps = 50;
    this.currentStep = 0;
    this.resolveAnswer = null;
  }

  async start(task) {
    this.task = task;
    this.running = true;
    this.paused = false;
    this.currentStep = 0;
    this.history = [{ role: 'user', content: `Task: ${task}` }];

    this.sendStatus({ type: 'agent_started', task });
    this.sendThinking(`Starting task: ${task}\nUsing model: ${this.modelName}`);
    await this.runLoop();
  }

  async runLoop() {
    while (this.running && this.currentStep < this.maxSteps) {
      if (this.paused) { await this.sleep(300); continue; }

      this.currentStep++;
      this.sendStatus({ type: 'step', step: this.currentStep, maxSteps: this.maxSteps });

      try {
        this.sendThinking(`[Step ${this.currentStep}] Taking screenshot...`);
        const screenshot = await this.page.screenshot({ type: 'png' });
        const screenshotBase64 = screenshot.toString('base64');

        this.ws.send(JSON.stringify({
          type: 'agent_screenshot',
          data: screenshotBase64,
          step: this.currentStep
        }));

        let extraInfo = '';
        try {
          const url = this.page.url();
          const title = await this.page.title();
          extraInfo = `Current URL: ${url}\nPage title: ${title}`;
        } catch (e) {}

        if (this.waitingForAnswer) {
          this.sendThinking('Waiting for user answer...');
          await this.waitForAnswer();
          this.waitingForAnswer = false;
          extraInfo += `\nUser answer: ${this.userAnswer}`;
        }

        this.sendThinking(`[Step ${this.currentStep}] Analyzing with ${this.modelName}...`);
        const startTime = Date.now();
        const result = await this.provider.analyze(screenshotBase64, this.task, this.history, extraInfo);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        this.sendThinking(`[Step ${this.currentStep}] AI response (${elapsed}s):\n${result.thinking}`);
        this.history.push({ role: 'assistant', content: result.thinking });

        const action = result.action;
        const actionType = action.action || action.type;
        this.sendAction(action);

        const shouldContinue = await this.executeAction(actionType, action);
        if (!shouldContinue) break;

        await this.sleep(500);
      } catch (error) {
        console.error('Agent loop error:', error);
        let errorDetails = error.message || '';
        if (!errorDetails && error.code) errorDetails = error.code;
        if (!errorDetails) errorDetails = error.toString() || 'Unknown error';
        if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || error.code === 'ECONNREFUSED') {
          errorDetails = `Network error (${error.code}): Cannot connect to the AI API. Please check your network connection and API key.`;
        }
        this.sendThinking(`[Step ${this.currentStep}] Error: ${errorDetails}`);
        this.sendStatus({ type: 'agent_error', error: errorDetails });

        this.waitingForAnswer = true;
        this.ws.send(JSON.stringify({
          type: 'agent_ask',
          question: `I encountered an error: ${errorDetails}. How would you like to proceed? You can: 1) Check your API key, 2) Change the model, or 3) Give me new instructions.`,
          step: this.currentStep
        }));
        await this.sleep(1000);
      }
    }

    if (this.currentStep >= this.maxSteps) {
      this.sendThinking('Maximum steps reached. Stopping.');
      this.sendStatus({ type: 'agent_done', message: 'Maximum steps reached' });
    }

    this.running = false;
    this.sendStatus({ type: 'agent_stopped' });
  }

  async executeAction(actionType, action) {
    switch (actionType) {
      case 'click': {
        const x = action.x, y = action.y;
        if (x === undefined || y === undefined) { this.sendThinking('Invalid click action: missing x or y coordinates'); return true; }
        this.sendThinking(`Clicking at (${x}, ${y}) - ${action.reason || ''}`);
        await this.page.mouse.click(x, y);
        this.sendStatus({ type: 'action_executed', action: 'click', x, y });
        return true;
      }
      case 'type': {
        const text = action.text;
        if (!text) { this.sendThinking('Invalid type action: missing text'); return true; }
        this.sendThinking(`Typing: "${text}" - ${action.reason || ''}`);
        await this.page.keyboard.type(text, { delay: 30 });
        this.sendStatus({ type: 'action_executed', action: 'type', text });
        return true;
      }
      case 'press': {
        const key = action.key;
        if (!key) { this.sendThinking('Invalid press action: missing key'); return true; }
        this.sendThinking(`Pressing key: ${key} - ${action.reason || ''}`);
        await this.page.keyboard.press(key);
        this.sendStatus({ type: 'action_executed', action: 'press', key });
        return true;
      }
      case 'scroll': {
        const direction = action.direction || 'down';
        const amount = action.amount || 500;
        this.sendThinking(`Scrolling ${direction} by ${amount}px - ${action.reason || ''}`);
        let deltaX = 0, deltaY = 0;
        if (direction === 'down') deltaY = amount;
        else if (direction === 'up') deltaY = -amount;
        else if (direction === 'left') deltaX = -amount;
        else if (direction === 'right') deltaX = amount;
        await this.page.mouse.wheel(deltaX, deltaY);
        this.sendStatus({ type: 'action_executed', action: 'scroll', direction, amount });
        return true;
      }
      case 'navigate': {
        const url = action.url;
        if (!url) { this.sendThinking('Invalid navigate action: missing url'); return true; }
        this.sendThinking(`Navigating to: ${url} - ${action.reason || ''}`);
        try { await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
        catch (e) { this.sendThinking(`Navigation warning: ${e.message}`); }
        this.sendStatus({ type: 'action_executed', action: 'navigate', url });
        await this.sleep(1000);
        return true;
      }
      case 'wait': {
        const ms = action.ms || 2000;
        this.sendThinking(`Waiting for ${ms}ms - ${action.reason || ''}`);
        await this.sleep(ms);
        this.sendStatus({ type: 'action_executed', action: 'wait', ms });
        return true;
      }
      case 'ask': {
        const question = action.question || 'I have a question.';
        this.sendThinking(`Asking user: ${question}`);
        this.waitingForAnswer = true;
        this.ws.send(JSON.stringify({
          type: 'agent_ask', question: question,
          reason: action.reason || '', step: this.currentStep
        }));
        return true;
      }
      case 'done': {
        const message = action.message || 'Task completed.';
        this.sendThinking(`Task completed: ${message}`);
        this.sendStatus({ type: 'agent_done', message });
        return false;
      }
      default:
        this.sendThinking(`Unknown action: ${actionType}`);
        return true;
    }
  }

  waitForAnswer() {
    return new Promise((resolve) => { this.resolveAnswer = resolve; });
  }

  setAnswer(answer) {
    this.userAnswer = answer;
    this.history.push({ role: 'user', content: `User answer: ${answer}` });
    if (this.resolveAnswer) { this.resolveAnswer(); this.resolveAnswer = null; }
  }

  pause() {
    this.paused = true;
    this.sendThinking('Agent paused by user.');
    this.sendStatus({ type: 'agent_paused' });
  }

  resume() {
    this.paused = false;
    this.sendThinking('Agent resumed.');
    this.sendStatus({ type: 'agent_resumed' });
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.sendThinking('Agent stopped by user.');
    this.sendStatus({ type: 'agent_stopped' });
    if (this.resolveAnswer) { this.resolveAnswer(); this.resolveAnswer = null; }
  }

  userIntervened() {
    if (this.running && !this.paused) {
      this.paused = true;
      this.sendThinking('User intervention detected. Agent paused. You can resume or give new instructions.');
      this.sendStatus({ type: 'agent_paused', reason: 'user_intervention' });
    }
  }

  sendThinking(text) {
    this.ws.send(JSON.stringify({ type: 'agent_thinking', text, timestamp: Date.now(), step: this.currentStep }));
  }

  sendAction(action) {
    this.ws.send(JSON.stringify({ type: 'agent_action', action, step: this.currentStep }));
  }

  sendStatus(status) { this.ws.send(JSON.stringify(status)); }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

module.exports = BrowserAgent;