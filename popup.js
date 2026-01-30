// popup.js - Actualizado para la nueva UI

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusBadge = document.getElementById('statusBadge');
const mobileModeToggle = document.getElementById('mobileMode');
const maxSearchesInput = document.getElementById('maxSearches');
const currentCountSpan = document.getElementById('currentCount');
const totalCountSpan = document.getElementById('totalCount');
const progressFill = document.getElementById('progressFill');
const progressArea = document.getElementById('progressArea');

// 1. Cargar estado inicial desde storage y mandar mensaje para saber si corre
chrome.storage.local.get(['mobileMode', 'maxSearches'], (result) => {
  if (result.mobileMode !== undefined) mobileModeToggle.checked = result.mobileMode;
  if (result.maxSearches) maxSearchesInput.value = result.maxSearches;
  updateTotalDisplay();
});

// Pedir estado actual al Bkg
chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
  if (response) {
    updateUI(response.isRunning, response.currentCount, response.maxSearches);
  }
});

// 2. Listeners
startBtn.addEventListener('click', () => {
  const config = {
    mobileMode: mobileModeToggle.checked,
    maxSearches: parseInt(maxSearchesInput.value, 10) || 30
  };

  // Guardar settings
  chrome.storage.local.set(config);

  chrome.runtime.sendMessage({ action: "startLoop", config: config }, (res) => {
    if (res && res.status === "started") {
      updateUI(true, 0, config.maxSearches);
    }
  });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "stopLoop" }, (res) => {
    if (res && res.status === "stopped") {
      updateUI(false, 0, parseInt(maxSearchesInput.value));
    }
  });
});

// Actualizar visualmente al cambiar input numérico
maxSearchesInput.addEventListener('change', updateTotalDisplay);
maxSearchesInput.addEventListener('input', updateTotalDisplay);

function updateTotalDisplay() {
  totalCountSpan.textContent = maxSearchesInput.value;
}

// 3. Escuchar mensajes de progreso del background (si decidimos enviarlos)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "updateProgress") {
    updateUI(true, msg.currentCount, msg.maxSearches);
  } else if (msg.action === "loopStopped") {
    updateUI(false, msg.currentCount, msg.maxSearches);
  }
});

function updateUI(isRunning, current, max) {
  if (isRunning) {
    statusBadge.textContent = "Ejecutando";
    statusBadge.className = "status-badge running";
    startBtn.classList.add('btn-disabled');
    stopBtn.classList.remove('btn-disabled');
    progressArea.style.opacity = "1";

    // Disable inputs while running
    mobileModeToggle.disabled = true;
    maxSearchesInput.disabled = true;

    currentCountSpan.textContent = current;
    totalCountSpan.textContent = max;

    const percentage = Math.min((current / max) * 100, 100);
    progressFill.style.width = percentage + "%";

  } else {
    statusBadge.textContent = "Inactivo";
    statusBadge.className = "status-badge";
    startBtn.classList.remove('btn-disabled');
    stopBtn.classList.add('btn-disabled');
    progressArea.style.opacity = "0.5";

    // Enable inputs
    mobileModeToggle.disabled = false;
    maxSearchesInput.disabled = false;

    // Reset inputs if needed or keep last state
  }
}