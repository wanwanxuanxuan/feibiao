/**
 * AI Browser Agent - Main Server
 * Handles Express, WebSocket, Playwright browser, and AI agent management
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { chromium } = require('playwright');
const BrowserAgent = require('./agent');
const { getAvailableModels } = require('./ai-providers');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// CORS support - allow requests from GitHub Pages and localhost
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API endpoint to get available models
app.get('/api/models', (req, res) => {
  res.json({ models: getAvailableModels() });
});

// --- HTTP API for browser control (fallback when WebSocket is unavailable) ---

// Get current screenshot
app.get('/api/screenshot', async (req, res) => {
  if (!page) {
    return res.status(503).json({ error: 'Browser not initialized' });
  }
  try {
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
    res.json({
      type: 'screenshot',
      data: screenshot.toString('base64'),
      viewport: viewportSize,
      url: page.url(),
      title: await page.title().catch(() => '')
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get current status (URL, title)
app.get('/api/status', async (req, res) => {
  if (!page) {
    return res.status(503).json({ error: 'Browser not initialized' });
  }
  res.json({
    url: page.url(),
    title: await page.title().catch(() => ''),
    viewport: viewportSize
  });
});

// Navigate to URL
app.post('/api/navigate', async (req, res) => {
  if (!page) {
    return res.status(503).json({ error: 'Browser not initialized' });
  }
  let url = req.body.url;
  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    broadcast({ type: 'navigation_start', url });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    broadcast({ type: 'navigation_complete', url: finalUrl, title });
    res.json({ url: finalUrl, title, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message, success: false });
  }
});

// Click at coordinates
app.post('/api/click', async (req, res) => {
  if (!page) return res.status(503).json({ error: 'Browser not initialized' });
  const { x, y } = req.body;
  if (x === undefined || y === undefined) {
    return res.status(400).json({ error: 'Missing x or y' });
  }
  try {
    await page.mouse.click(x, y);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Type text
app.post('/api/type', async (req, res) => {
  if (!page) return res.status(503).json({ error: 'Browser not initialized' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  try {
    await page.keyboard.type(text, { delay: 20 });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Press key
app.post('/api/keypress', async (req, res) => {
  if (!page) return res.status(503).json({ error: 'Browser not initialized' });
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    await page.keyboard.press(key);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Scroll
app.post('/api/scroll', async (req, res) => {
  if (!page) return res.status(503).json({ error: 'Browser not initialized' });
  const { deltaX, deltaY } = req.body;
  try {
    await page.mouse.wheel(deltaX || 0, deltaY || 0);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Go back
app.post('/api/go-back', async (req, res) => {
  if (!page) return res.status(503).json({ error: 'Browser not initialized' });
  try {
    await page.goBack().catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Go forward
app.post('/api/go-forward', async (req, res) => {
  if (!page) return res.status(503).json({ error: 'Browser not initialized' });
  try {
    await page.goForward().catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Browser state
let browser = null;
let browserContext = null;
let page = null;
let currentAgent = null;
let viewportSize = { width: 1280, height: 800 };

// Screenshot streaming
let screenshotInterval = null;
let latestScreenshot = null;
let clients = new Set();

/**
 * Initialize the browser
 */
async function initBrowser() {
  if (browser) return;

  console.log('Launching browser...');
  browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });

  browserContext = await browser.newContext({
    viewport: viewportSize,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  page = await browserContext.newPage();

  // Set default timeout
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);

  // Listen for URL changes (e.g., when user clicks a link)
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      const url = page.url();
      const title = await page.title().catch(() => '');
      broadcast({ type: 'navigation_complete', url, title });
    }
  });

  console.log('Browser launched successfully.');

  // Navigate to a default page
  await page.goto('about:blank');
}

/**
 * Start streaming screenshots to connected clients
 */
function startScreenshotStreaming() {
  if (screenshotInterval) return;

  screenshotInterval = setInterval(async () => {
    if (!page || clients.size === 0) return;

    try {
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
      latestScreenshot = screenshot.toString('base64');

      const msg = JSON.stringify({
        type: 'screenshot',
        data: latestScreenshot,
        viewport: viewportSize
      });

      for (const client of clients) {
        if (client.readyState === 1) {
          client.send(msg);
        }
      }
    } catch (e) {
      // Ignore screenshot errors
    }
  }, 400); // ~2.5 fps, balance between smoothness and performance
}

/**
 * Stop streaming screenshots
 */
function stopScreenshotStreaming() {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
}

