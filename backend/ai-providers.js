/**
 * AI Providers Module
 * Supports multiple vision-capable AI models:
 * 1. OpenAI GPT-4o / GPT-4o mini
 * 2. Google Gemini 1.5 Flash / Pro
 * 3. Zhipu GLM-4V (智谱)
 * 4. Qwen VL (通义千问 - Alibaba)
 * 5. Moonshot Kimi (月之暗面)
 * 6. Anthropic Claude 3.5 Sonnet
 */

const https = require('https');
const http = require('http');

// Available AI models with vision capabilities
const AVAILABLE_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', vision: true, speed: 'fast' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', vision: true, speed: 'very-fast' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', vision: true, speed: 'very-fast' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', vision: true, speed: 'medium' },
  { id: 'glm-4v', name: 'GLM-4V (智谱)', provider: 'zhipu', vision: true, speed: 'medium' },
  { id: 'qwen-vl-max', name: 'Qwen-VL-Max (通义)', provider: 'qwen', vision: true, speed: 'fast' },
  { id: 'qwen-vl-plus', name: 'Qwen-VL-Plus (通义)', provider: 'qwen', vision: true, speed: 'very-fast' },
  { id: 'kimi-k2', name: 'Kimi K2 (月之暗面)', provider: 'moonshot', vision: true, speed: 'fast' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', vision: true, speed: 'medium' },
];

function getAvailableModels() {
  return AVAILABLE_MODELS;
}

/**
 * Make an HTTPS request and return a promise
 */
function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout after 30s'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Build the system prompt for the AI agent
 */
function buildSystemPrompt() {
  return `You are an expert browser automation AI agent. You can see the current webpage screenshot and need to complete the user's task by performing actions.

Available actions (respond with ONLY one JSON object, no markdown):
1. Click: {"action": "click", "x": <number>, "y": <number>, "reason": "why"}
2. Type text: {"action": "type", "text": "text to type", "reason": "why"}
3. Press key: {"action": "press", "key": "Enter|Backspace|Tab|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight", "reason": "why"}
4. Scroll: {"action": "scroll", "direction": "up|down|left|right", "amount": <number>, "reason": "why"}
5. Navigate: {"action": "navigate", "url": "https://...", "reason": "why"}
6. Wait: {"action": "wait", "ms": <number>, "reason": "why"}
7. Ask question: {"action": "ask", "question": "your question to user", "reason": "why"}
8. Done: {"action": "done", "message": "completion summary", "reason": "why"}

Rules:
- Look at the screenshot carefully before deciding an action.
- Only perform ONE action per turn.
- If you need clarification or are stuck, use the "ask" action.
- When the task is complete, use the "done" action.
- Coordinates x,y are pixel positions on the screenshot.
- Be precise with coordinates - click on the center of buttons/links.
- Always include a "reason" field explaining your thought process.
- Respond with ONLY the JSON object, nothing else.`;
}

/**
 * OpenAI Provider (GPT-4o, GPT-4o mini)
 */
class OpenAIProvider {
  constructor(apiKey, model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://api.openai.com/v1';
  }

  async analyze(screenshotBase64, task, history = [], extraInfo = '') {
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
    ];

    // Add history
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }

    // Add current task and screenshot
    const userContent = [
      { type: 'text', text: `Task: ${task}\n${extraInfo ? 'Additional info: ' + extraInfo : ''}\nHere is the current screenshot. What is your next action?` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } }
    ];
    messages.push({ role: 'user', content: userContent });

    const body = JSON.stringify({
      model: this.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    };

    const res = await makeRequest(`${this.baseURL}/chat/completions`, options, body);
    if (res.status !== 200) {
      throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const content = res.data.choices[0].message.content;
    return parseAIResponse(content);
  }
}

/**
 * Google Gemini Provider
 */
class GeminiProvider {
  constructor(apiKey, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
  }

  async analyze(screenshotBase64, task, history = [], extraInfo = '') {
    const contents = [];

    // Add history
    for (const h of history.slice(-10)) {
      const role = h.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) }]
      });
    }

    // Current turn
    contents.push({
      role: 'user',
      parts: [
        { text: `Task: ${task}\n${extraInfo ? 'Additional info: ' + extraInfo : ''}\nHere is the current screenshot. What is your next action?` },
        { inline_data: { mime_type: 'image/png', data: screenshotBase64 } }
      ]
    });

    const body = JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.3,
      },
    });

    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };

    const res = await makeRequest(
      `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
      options,
      body
    );

    if (res.status !== 200) {
      throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const content = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIResponse(content);
  }
}

/**
 * Zhipu (智谱) GLM-4V Provider
 */
class ZhipuProvider {
  constructor(apiKey, model = 'glm-4v') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://open.bigmodel.cn/api/paas/v4';
  }

  async analyze(screenshotBase64, task, history = [], extraInfo = '') {
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
    ];

    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }

    const userContent = [
      { type: 'text', text: `Task: ${task}\n${extraInfo ? 'Additional info: ' + extraInfo : ''}\nHere is the current screenshot. What is your next action?` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } }
    ];
    messages.push({ role: 'user', content: userContent });

    const body = JSON.stringify({
      model: this.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    };

    const res = await makeRequest(`${this.baseURL}/chat/completions`, options, body);
    if (res.status !== 200) {
      throw new Error(`Zhipu API error ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const content = res.data.choices[0].message.content;
    return parseAIResponse(content);
  }
}

