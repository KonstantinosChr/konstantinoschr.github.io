(() => {
  "use strict";

  /* ==========================================================
     Analytics — GoatCounter (free, no cookies, no consent banner).
     1. Create a free account at https://www.goatcounter.com/signup
     2. Put the code you chose below, e.g. "konstantinoschr"
     Leave it empty to keep analytics switched off.
     ========================================================== */
  const GOATCOUNTER_CODE = "";

  const root = document.documentElement;
  root.classList.add("js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  /* Run a DOM change inside a View Transition when the browser supports it. */
  const withTransition = (update, { className, onReady } = {}) => {
    if (reduceMotion || !document.startViewTransition) {
      update();
      return;
    }
    if (className) root.classList.add(className);
    const vt = document.startViewTransition(update);
    // A transition is skipped when another one starts (fast double clicks) — that's fine
    vt.ready.then(() => onReady && onReady()).catch(() => {});
    vt.updateCallbackDone.catch(() => {});
    vt.finished.catch(() => {}).finally(() => className && root.classList.remove(className));
  };

  /* ---------- Year ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ==========================================================
     Language (EN / EL)
     ========================================================== */
  const EL = window.I18N_EL || {};
  const EN = { ...(window.I18N_EN_EXTRA || {}) };

  // Capture the English text that is already in the HTML
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    EN[el.dataset.i18n] = el.innerHTML.trim();
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    EN[el.dataset.i18nAria] = el.getAttribute("aria-label");
  });
  const metaDesc = document.querySelector('meta[name="description"]');
  EN["meta.description"] = metaDesc ? metaDesc.content : "";

  let lang = root.getAttribute("lang") === "el" ? "el" : "en";
  const t = (key) => (lang === "el" ? EL[key] : EN[key]) ?? EN[key] ?? "";

  const applyLang = () => {
    root.setAttribute("lang", lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t(el.dataset.i18n);
      if (v) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const v = t(el.dataset.i18nAria);
      if (v) el.setAttribute("aria-label", v);
    });
    if (metaDesc) metaDesc.content = t("meta.description");
    document.querySelectorAll(".lang-switch button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    updateThemeLabel();
    updateMenuLabel();
    if (typeof refreshLightboxCaption === "function") refreshLightboxCaption();
    requestAnimationFrame(() => moveIndicator(activeLink));
  };

  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.lang === lang) return;
      lang = btn.dataset.lang;
      store.set("lang", lang);
      withTransition(applyLang, { className: "vt-fade" });
    });
  });

  /* ==========================================================
     Theme (light / dark, follows the system until chosen)
     ========================================================== */
  const themeBtn = document.querySelector(".theme-toggle");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const currentTheme = () => root.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");

  function updateThemeLabel() {
    if (!themeBtn) return;
    themeBtn.setAttribute("aria-label", t(currentTheme() === "dark" ? "theme.toLight" : "theme.toDark"));
  }

  themeBtn?.addEventListener("click", (e) => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    store.set("theme", next);

    // Circular reveal that grows from the button
    const r = themeBtn.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    withTransition(
      () => {
        root.setAttribute("data-theme", next);
        updateThemeLabel();
      },
      {
        onReady: () => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
          );
        },
      }
    );
  });
  systemDark.addEventListener?.("change", updateThemeLabel);

  /* ==========================================================
     Header, mobile menu, active-section indicator
     ========================================================== */
  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const menuBtn = document.querySelector(".menu-toggle");
  function updateMenuLabel() {
    if (!menuBtn) return;
    const open = menuBtn.getAttribute("aria-expanded") === "true";
    menuBtn.setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
  }
  const setMenu = (open) => {
    header.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    updateMenuLabel();
  };
  menuBtn?.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  document.querySelectorAll(".nav__links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("menu-open")) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (header.classList.contains("menu-open") && !header.contains(e.target)) setMenu(false);
  });

  const nav = document.querySelector(".nav");
  const indicator = document.querySelector(".nav__indicator");
  const links = [...document.querySelectorAll(".nav__links a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  let activeLink = null;

  function moveIndicator(link) {
    if (!indicator) return;
    if (!link || getComputedStyle(indicator).display === "none") {
      indicator.style.opacity = "0";
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const box = link.getBoundingClientRect();
    const pad = 12;
    indicator.style.width = `${box.width - pad * 2}px`;
    indicator.style.transform = `translateX(${box.left - navBox.left + pad}px)`;
    indicator.style.opacity = "1";
  }

  const setActive = (link) => {
    if (link === activeLink) return;
    activeLink = link;
    links.forEach((a) => a.classList.toggle("is-active", a === link));
    moveIndicator(link);
  };

  const updateActive = () => {
    const mid = window.innerHeight * 0.4;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= mid) current = s;
    // At the very bottom the last section wins
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
    setActive(current ? links[sections.indexOf(current)] : null);
  };
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateActive(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", () => moveIndicator(activeLink));
  updateActive();

  /* ==========================================================
     Typed Kotlin snippet
     ========================================================== */
  const tokens = [
    ["k", "data class "], ["t", "Developer"], ["", "(\n"],
    ["", "    "], ["k", "val "], ["p", "name"], ["", ": "], ["t", "String"], ["", ",\n"],
    ["", "    "], ["k", "val "], ["p", "base"], ["", ": "], ["t", "String"], ["", ",\n"],
    ["", "    "], ["k", "val "], ["p", "stack"], ["", ": "], ["t", "List"], ["", "<"], ["t", "String"], ["", ">,\n"],
    ["", ")\n\n"],
    ["k", "val "], ["p", "me"], ["", " = "], ["t", "Developer"], ["", "(\n"],
    ["", "    name  = "], ["s", "\"Konstantinos Chrousis\""], ["", ",\n"],
    ["", "    base  = "], ["s", "\"Heraklion, Crete\""], ["", ",\n"],
    ["", "    stack = "], ["t", "listOf"], ["", "(\n"],
    ["", "        "], ["s", "\"Kotlin\""], ["", ", "], ["s", "\"C\""], ["", ", "], ["s", "\"C++\""], ["", ",\n"],
    ["", "        "], ["s", "\"Lua\""], ["", ", "], ["s", "\"Java\""], ["", ", "], ["s", "\"Python\""], ["", ",\n"],
    ["", "    ),\n"],
    ["", ")"],
  ];
  const codeEl = document.getElementById("code");
  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const flat = tokens.map(([, text]) => text).join("");
  const renderCode = (count) => {
    let html = "";
    let left = count;
    for (const [cls, text] of tokens) {
      if (left <= 0) break;
      const part = escapeHtml(text.slice(0, left));
      left -= text.length;
      html += cls ? `<span class="${cls}">${part}</span>` : part;
    }
    return html;
  };
  if (codeEl) {
    if (reduceMotion) {
      codeEl.innerHTML = renderCode(flat.length);
    } else {
      let i = 0;
      const step = () => {
        const ch = flat[i];
        i += 1;
        codeEl.innerHTML = renderCode(i);
        if (i < flat.length) setTimeout(step, ch === "\n" ? 90 : ch === " " ? 8 : 18 + Math.random() * 22);
      };
      setTimeout(step, 900);
    }
  }

  /* ==========================================================
     Scroll reveal with sibling stagger
     ========================================================== */
  const reveals = [...document.querySelectorAll(".reveal")];
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.filter((e) => e.isIntersecting).forEach((entry, idx) => {
          entry.target.style.setProperty("--rd", `${idx * 0.09}s`);
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach((el) => revealObserver.observe(el));
  }

  /* ==========================================================
     Gentle 3D tilt on project images
     ========================================================== */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!reduceMotion && finePointer) {
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      const host = card.parentElement;
      let frame = null;
      host.addEventListener("pointermove", (e) => {
        const r = host.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          card.style.transition = "transform 0.25s ease-out, box-shadow 0.7s";
          card.style.transform = `rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 4}deg) translateZ(0)`;
          card.style.setProperty("--gx", `${x * 100}%`);
          card.style.setProperty("--gy", `${y * 100}%`);
        });
      });
      host.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.style.transition = "";
        card.style.transform = "";
      });
    });
  }

  /* ==========================================================
     Screenshot gallery
     ========================================================== */
  const track = document.querySelector(".gallery__track");
  const prevBtn = document.querySelector('[data-gallery="prev"]');
  const nextBtn = document.querySelector('[data-gallery="next"]');
  const shots = [...document.querySelectorAll(".shot")];

  if (track) {
    const pageSize = () => track.clientWidth * 0.8;
    const updateArrows = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prevBtn.disabled = track.scrollLeft <= 2;
      nextBtn.disabled = track.scrollLeft >= max;
    };
    prevBtn.addEventListener("click", () => track.scrollBy({ left: -pageSize() }));
    nextBtn.addEventListener("click", () => track.scrollBy({ left: pageSize() }));
    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    updateArrows();

    // Drag to scroll with a mouse, with a little momentum
    if (finePointer) {
      let startX = 0, startLeft = 0, lastX = 0, lastT = 0, velocity = 0, moved = false, down = false;
      track.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        down = true; moved = false;
        startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); velocity = 0;
      });
      window.addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add("is-dragging"); }
        if (!moved) return;
        track.scrollLeft = startLeft - dx;
        const now = performance.now();
        velocity = (e.clientX - lastX) / Math.max(1, now - lastT);
        lastX = e.clientX; lastT = now;
      });
      window.addEventListener("pointerup", () => {
        if (!down) return;
        down = false;
        if (!moved) return;
        track.classList.remove("is-dragging");
        if (!reduceMotion) track.scrollBy({ left: -velocity * 220 });
        // swallow the click that follows a drag
        track.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      });
    }
  }

  /* ---------- Lightbox ---------- */
  const lb = document.querySelector(".lightbox");
  const lbImg = lb?.querySelector(".lightbox__img");
  const lbText = lb?.querySelector(".lightbox__text");
  const lbCount = lb?.querySelector(".lightbox__count");
  let lbIndex = 0;

  function refreshLightboxCaption() {
    if (!lb || !lb.open) return;
    const cap = shots[lbIndex].querySelector(".shot__cap").textContent;
    lbText.textContent = cap;
    lbCount.textContent = `${lbIndex + 1} / ${shots.length}`;
    lbImg.alt = cap;
  }

  const showShot = (i, dir = 0) => {
    lbIndex = (i + shots.length) % shots.length;
    const src = shots[lbIndex].querySelector("img").getAttribute("src");
    if (dir && !reduceMotion) {
      lbImg.style.setProperty("--swap-x", `${dir * -24}px`);
      lbImg.classList.add("is-swapping");
      setTimeout(() => {
        lbImg.src = src;
        refreshLightboxCaption();
        lbImg.style.setProperty("--swap-x", `${dir * 24}px`);
        requestAnimationFrame(() => requestAnimationFrame(() => lbImg.classList.remove("is-swapping")));
      }, 200);
    } else {
      lbImg.src = src;
      refreshLightboxCaption();
    }
  };

  const closeLightbox = () => {
    lb.classList.remove("is-open");
    setTimeout(() => lb.close(), reduceMotion ? 0 : 300);
  };

  if (lb && shots.length) {
    shots.forEach((shot, i) => {
      shot.addEventListener("click", () => {
        lb.showModal();
        showShot(i);
        requestAnimationFrame(() => lb.classList.add("is-open"));
      });
    });
    lb.querySelector(".lightbox__close").addEventListener("click", closeLightbox);
    lb.querySelector(".lightbox__prev").addEventListener("click", () => showShot(lbIndex - 1, -1));
    lb.querySelector(".lightbox__next").addEventListener("click", () => showShot(lbIndex + 1, 1));
    lb.addEventListener("click", (e) => {
      if (e.target === lb || e.target.classList.contains("lightbox__inner")) closeLightbox();
    });
    lb.addEventListener("cancel", (e) => { e.preventDefault(); closeLightbox(); });
    lb.addEventListener("close", () => shots[lbIndex]?.focus());
    lb.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") showShot(lbIndex - 1, -1);
      if (e.key === "ArrowRight") showShot(lbIndex + 1, 1);
    });
    // Swipe on touch screens
    let touchX = null;
    lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) showShot(lbIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      touchX = null;
    });
  }

  /* ---------- Apply language once everything is wired ---------- */
  applyLang();

  /* ---------- Analytics ---------- */
  if (GOATCOUNTER_CODE && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
    document.body.appendChild(s);
  }
})();
