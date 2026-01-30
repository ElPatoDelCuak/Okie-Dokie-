// content.js - v2.1 Fixed Typing & Scrolling

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "performSearch") {
    console.log("CMD: Perform Search for", message.query);
    typeAndSearch(message.query);
  } else if (message.action === "performScrollAndClose") {
    console.log("CMD: Scroll & Close");
    humanScrollAndClose();
  }
});

async function typeAndSearch(query) {
  // 1. Selector strategy (Desktop & Mobile)
  const input = document.getElementById("sb_form_q") ||
    document.querySelector('input[name="q"]') ||
    document.querySelector('input[type="search"]');

  if (!input) {
    console.error("Critical: Search input not found.");
    return;
  }

  // Focus and clear properly
  input.focus();
  input.value = "";
  input.click(); // Trigger mobile interaction

  await sleep(500);

  // 2. Typing simulation (Slower & Event-heavy)
  for (const char of query) {
    const key = char === " " ? "Space" : `Key${char.toUpperCase()}`;
    const code = char === " " ? "Space" : `Key${char.toUpperCase()}`;

    // KeyDown
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: code, bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: char, code: code, bubbles: true, composed: true }));

    // Update Value
    document.execCommand('insertText', false, char);
    // Fallback if execCommand is blocked (unlikely on simple inputs but good safety)
    if (!input.value.endsWith(char)) {
      input.value += char;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
    }

    // KeyUp
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: code, bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Variable delay (Human-like)
    await sleep(80 + Math.random() * 120);
  }

  await sleep(1000);

  // 3. Submission Strategy
  console.log("Attempting submission...");

  // A. Try "Enter" key on input (Best for SPA)
  const enterEvent = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  input.dispatchEvent(new KeyboardEvent('keydown', enterEvent));
  input.dispatchEvent(new KeyboardEvent('keypress', enterEvent));
  input.dispatchEvent(new KeyboardEvent('keyup', enterEvent));

  await sleep(500);

  // B. Search for Submit Button (Desktop & Mobile)
  const submitBtns = [
    document.getElementById("sb_form_go"), // Desktop
    document.getElementById("search_icon"), // Mobile
    document.querySelector('label[for="sb_form_go"]'), // Mobile Wrapper
    document.querySelector('input[type="submit"]'),
    document.querySelector('button[type="submit"]'),
    document.querySelector('.search.icon'),
    document.querySelector('[aria-label="Search"]'),
    document.querySelector('[aria-label="Buscar"]')
  ];

  for (const btn of submitBtns) {
    if (btn && btn.offsetParent !== null) { // Visible?
      console.log("Clicking button:", btn);
      btn.click();
      return; // Stop if clicked
    }
  }

  // C. Hard Form Submit (Last resort)
  const form = input.form || document.getElementById("sb_form");
  if (form) {
    console.log("Hard form submit");
    form.submit();
  }
}

async function humanScrollAndClose() {
  // Smoother logic
  const totalHeight = document.body.scrollHeight;
  const viewportHeight = window.innerHeight;

  if (totalHeight > viewportHeight) {
    // Scroll Down
    await smoothScrollTo(Math.min(totalHeight, viewportHeight + 400), 1000);
    await sleep(1000 + Math.random() * 1000);

    // Scroll Up a bit
    await smoothScrollTo(Math.max(0, window.scrollY - 300), 800);
    await sleep(1000 + Math.random() * 1000);

    // Scroll Down more
    await smoothScrollTo(Math.min(totalHeight, window.scrollY + 600), 1000);
    await sleep(2000);
  }

  console.log("Closing...");
  chrome.runtime.sendMessage({ action: "closeWindow" });
}

// Helper: Custom Smooth Scroll (better than behavior: smooth for automation)
function smoothScrollTo(endY, duration) {
  const startY = window.scrollY;
  const distance = endY - startY;
  const startTime = new Date().getTime();

  return new Promise(resolve => {
    const timer = setInterval(() => {
      const time = new Date().getTime() - startTime;
      const newX = easeInOutQuart(time, startY, distance, duration);
      window.scrollTo(0, newX);
      if (time >= duration) {
        clearInterval(timer);
        resolve();
      }
    }, 1000 / 60);
  });
}

function sendTouchEvent(element, eventType) {
  const touchObj = new Touch({
    identifier: Date.now(),
    target: element,
    clientX: 100,
    clientY: 100,
    radiusX: 2.5,
    radiusY: 2.5,
    rotationAngle: 10,
    force: 0.5,
  });

  const touchEvent = new TouchEvent(eventType, {
    cancelable: true,
    bubbles: true,
    touches: [touchObj],
    targetTouches: [touchObj],
    changedTouches: [touchObj],
    shiftedKey: false
  });

  element.dispatchEvent(touchEvent);
}

function easeInOutQuart(t, b, c, d) {
  if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
  return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}