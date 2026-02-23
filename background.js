// background.js - v3.0 CDP Device Emulation (like DevTools F12 device mode)

let state = {
  isRunning: false,
  loopId: null,
  currentCount: 0,
  maxSearches: 30,
  mobileMode: false,
  tabId: null,
  winId: null
};

// Fallback dictionary
const FALLBACK_WORDS = ["clima", "tiempo", "noticias", "futbol", "cine", "recetas", "mapas", "traductor", "vuelos", "hoteles", "juegos", "musica", "videojuegos", "tecnologia", "ciencia", "historia", "libros", "arte", "moda", "coches"];

// Pixel 7 Pro device profile (matches DevTools device list)
const MOBILE_DEVICE = {
  userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 EdgA/116.0.1938.69",
  width: 412,
  height: 915,
  deviceScaleFactor: 3.5
};

// Attach Chrome DevTools Protocol to tab and set full mobile emulation
// (same as picking a device in DevTools > Toggle device toolbar)
async function attachMobileEmulation(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");

    // 1. Override viewport dimensions + mobile flag (critical for Bing detection)
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setDeviceMetricsOverride", {
      width: MOBILE_DEVICE.width,
      height: MOBILE_DEVICE.height,
      deviceScaleFactor: MOBILE_DEVICE.deviceScaleFactor,
      mobile: true,
      screenOrientation: { angle: 0, type: "portraitPrimary" }
    });

    // 2. Override User-Agent + Client Hints (same as DevTools Network conditions)
    await chrome.debugger.sendCommand({ tabId }, "Network.setUserAgentOverride", {
      userAgent: MOBILE_DEVICE.userAgent,
      acceptLanguage: "es-ES,es;q=0.9",
      platform: "Linux armv8l",
      userAgentMetadata: {
        brands: [
          { brand: "Chromium", version: "116" },
          { brand: "Not)A;Brand", version: "24" },
          { brand: "Microsoft Edge", version: "116" }
        ],
        fullVersionList: [
          { brand: "Chromium", version: "116.0.5845.190" },
          { brand: "Not)A;Brand", version: "24.0.0.0" },
          { brand: "Microsoft Edge", version: "116.0.1938.69" }
        ],
        platform: "Android",
        platformVersion: "13.0.0",
        architecture: "arm",
        model: "Pixel 7 Pro",
        mobile: true
      }
    });

    // 3. Enable touch events (Bing checks for these)
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5
    });

    console.log("[CDP] Mobile emulation active on tab", tabId);
    return true;
  } catch (e) {
    console.error("[CDP] Failed to attach:", e);
    return false;
  }
}

async function detachDebugger(tabId) {
  try { await chrome.debugger.detach({ tabId }); } catch (e) { }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startLoop") {
    if (state.isRunning) { return true; }
    state = { ...state, ...msg.config, isRunning: true, currentCount: 0 };
    startSearchLoop();
    sendResponse({ status: "started" });
  } else if (msg.action === "stopLoop") {
    stopLoop();
    sendResponse({ status: "stopped" });
  } else if (msg.action === "getStatus") {
    sendResponse(state);
  } else if (msg.action === "closeWindow") {
    if (sender.tab && sender.tab.id) {
      const tid = sender.tab.id;
      detachDebugger(tid).finally(() => chrome.tabs.remove(tid).catch(() => { }));
    }
  }
});

async function startSearchLoop() {
  if (!state.isRunning || state.currentCount >= state.maxSearches) {
    if (state.isRunning) stopLoop();
    return;
  }

  state.currentCount++;
  broadcastStatus();

  const query = await getQuery();

  try {
    // Desktop: Uses TABS as requested
    // Mobile: Uses WINDOWS to enforce dimensions (Critical for detection)

    if (state.mobileMode) {
      // 1. Create popup with blank page (so we can attach CDP before Bing loads)
      const win = await chrome.windows.create({
        url: "about:blank",
        focused: true,
        width: MOBILE_DEVICE.width,
        height: MOBILE_DEVICE.height + 80, // +80 for chrome bar
        type: "popup"
      });
      state.winId = win.id;
      state.tabId = win.tabs[0].id;

      // 2. Attach CDP device emulation (Pixel 7 Pro, like DevTools F12 device mode)
      await attachMobileEmulation(state.tabId);

      // 3. Now navigate to Bing — it will load already seeing mobile emulation
      await chrome.tabs.update(state.tabId, { url: "https://www.bing.com" });

    } else {
      // Desktop -> Tab
      const tab = await chrome.tabs.create({ url: "https://www.bing.com", active: true });
      state.tabId = tab.id;
    }

    // Listen for initial load
    const listener = async (tid, changeInfo, tab) => {
      if (tid === state.tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        await chrome.scripting.executeScript({ target: { tabId: tid }, files: ['content.js'] });
        await sleep(1500);
        chrome.tabs.sendMessage(tid, { action: "performSearch", query: query }).catch(() => { });
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // Result Page Listener (Re-inject for scrolling)
    const resultListener = async (tid, changeInfo, tab) => {
      if (tid === state.tabId && changeInfo.status === 'complete' && tab.url.includes('search')) {
        await sleep(2000);
        try {
          await chrome.scripting.executeScript({ target: { tabId: tid }, files: ['content.js'] });
          chrome.tabs.sendMessage(tid, { action: "performScrollAndClose" }).catch(() => { });
          chrome.tabs.onUpdated.removeListener(resultListener);
        } catch (e) { }
      }
    };
    chrome.tabs.onUpdated.addListener(resultListener);

  } catch (e) { console.error(e); }

  // Schedule next
  const delay = 25000 + Math.random() * 10000;
  state.loopId = setTimeout(startSearchLoop, delay);
}

function stopLoop() {
  state.isRunning = false;
  if (state.loopId) clearTimeout(state.loopId);
  if (state.tabId) detachDebugger(state.tabId);
  broadcastStatus();
  chrome.runtime.sendMessage({ action: "loopStopped", ...state }).catch(() => { });
}

function broadcastStatus() {
  chrome.runtime.sendMessage({ action: "updateProgress", ...state }).catch(() => { });
}

async function getQuery() {
  try {
    const r = await fetch('https://opentdb.com/api.php?amount=1');
    const d = await r.json();
    if (d.results?.[0]?.question) return decodeHTML(d.results[0].question);
  } catch (e) { }
  return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
}

function decodeHTML(h) { return h.replace(/&quot;/g, '"').replace(/&#039;/g, "'"); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }