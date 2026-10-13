/* ==========================================================================
   main.js — progressive enhancement only; the page is readable without JS.
   Modules: header, dropdowns, mobile nav, search, marquee, counters,
   carousel, consent demo, footer year.
   ========================================================================== */
(() => {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Sticky header: hide utility bar once the page scrolls ------------- */
  const header = $("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-condensed", scrollY > 80);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* --- Dropdowns / mega menus (click to open, Esc / outside to close) ---- */
  const closeAll = (except) => $$("[data-dropdown]").forEach((dd) => {
    if (dd === except) return;
    const btn = $("[data-dropdown-toggle]", dd);
    btn?.setAttribute("aria-expanded", "false");
    const panel = btn?.nextElementSibling;
    if (panel) panel.hidden = true;
  });
  $$("[data-dropdown]").forEach((dd) => {
    const btn = $("[data-dropdown-toggle]", dd);
    const panel = btn.nextElementSibling;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = btn.getAttribute("aria-expanded") === "true";
      closeAll(dd);
      btn.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-dropdown]")) closeAll(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeAll(); closeSearch(); } });

  /* --- Mobile nav ------------------------------------------------------- */
  const navToggle = $("[data-nav-toggle]");
  const nav = $("#primary-nav");
  navToggle?.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
    document.body.style.overflow = open ? "" : "hidden";
  });

  /* --- Search overlay --------------------------------------------------- */
  const search = $("[data-search]");
  function closeSearch() { if (search) search.hidden = true; }
  $("[data-search-open]")?.addEventListener("click", () => { search.hidden = false; $("input", search).focus(); });
  $("[data-search-close]")?.addEventListener("click", closeSearch);
  search?.addEventListener("click", (e) => { if (e.target === search) closeSearch(); });

  /* --- Logo marquee: duplicate the track so translateX(-50%) loops ------- */
  $$("[data-marquee] .marquee__track").forEach((track) => {
    $$("li", track).forEach((li) => {
      const clone = li.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.append(clone);
    });
  });

  /* --- Stat counters: animate the number in "1.2M+" / "300,000+" -------- */
  const animateStat = (el) => {
    const m = el.textContent.trim().match(/^([\d.,]+)(.*)$/);
    if (!m) return;
    const raw = m[1], suffix = m[2];
    const target = parseFloat(raw.replace(/,/g, ""));
    const decimals = (raw.split(".")[1] || "").length;
    const commas = raw.includes(",");
    const fmt = (v) => {
      const s = v.toFixed(decimals);
      return commas ? Number(s).toLocaleString("en-US") : s;
    };
    const t0 = performance.now(), dur = 1400;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { animateStat(en.target); io.unobserve(en.target); }
    }), { threshold: 0.6 });
    $$(".stat dd").forEach((dd) => io.observe(dd));
  }

  /* --- Persona carousel: tabs + prev/next + autoplay -------------------- */
  $$("[data-carousel]").forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    const interval = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--persona-dur")) * 1000 || 7000;
    let index = 0, timer = null;

    const show = (i, focus = false) => {
      index = (i + tabs.length) % tabs.length;
      tabs.forEach((t, n) => {
        const on = n === index;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        panels[n].hidden = !on;
      });
      // restart the CSS progress animation
      const bar = $(".carousel__bar", tabs[index]);
      bar.style.display = "none"; void bar.offsetWidth; bar.style.display = "";
      if (focus) tabs[index].focus();
      restart();
    };
    const restart = () => {
      clearInterval(timer);
      if (!reduceMotion && !root.classList.contains("is-paused")) timer = setInterval(() => show(index + 1), interval);
    };

    tabs.forEach((t, n) => {
      t.addEventListener("click", () => show(n));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") show(index + 1, true);
        if (e.key === "ArrowLeft")  show(index - 1, true);
      });
    });
    $("[data-prev]", root).addEventListener("click", () => show(index - 1));
    $("[data-next]", root).addEventListener("click", () => show(index + 1));
    root.addEventListener("mouseenter", () => { root.classList.add("is-paused"); clearInterval(timer); });
    root.addEventListener("mouseleave", () => { root.classList.remove("is-paused"); show(index); });
    if (reduceMotion) root.classList.add("is-static");
    restart();
  });

  /* --- Consent banner demo ----------------------------------------------
     Stand-in for a real CMP script. Real CMPs expose a JS API and fire
     events that tag managers listen to; see docs/ARCHITECTURE.md §5. */
  const KEY = "demo-consent";
  const banner = $("[data-consent]");
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } };
  if (banner && !read()) banner.hidden = false;
  $$("[data-consent-choice]").forEach((b) => b.addEventListener("click", () => {
    write(b.dataset.consentChoice);
    banner.hidden = true;
    window.dispatchEvent(new CustomEvent("consent:updated", { detail: { choice: b.dataset.consentChoice } }));
  }));
  $$("[data-consent-open]").forEach((b) => b.addEventListener("click", () => { banner.hidden = false; }));

  /* --- Footer year ------------------------------------------------------ */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
