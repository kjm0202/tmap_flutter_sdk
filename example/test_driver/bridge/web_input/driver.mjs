/*
 * Flutter Web Input Test Driver
 *
 * This script automates interaction with a Flutter web application in Chrome
 * using the Chrome DevTools Protocol (CDP).
 *
 * Requirements:
 * - Node.js version 22+ (for global WebSocket and fetch support)
 *
 * Setup:
 * 1. Launch Flutter Web in Chrome with the debug port enabled:
 *    flutter run -d chrome --web-browser-debug-port=8257
 *
 * 2. Run this driver:
 *    node driver.mjs --port=8257
 */

import { setTimeout } from 'node:timers/promises';

const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const PORT = portArg ? portArg.split('=')[1] : '8257';

async function getTarget() {
  while (true) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const flutterTarget = targets.find(t => {
        if (t.type !== 'page') return false;
        try {
          const u = new URL(t.url);
          return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        } catch {
          return false;
        }
      });
      if (flutterTarget) return flutterTarget;
    } catch (e) {
      console.log('Waiting for Flutter Chrome to start...');
    }
    await setTimeout(1000);
  }
}

async function runDriver() {
  const processedGestures = new Set();
  console.log(`Connecting to Chrome on port ${PORT}...`);
  const target = await getTarget();
  const wsUrl = target.webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  console.log('Connected to target.');

  let requestId = 1;
  const pendingRequests = new Map();
  let connectionClosed = false;

  ws.onclose = () => {
    console.log('Connection closed.');
    connectionClosed = true;
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
      pendingRequests.delete(data.id);
    }
  };

  const cdpCall = (method, params = {}) => {
    if (connectionClosed) throw new Error('Connection closed');
    return new Promise((resolve, reject) => {
      const id = requestId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  try {
    while (!connectionClosed) {
      // Poll for gesture
      const result = await cdpCall('Runtime.evaluate', {
        expression: 'window.__tmapTrustedGesture',
        returnByValue: true
      });

      const gesture = result.result?.value;
      if (gesture && !gesture.done && !processedGestures.has(gesture.id)) {
        console.log(`Executing gesture: ${gesture.action} (ID: ${gesture.id})`);
        try {
          await handleAction(cdpCall, gesture);
          await cdpCall('Runtime.evaluate', {
            expression: `window.__tmapTrustedGesture?.id === ${gesture.id} && (window.__tmapTrustedGesture.done = true)`
          });
          console.log(`Gesture ${gesture.id} completed.`);
        } catch (err) {
          console.error(`Gesture ${gesture.id} failed:`, err);
          await cdpCall('Runtime.evaluate', {
            expression: `window.__tmapTrustedGesture?.id === ${gesture.id} && (window.__tmapTrustedGesture.error = ${JSON.stringify(String(err))}, window.__tmapTrustedGesture.done = true)`
          });
        }
        processedGestures.add(gesture.id);
      }
      await setTimeout(200);
    }
  } catch (e) {
    console.error('Driver loop error:', e);
  } finally {
    console.log('Reconnecting...');
    await setTimeout(1000);
    runDriver();
  }
}

async function handleAction(cdpCall, gesture) {
  const { action, x, y, endX, endY } = gesture;

  if (action === 'tap') {
    await cdpCall('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await cdpCall('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  } else if (action === 'doubleTap') {
    // Four presses/releases in total
    await cdpCall('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await cdpCall('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await setTimeout(40);
    await cdpCall('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 2 });
    await cdpCall('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 2 });
  } else if (action === 'hold') {
    await cdpCall('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await setTimeout(1000);
    await cdpCall('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (action === 'dragTouch') {
    await cdpCall('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    try {
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const curX = x + (endX - x) * (i / steps);
        const curY = y + (endY - y) * (i / steps);
        await cdpCall('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: curX, y: curY }] });
        await setTimeout(20);
      }
    } finally {
      await cdpCall('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  } else if (action === 'drag') {
    await cdpCall('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const curX = x + (endX - x) * (i / steps);
      const curY = y + (endY - y) * (i / steps);
      await cdpCall('Input.dispatchMouseEvent', { type: 'mouseMoved', x: curX, y: curY, button: 'left', buttons: 1 });
      await setTimeout(20);
    }
    await cdpCall('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: endY, button: 'left', buttons: 0, clickCount: 1 });
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
}

runDriver();
