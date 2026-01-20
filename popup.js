console.log("popup.js cargado correctamente");

const startBtn = document.getElementById('start');
const stopBtn  = document.getElementById('stop');
const status   = document.getElementById('status');

if (!startBtn || !stopBtn || !status) {
  console.error("No se encuentran los elementos del popup (IDs incorrectos?)");
}

startBtn.addEventListener('click', () => {
  console.log("Botón INICIAR clicado → enviando mensaje startLoop");
  chrome.runtime.sendMessage({ action: "startLoop" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error al enviar mensaje:", chrome.runtime.lastError.message);
      status.textContent = "Error: " + chrome.runtime.lastError.message;
    } else {
      console.log("Respuesta del background:", response);
      status.textContent = "Estado: ejecutándose";
    }
  });
});

stopBtn.addEventListener('click', () => {
  console.log("Botón DETENER clicado → enviando stopLoop");
  chrome.runtime.sendMessage({ action: "stopLoop" });
  status.textContent = "Estado: detenido";
});