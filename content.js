// content.js - Con logs extra

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "performSearch") {
    console.log("Recibido performSearch");
    performHumanLikeSearch(message.query);
  } else if (message.action === "performScrollAndClose") {
    console.log("Recibido performScrollAndClose");
    performScrollAndClose();
  }
});

async function performHumanLikeSearch(query) {
  const input = document.getElementById("sb_form_q") ||
                document.querySelector('input[name="q"]') ||
                document.querySelector('input[role="combobox"]') ||
                document.querySelector('input[type="search"]');

  if (!input) {
    console.error("No se encontró el input");
    return;
  }

  console.log("Input encontrado, tecleando:", query);

  input.value = "";
  input.focus();

  for (const char of query) {
    input.value += char;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    ['keydown', 'keypress', 'keyup'].forEach(type => {
      input.dispatchEvent(new KeyboardEvent(type, {
        key: char,
        code: `Key${char.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    });

    await new Promise(r => setTimeout(r, 60 + Math.random() * 140));
  }

  await new Promise(r => setTimeout(r, 500 + Math.random() * 900));

  console.log("Intentando enviar búsqueda");

  const enterProps = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  };
  input.dispatchEvent(new KeyboardEvent('keydown', enterProps));
  input.dispatchEvent(new KeyboardEvent('keypress', enterProps));
  input.dispatchEvent(new KeyboardEvent('keyup', enterProps));

  const form = input.form || input.closest('form') || document.getElementById('sb_form');
  if (form) {
    console.log("Submit form directo");
    form.submit();
  }

  const buttons = [
    document.getElementById('sb_form_go'),
    document.querySelector('input[type="submit"]'),
    document.querySelector('button[type="submit"]'),
    document.querySelector('[aria-label="Buscar en la web"]'),
    document.querySelector('.search.icon')
  ];
  for (const btn of buttons) {
    if (btn) {
      console.log("Clic en botón");
      btn.click();
      break;
    }
  }
}

async function performScrollAndClose() {
  console.log("Iniciando scrolls y cierre");

  await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

  console.log("Scroll 1: abajo 400px");
  window.scrollBy({ top: 400, behavior: 'smooth' });
  await new Promise(r => setTimeout(r, 1800 + Math.random() * 1000));

  console.log("Scroll 2: arriba 500px");
  window.scrollBy({ top: -500, behavior: 'smooth' });
  await new Promise(r => setTimeout(r, 2200 + Math.random() * 1000));

  console.log("Scroll 3: abajo 600px");
  window.scrollBy({ top: 600, behavior: 'smooth' });
  await new Promise(r => setTimeout(r, 2500 + Math.random() * 1000));

  await new Promise(r => setTimeout(r, 5000 + Math.random() * 7000));

  console.log("Enviando cierre de ventana");
  chrome.runtime.sendMessage({ action: "closeWindow" });
}