/**
 * Broadcast a message to all connected clients
 */
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  // Start streaming if not already
  startScreenshotStreaming();

  // Send current URL and available models
  ws.send(JSON.stringify({
    type: 'init',
    models: getAvailableModels(),
    viewport: viewportSize,
    currentUrl: page ? page.url() : 'about:blank',
  }));

  ws.on('message', async (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
      console.log('Received message:', message.type);
    } catch (e) {
      console.error('Invalid message:', e.message);
      return;
    }

    await handleMessage(ws, message);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    if (clients.size === 0) {
      // Don't stop the browser, just stop streaming
      stopScreenshotStreaming();
    }
  });
});

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(ws, message) {
  switch (message.type) {
    case 'navigate':
      await handleNavigate(ws, message.url);
      break;

    case 'click':
      await handleClick(message.x, message.y);
      break;

    case 'type':
      await handleType(message.text);
      break;

    case 'keypress':
      await handleKeypress(message.key);
      break;

    case 'scroll':
      await handleScroll(message.deltaX, message.deltaY);
      break;

    case 'go_back':
      if (page) await page.goBack().catch(() => {});
      break;

    case 'go_forward':
      if (page) await page.goForward().catch(() => {});
      break;

    case 'start_agent':
      await handleStartAgent(ws, message);
      break;

    case 'pause_agent':
      if (currentAgent) currentAgent.pause();
      break;

    case 'resume_agent':
      if (currentAgent) currentAgent.resume();
      break;

    case 'stop_agent':
      if (currentAgent) currentAgent.stop();
      currentAgent = null;
      break;

    case 'answer':
      if (currentAgent) currentAgent.setAnswer(message.answer);
      break;

    case 'set_viewport':
      if (message.width && message.height) {
        viewportSize = { width: message.width, height: message.height };
        if (page) await page.setViewportSize(viewportSize);
      }
      break;

    case 'get_screenshot':
      if (latestScreenshot) {
        ws.send(JSON.stringify({
          type: 'screenshot',
          data: latestScreenshot,
          viewport: viewportSize
        }));
      }
      break;

    case 'take_screenshot':
      if (page) {
        try {
          const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
          ws.send(JSON.stringify({
            type: 'screenshot_taken',
            data: screenshot.toString('base64'),
            viewport: viewportSize
          }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'screenshot_error', error: e.message }));
        }
      }
      break;

    case 'action_done':
      // Frontend free agent confirms action executed
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Navigate to a URL
 */
async function handleNavigate(ws, url) {
  if (!page) return;

  console.log('Navigating to:', url);
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    broadcast({ type: 'navigation_start', url });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    broadcast({ type: 'navigation_complete', url: page.url(), title: await page.title() });
  } catch (e) {
    broadcast({ type: 'navigation_error', error: e.message, url });
  }
}

/**
 * Handle user click
 */
async function handleClick(x, y) {
  if (!page) return;
  console.log(`User click at (${x}, ${y})`);
  if (currentAgent && currentAgent.running) {
    currentAgent.userIntervened();
  }
  try {
    await page.mouse.click(x, y);
  } catch (e) {
    console.error('Click error:', e.message);
  }
}

/**
 * Handle user typing
 */
async function handleType(text) {
  if (!page) return;
  if (currentAgent && currentAgent.running) {
    currentAgent.userIntervened();
  }
  try {
    await page.keyboard.type(text, { delay: 20 });
  } catch (e) {
    console.error('Type error:', e.message);
  }
}

/**
 * Handle key press
 */
async function handleKeypress(key) {
  if (!page) return;
  if (currentAgent && currentAgent.running) {
    currentAgent.userIntervened();
  }
  try {
    await page.keyboard.press(key);
  } catch (e) {
    console.error('Keypress error:', e.message);
  }
}

/**
 * Handle scroll
 */
async function handleScroll(deltaX, deltaY) {
  if (!page) return;
  try {
    await page.mouse.wheel(deltaX, deltaY);
  } catch (e) {
    console.error('Scroll error:', e.message);
  }
}

/**
 * Start the AI agent
 */
async function handleStartAgent(ws, message) {
  const { model, apiKey, task } = message;

  if (!model || !apiKey || !task) {
    ws.send(JSON.stringify({
      type: 'agent_error',
      error: 'Missing model, apiKey, or task'
    }));
    return;
  }

  if (!page) {
    ws.send(JSON.stringify({
      type: 'agent_error',
      error: 'Browser not initialized'
    }));
    return;
  }

  // Stop existing agent
  if (currentAgent) {
    currentAgent.stop();
  }

  try {
    currentAgent = new BrowserAgent(page, ws, { model, apiKey });
    broadcast({ type: 'agent_status', status: 'starting' });
    await currentAgent.start(task);
  } catch (e) {
    console.error('Agent start error:', e);
    ws.send(JSON.stringify({
      type: 'agent_error',
      error: e.message
    }));
  }
}

// Start the server
async function startServer() {
  try {
    await initBrowser();
  } catch (e) {
    console.error('Failed to launch browser:', e.message);
    console.log('Server will start without browser. Please install Playwright browsers.');
  }

  server.listen(PORT, () => {
    console.log(`\n🚀 AI Browser Agent running at http://localhost:${PORT}`);
    console.log(`   Available models: ${getAvailableModels().length} vision models`);
    console.log(`   Press Ctrl+C to stop\n`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  stopScreenshotStreaming();
  if (currentAgent) currentAgent.stop();
  if (browser) await browser.close();
  process.exit(0);
});

startServer();
