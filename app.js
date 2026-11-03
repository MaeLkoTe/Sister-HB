(() => {
  const config = window.SISTER_BANK_CONFIG;
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  const confettiLayer = document.getElementById("confetti-layer");
  const seenStories = new Set();
  let nervesPercent = 15;
  let toastTimer;
  let storyTimer;
  let activeStoryIndex = 0;
  let storyStartedAt = 0;
  let currentCompliment = -1;
  let wheelSpinning = false;

  const icons = {
    wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h15a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13v3.5"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/><path d="M17 14h.01"/></svg>',
    gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v11H3zM2 7h20v4H2zM12 7v14M12 7H7.5a2.5 2.5 0 1 1 2.1-3.9L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.1-3.9L12 7Z"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15ZM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6L5 15Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-5-2-1.2 2.1a15.4 15.4 0 0 1-7.4-7.4L9.5 8.5 7 3Z"/><path d="M14 4a6 6 0 0 1 6 6M14 7a3 3 0 0 1 3 3"/></svg>',
    percent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14.8 4l3.2-.2.9 3.1 2.5 2-1.2 3 1.2 3-2.5 2-.9 3.1-3.2-.2-2.8 1.5L9.2 19l-3.2.2-.9-3.1-2.5-2 1.2-3-1.2-3 2.5-2 .9-3.1 3.2.2L12 2.5Z"/><path d="m8 16 8-8M8.3 8.4h.1M15.6 15.7h.1"/></svg>',
    basket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 2 12h10l2-12H5ZM3 6h18v3H3zM9 3l3 3 3-3M9 12v5M15 12v5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function render() {
    document.getElementById("welcome-title").innerHTML = `Привет, ${escapeHtml(config.sisterName)}! <span aria-label="сердце">❤️</span>`;
    const avatar = document.getElementById("avatar");
    avatar.innerHTML = config.avatarImage
      ? `<img src="${escapeHtml(config.avatarImage)}" alt="" />`
      : '<span aria-hidden="true">👩🏻</span>';

    document.getElementById("stories").innerHTML = config.stories.map((story, index) => `
      <button class="story-item${seenStories.has(index) ? " seen" : ""}" type="button" data-action="story" data-index="${index}" aria-label="Открыть историю: ${escapeHtml(story.title)}">
        <span class="story-ring"><span class="story-face">${escapeHtml(story.emoji || "❤️")}</span></span>
        <span class="story-label">${escapeHtml(story.title)}</span>
      </button>`).join("");

    document.getElementById("account-list").innerHTML = config.accounts.map((account, index) => `
      <button class="account-row" type="button" data-action="account" data-id="${escapeHtml(account.id)}" aria-label="Подробнее: ${escapeHtml(account.title)}">
        <span class="account-icon">${icons.wallet}</span>
        <span class="account-copy"><span class="account-title">${escapeHtml(account.title)}</span><span class="account-subtitle">${escapeHtml(account.subtitle)}</span></span>
        <span class="account-value" data-account-value="${escapeHtml(account.id)}">${index === 0 ? nervesPercent + "% 📉" : `${escapeHtml(account.value)} 👑`}</span>
      </button>`).join("");

    document.getElementById("quick-actions").innerHTML = config.actions.map(action => `
      <button class="quick-action${action.kind === "accent" ? " accent" : ""}" type="button" data-action="${escapeHtml(action.id)}" aria-label="${escapeHtml(action.title)}">
        <span class="quick-icon">${icons[action.icon] || icons.sparkles}</span>
        <span class="quick-title">${escapeHtml(action.title)}</span>
        ${action.subtitle ? `<span class="quick-subtitle">${escapeHtml(action.subtitle)}</span>` : ""}
      </button>`).join("");

    document.getElementById("transactions").innerHTML = config.transactions.map(transaction => `
      <button class="transaction-row" type="button" data-action="transaction" data-id="${escapeHtml(transaction.id)}" aria-label="Открыть чек: ${escapeHtml(transaction.title)}">
        <span class="transaction-icon ${escapeHtml(transaction.tone)}">${icons[transaction.icon] || ""}</span>
        <span class="transaction-copy">${transaction.year ? `<span class="transaction-year">${escapeHtml(transaction.year)} год</span>` : ""}<span class="transaction-title">${escapeHtml(transaction.title)}</span>${transaction.subtitle ? `<span class="transaction-subtitle">${escapeHtml(transaction.subtitle)}</span>` : ""}</span>
        <span class="transaction-amount${transaction.tone === "green" ? " green-text" : ""}">${escapeHtml(transaction.amount || "")}</span>
      </button>`).join("");
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toastRegion.innerHTML = `<div class="toast" role="status">${escapeHtml(message)}</div>`;
    toastTimer = setTimeout(() => {
      const toast = toastRegion.querySelector(".toast");
      if (!toast) return;
      toast.classList.add("leaving");
      setTimeout(() => { if (toastRegion.contains(toast)) toastRegion.innerHTML = ""; }, 240);
    }, 3900);
  }

  function closeModal() {
    clearTimeout(storyTimer);
    modalRoot.innerHTML = "";
    document.body.classList.remove("modal-open");
    wheelSpinning = false;
  }

  function openModal(title, body, options = {}) {
    clearTimeout(storyTimer);
    modalRoot.innerHTML = `<div class="modal-root-inner"><div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head"><h2 class="modal-title" id="modal-title">${escapeHtml(title)}</h2><button class="modal-close" type="button" data-action="close-modal" aria-label="Закрыть">×</button></div>
      <div class="modal-copy">${body}</div>${options.button ? `<button class="primary-button" type="button" data-action="${escapeHtml(options.button.action)}" ${options.button.id ? `data-id="${escapeHtml(options.button.id)}"` : ""}>${escapeHtml(options.button.label)}</button>` : ""}
    </div></div>`;
    modalRoot.classList.add("is-open");
    const inner = modalRoot.querySelector(".modal-root-inner");
    inner.style.cssText = "position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:rgba(13,15,18,.58);animation:fade-in .2s ease both";
    if (window.matchMedia("(min-width: 600px)").matches) inner.style.alignItems = "center";
    inner.addEventListener("click", event => { if (event.target === inner) closeModal(); });
    document.body.classList.add("modal-open");
    modalRoot.querySelector(".modal-close")?.focus({ preventScroll: true });
  }

  function markStorySeen(index) {
    seenStories.add(index);
    const button = document.querySelector(`.story-item[data-index="${index}"]`);
    if (button) button.classList.add("seen");
  }

  function openStory(index) {
    clearTimeout(storyTimer);
    activeStoryIndex = (index + config.stories.length) % config.stories.length;
    storyStartedAt = Date.now();
    const story = config.stories[activeStoryIndex];
    let media = `<span aria-hidden="true">${escapeHtml(story.emoji || "❤️")}</span>`;
    if (story.media?.src) {
      media = story.media.type === "video"
        ? `<video src="${escapeHtml(story.media.src)}" autoplay muted loop playsinline></video>`
        : `<img src="${escapeHtml(story.media.src)}" alt="" />`;
    }
    modalRoot.innerHTML = `<div class="story-overlay" role="dialog" aria-modal="true" aria-label="История: ${escapeHtml(story.title)}">
      <div class="story-card"><div class="story-progress-track"><div class="story-progress-fill run"></div></div>
        <div class="story-heading">${escapeHtml(story.title)}</div>
        <button class="story-close" type="button" data-action="close-story" aria-label="Закрыть историю">×</button>
        <div class="story-media">${media}</div>
        <div class="story-tap"><button type="button" data-action="story-prev" aria-label="Предыдущая история"></button><button type="button" data-action="story-next" aria-label="Следующая история"></button></div>
        <p class="story-greeting">${escapeHtml(story.greeting)}</p>
      </div></div>`;
    document.body.classList.add("modal-open");
    storyTimer = setTimeout(() => advanceStory(1), 7000);
  }

  function closeStory() {
    if (Date.now() - storyStartedAt > 1200) markStorySeen(activeStoryIndex);
    closeModal();
  }

  function advanceStory(amount) {
    markStorySeen(activeStoryIndex);
    if (amount > 0 && activeStoryIndex === config.stories.length - 1) {
      closeModal();
      return;
    }
    openStory(activeStoryIndex + amount);
  }

  function openAccount(id) {
    const account = config.accounts.find(item => item.id === id);
    if (!account) return;
    if (id === "nerves") {
      openModal(account.title, `<p>${escapeHtml(account.detail)}</p><div class="account-progress"><div class="account-progress-fill" style="width:${nervesPercent}%"></div></div><p class="percent-caption">Запас: <strong class="nerves-value">${nervesPercent}%</strong></p>`, {
        button: { action: "refill", label: nervesPercent === 100 ? "Запас полный 💛" : "Пополнить объятиями" }
      });
      if (nervesPercent === 100) modalRoot.querySelector(".primary-button").disabled = true;
      return;
    }
    openModal(account.title, `<p>${escapeHtml(account.detail)}</p><div class="modal-highlight">Текущий баланс: <strong>${escapeHtml(account.value)}</strong> 👑</div>`);
  }

  function launchConfetti() {
    const palette = ["#ef3124", "#ffce45", "#fff", "#ed7290", "#77cf9b", "#77b7f5"];
    confettiLayer.innerHTML = Array.from({ length: 90 }, (_, index) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 850;
      const drift = `${Math.round(Math.random() * 210 - 105)}px`;
      const spin = `${Math.round(Math.random() * 1200 - 600)}deg`;
      const duration = 2.2 + Math.random() * 2.1;
      const color = palette[index % palette.length];
      return `<i class="confetti-piece" style="left:${left}%;--drift:${drift};--spin:${spin};--fall-time:${duration}s;--confetti-color:${color};animation-delay:${delay}ms"></i>`;
    }).join("");
    setTimeout(() => { confettiLayer.innerHTML = ""; }, 5100);
  }

  function openGift() {
    launchConfetti();
    openModal(config.gift.title, `<div class="certificate"><div class="certificate-stamp">🎁</div><strong>Подарок одобрен семейным банком</strong><p>${escapeHtml(config.gift.message)}</p></div><div class="modal-highlight"><strong>Подсказка к выдаче:</strong><br />${escapeHtml(config.gift.riddle)}</div><p style="margin-top:11px">${escapeHtml(config.gift.note)}</p>`);
  }

  function openSbp() {
    const nextIndex = Math.floor(Math.random() * config.compliments.length);
    currentCompliment = nextIndex === currentCompliment && config.compliments.length > 1 ? (nextIndex + 1) % config.compliments.length : nextIndex;
    openModal("СБП — Семейные Быстрые Поздравления", `<div class="compliment-box" id="compliment-box">${escapeHtml(config.compliments[currentCompliment])}</div>`, {
      button: { action: "new-compliment", label: "Ещё комплимент ✨" }
    });
  }

  function newCompliment() {
    let nextIndex = Math.floor(Math.random() * config.compliments.length);
    if (nextIndex === currentCompliment && config.compliments.length > 1) nextIndex = (nextIndex + 1) % config.compliments.length;
    currentCompliment = nextIndex;
    const box = document.getElementById("compliment-box");
    if (box) box.textContent = config.compliments[currentCompliment];
  }

  function openWheel() {
    openModal("Барабан суперкэшбэка", `<p>Испытай удачу в семейном маркетплейсе!</p><div class="wheel-wrap"><div class="wheel-disc" id="wheel-disc" aria-hidden="true">♡</div></div><p class="modal-highlight wheel-result" hidden></p>`, {
      button: { action: "spin", label: "Крутить" }
    });
  }

  function receipt(transaction) {
    const lines = transaction.receipt.map(line => `<p>${escapeHtml(line)}</p>`).join("");
    openModal("Чек по операции", `<div class="receipt-status"><span class="receipt-dot"></span>${transaction.id === "surprise" ? "В обработке" : "Исполнено"}</div><div class="modal-highlight"><strong>${transaction.year ? `${escapeHtml(transaction.year)} год · ` : ""}${escapeHtml(transaction.title)}</strong>${transaction.amount ? `<br />Сумма: ${escapeHtml(transaction.amount)}` : ""}</div>${lines}`);
  }

  document.addEventListener("click", event => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    if (action === "notification") showToast(config.notification);
    if (action === "card") showToast("Карта активна. Срок действия: бессрочно");
    if (action === "story") openStory(Number(control.dataset.index));
    if (action === "close-story") closeStory();
    if (action === "story-next") advanceStory(1);
    if (action === "story-prev") advanceStory(-1);
    if (action === "account") openAccount(control.dataset.id);
    if (action === "gift") openGift();
    if (action === "sbp") openSbp();
    if (action === "chaos") openModal("Заявка на суету", `<p>${escapeHtml(config.chaosMessage)}</p><div class="modal-highlight">Приоритет заявки: праздничный 🎂</div>`);
    if (action === "wheel") openWheel();
    if (action === "transaction") {
      const transaction = config.transactions.find(item => item.id === control.dataset.id);
      if (transaction) receipt(transaction);
    }
    if (action === "close-modal") closeModal();
    if (action === "refill") {
      nervesPercent = 100;
      const fill = modalRoot.querySelector(".account-progress-fill");
      const value = modalRoot.querySelector(".nerves-value");
      if (fill) fill.style.width = "100%";
      if (value) value.textContent = "100%";
      const button = modalRoot.querySelector(".primary-button");
      if (button) { button.textContent = "Запас полный 💛"; button.disabled = true; }
      const accountValue = document.querySelector('[data-account-value="nerves"]');
      if (accountValue) accountValue.innerHTML = "100% 💪";
      showToast("Запас нервных клеток пополнен объятиями до 100% 💛");
    }
    if (action === "new-compliment") newCompliment();
    if (action === "spin" && !wheelSpinning) {
      wheelSpinning = true;
      control.disabled = true;
      control.textContent = "Крутим…";
      modalRoot.querySelector("#wheel-disc")?.classList.add("spinning");
      setTimeout(() => {
        const result = modalRoot.querySelector(".wheel-result");
        if (result) { result.hidden = false; result.textContent = "100% кэшбэк на хорошее настроение и вкусняшки! 🛍️"; }
        const button = modalRoot.querySelector(".primary-button");
        if (button) { button.textContent = "Выигрыш зачислен 🎉"; button.disabled = true; }
        wheelSpinning = false;
      }, 1550);
    }
  });

  document.addEventListener("keydown", event => {
    if (!modalRoot.innerHTML) return;
    if (event.key === "Escape") {
      if (modalRoot.querySelector(".story-overlay")) closeStory(); else closeModal();
    }
    if (modalRoot.querySelector(".story-overlay")) {
      if (event.key === "ArrowRight") advanceStory(1);
      if (event.key === "ArrowLeft") advanceStory(-1);
    }
  });

  render();
})();
