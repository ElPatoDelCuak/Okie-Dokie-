// background.js - Con re-inyección en página de resultados

console.log("background.js (service worker) iniciado / despertado");

let isRunning = false;
let loopTimeout = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Mensaje recibido en background:", message, "desde:", sender);

  if (message.action === "startLoop") {
    if (isRunning) {
      console.log("Ya está corriendo, ignorando");
      sendResponse({ status: "already_running" });
      return true;
    }
    isRunning = true;
    console.log("Iniciando bucle de búsquedas");
    startSearchLoop();
    sendResponse({ status: "started" });
    return true;
  } else if (message.action === "stopLoop") {
    isRunning = false;
    if (loopTimeout) clearTimeout(loopTimeout);
    console.log("Bucle detenido");
    sendResponse({ status: "stopped" });
    return true;
  } else if (message.action === "closeWindow") {
    if (sender.tab && sender.tab.id) {
      console.log("Cerrando pestaña:", sender.tab.id);
      chrome.tabs.remove(sender.tab.id);
    }
    return true;
  }
});

async function startSearchLoop() {
  if (!isRunning) return;

  let query;
  try {
    const response = await fetch('https://opentdb.com/api.php?amount=1');
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      query = data.results[0].question;
      // Decodificar entidades HTML
      query = query.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    } else {
      console.error("No se obtuvieron resultados de la API");
      return;
    }
  } catch (err) {
    console.error("Error al obtener pregunta de la API:", err);
    return;
  }

  console.log("Procesando búsqueda:", query);

  try {
    const newTab = await chrome.tabs.create({
      url: "https://www.bing.com/",
      active: true
    });

    const tabId = newTab.id;

    // Esperar carga inicial
    await waitForTabComplete(tabId);

    // Inyectar content.js en inicial
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // Enviar para teclear y buscar
    await chrome.tabs.sendMessage(tabId, { action: "performSearch", query: query });

    // Detectar carga de resultados
    const resultsListener = async (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && tab.url.includes('/search')) {
        console.log("Página de resultados cargada para tabId:", tabId);
        chrome.tabs.onUpdated.removeListener(resultsListener);

        // Re-inyectar content.js en resultados
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
          console.log("content.js re-inyectado en resultados");

          // Enviar mensaje para scrolls y cierre (después de inyección)
          await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeña espera para que se cargue el script
          chrome.tabs.sendMessage(tabId, { action: "performScrollAndClose" });
          console.log("Mensaje performScrollAndClose enviado");
        } catch (err) {
          console.error("Error al re-inyectar o enviar:", err);
        }
      }
    };
    chrome.tabs.onUpdated.addListener(resultsListener);

  } catch (err) {
    console.error("Error en el ciclo:", err);
  }

  // Delay para siguiente iteración
  const delay = 25000 + Math.random() * 15000;
  console.log("Programando siguiente ciclo en", delay / 1000, "segundos");
  loopTimeout = setTimeout(startSearchLoop, delay);
}

function waitForTabComplete(tabId) {
  return new Promise(resolve => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}