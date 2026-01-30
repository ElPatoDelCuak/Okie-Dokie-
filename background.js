// background.js - v2.3 Fixed Mobile Points & Desktop Tabs

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

// DNR Mobile UA Rule (Edge Mobile for better Bing compatibility)
async function setMobileUserAgent(enable) {
  const ruleId = 1;
  // Edge on Android UA (Verified for text collection)
  const mobileUA = "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 EdgA/116.0.1938.69";

  if (enable) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        "id": ruleId,
        "priority": 1,
        "action": {
          "type": "modifyHeaders",
          "requestHeaders": [
            { "header": "User-Agent", "operation": "set", "value": mobileUA },
            { "header": "Sec-CH-UA", "operation": "set", "value": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Microsoft Edge\";v=\"116\"" },
            { "header": "Sec-CH-UA-Mobile", "operation": "set", "value": "?1" },
            { "header": "Sec-CH-UA-Platform", "operation": "set", "value": "\"Android\"" },
            { "header": "Sec-CH-UA-Platform-Version", "operation": "set", "value": "\"13.0.0\"" },
            { "header": "Sec-CH-UA-Model", "operation": "set", "value": "\"Pixel 7 Pro\"" }
          ]
        },
        "condition": {
          "urlFilter": "bing.com",
          "resourceTypes": ["main_frame", "sub_frame", "xmlhttprequest", "script", "image", "stylesheet"]
        }
      }]
    });
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startLoop") {
    if (state.isRunning) { return true; }
    state = { ...state, ...msg.config, isRunning: true, currentCount: 0 };
    setMobileUserAgent(state.mobileMode).then(startSearchLoop);
    sendResponse({ status: "started" });
  } else if (msg.action === "stopLoop") {
    stopLoop();
    sendResponse({ status: "stopped" });
  } else if (msg.action === "getStatus") {
    sendResponse(state);
  } else if (msg.action === "closeWindow") {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id).catch(() => { });
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
      let createData = {
        url: "https://www.bing.com",
        focused: true,
        width: 412,
        height: 850,
        type: "popup"
      };
      const win = await chrome.windows.create(createData);
      state.winId = win.id;
      state.tabId = win.tabs[0].id;

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
  setMobileUserAgent(false);
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