const body = document.body;
const themeToggle = document.querySelector("#theme-toggle");
const cursorGlow = document.querySelector("#cursor-glow");
const modal = document.querySelector("#modal");
const toast = document.querySelector("#toast");
const sliderTrack = document.querySelector("#slider-track");
const slides = Array.from(document.querySelectorAll(".slide"));
const dotsWrap = document.querySelector("#slider-dots");
let currentSlide = 0;
let toastTimer;
body.dataset.cursor = "glow";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

themeToggle.addEventListener("click", () => {
  body.classList.toggle("light");
  themeToggle.textContent = body.classList.contains("light") ? "Dark" : "Light";
});

window.addEventListener("pointermove", (event) => {
  cursorGlow.style.left = `${event.clientX}px`;
  cursorGlow.style.top = `${event.clientY}px`;

  if (body.dataset.cursor === "trail") {
    const dot = document.createElement("span");
    dot.className = "trail-dot";
    dot.style.left = `${event.clientX - 6}px`;
    dot.style.top = `${event.clientY - 6}px`;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 700);
  }
});

document.querySelectorAll(".copy-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const code = button.parentElement.querySelector("code").textContent;

    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
      showToast("Код скопійовано.");
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1400);
    } catch {
      showToast("Браузер не дозволив копіювання.");
    }
  });
});

document.querySelectorAll("[data-toggle-code]").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".example-card");
    const code = card.querySelector(".example-code");
    const isOpen = code.classList.toggle("show");
    button.textContent = isOpen ? "Сховати код" : "Показати код";
  });
});

document.querySelectorAll("[data-copy-example]").forEach((button) => {
  button.addEventListener("click", async () => {
    const card = button.closest(".example-card");
    const code = card.querySelector(".example-code code").textContent;

    try {
      await navigator.clipboard.writeText(code);
      showToast("Код прикладу скопійовано.");
    } catch {
      showToast("Браузер не дозволив копіювання.");
    }
  });
});

function openModal() {
  if (!modal) {
    return;
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", openModal);
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModal);
});

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

if (sliderTrack && dotsWrap && slides.length > 0) {
  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.className = "slider-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Перейти до слайду ${index + 1}`);
    dot.addEventListener("click", () => setSlide(index));
    dotsWrap.appendChild(dot);
  });
}

function setSlide(index) {
  if (!sliderTrack || slides.length === 0) {
    return;
  }

  currentSlide = (index + slides.length) % slides.length;
  sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;

  document.querySelectorAll(".slider-dot").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === currentSlide);
  });
}

const prevSlide = document.querySelector("#prev-slide");
const nextSlide = document.querySelector("#next-slide");

if (prevSlide && nextSlide && slides.length > 0) {
  prevSlide.addEventListener("click", () => setSlide(currentSlide - 1));
  nextSlide.addEventListener("click", () => setSlide(currentSlide + 1));
  setSlide(0);
}

setInterval(() => {
  setSlide(currentSlide + 1);
}, 6500);

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;

    document.querySelectorAll(".tab-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === target);
    });
  });
});

document.querySelectorAll(".doc-tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.doc;

    document.querySelectorAll(".doc-tab-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".doc-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === target);
    });
  });
});

document.querySelectorAll("[data-cursor-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    body.dataset.cursor = button.dataset.cursorMode;

    document.querySelectorAll("[data-cursor-mode]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    showToast(`Курсор: ${button.textContent}`);
  });
});

document.querySelectorAll(".accordion-trigger").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
  });
});

document.querySelectorAll("[data-toast]").forEach((button) => {
  button.addEventListener("click", () => showToast("Форма виглядає готовою до підключення."));
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});