/**
 * Qwen (通义千问) VL Provider - uses OpenAI-compatible API
 */
class QwenProvider {
  constructor(apiKey, model = 'qwen-vl-max') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  async analyze(screenshotBase64, task, history = [], extraInfo = '') {
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
    ];

    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }

    const userContent = [
      { type: 'text', text: `Task: ${task}\n${extraInfo ? 'Additional info: ' + extraInfo : ''}\nHere is the current screenshot. What is your next action?` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } }
    ];
    messages.push({ role: 'user', content: userContent });

    const body = JSON.stringify({
      model: this.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    };

    const res = await makeRequest(`${this.baseURL}/chat/completions`, options, body);
    if (res.status !== 200) {
      throw new Error(`Qwen API error ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const content = res.data.choices[0].message.content;
    return parseAIResponse(content);
  }
}

/**
 * Moonshot (Kimi) Provider
 */
class MoonshotProvider {
  constructor(apiKey, model = 'kimi-k2') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://api.moonshot.cn/v1';
  }

  async analyze(screenshotBase64, task, history = [], extraInfo = '') {
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
    ];

    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }

    const userContent = [
      { type: 'text', text: `Task: ${task}\n${extraInfo ? 'Additional info: ' + extraInfo : ''}\nHere is the current screenshot. What is your next action?` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } }
    ];
    messages.push({ role: 'user', content: userContent });

    const body = JSON.stringify({
      model: this.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    };

    const res = await makeRequest(`${this.baseURL}/chat/completions`, options, body);
    if (res.status !== 200) {
      throw new Error(`Moonshot API error ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const content = res.data.choices[0].message.content;
    return parseAIResponse(content);
  }
}

/**
 * Anthropic Claude Provider
 */
class ClaudeProvider {
  constructor(apiKey, model = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = 'https://api.anthropic.com/v1';
  }

  async analyze(screenshotBase64, task, history = [], extraInfo = '') {
    const messages = [];

    for (const h of history.slice(-10)) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) });
      }
    }

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `Task: ${task}\n${extraInfo ? 'Additional info: ' + extraInfo : ''}\nHere is the current screenshot. What is your next action?` },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 } }
      ]
    });

    const body = JSON.stringify({
      model: this.model,
      system: buildSystemPrompt(),
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
    };

    const res = await makeRequest(`${this.baseURL}/messages`, options, body);
    if (res.status !== 200) {
      throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const content = res.data.content?.[0]?.text || '';
    return parseAIResponse(content);
  }
}

/**
 * Parse the AI response and extract action JSON
 */
function parseAIResponse(content) {
  if (!content) {
    return { action: { type: 'ask', question: 'AI returned an empty response. Please check your API key or try again.', reason: 'Empty response' }, thinking: 'Empty response from AI' };
  }

  let thinking = content;

  // Try to find JSON in the response
  let jsonStr = content;

  // Remove markdown code blocks if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to extract JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  let action;
  try {
    action = JSON.parse(jsonStr);
  } catch (e) {
    // If parsing fails, treat the whole thing as thinking and ask
    return {
      action: { type: 'ask', question: `I couldn't parse a valid action from the AI response. The response was: ${content.substring(0, 200)}...`, reason: 'JSON parse failed' },
      thinking: content
    };
  }

  // Validate action
  if (!action.action) {
    return {
      action: { type: 'ask', question: 'AI response did not include an action field.', reason: 'Missing action field' },
      thinking: content
    };
  }

  return { action, thinking };
}

/**
 * Factory function to create a provider based on model id
 */
function createProvider(modelId, apiKey) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  switch (model.provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, modelId);
    case 'google':
      return new GeminiProvider(apiKey, modelId);
    case 'zhipu':
      return new ZhipuProvider(apiKey, modelId);
    case 'qwen':
      return new QwenProvider(apiKey, modelId);
    case 'moonshot':
      return new MoonshotProvider(apiKey, modelId);
    case 'anthropic':
      return new ClaudeProvider(apiKey, modelId);
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

module.exports = {
  getAvailableModels,
  createProvider,
  parseAIResponse,
};
