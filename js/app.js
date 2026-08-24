/* ==========================================================================
   app.js — namespace, helpers, chrome (header/footer), atmosphere, boot
   Loaded first on every page.
   ========================================================================== */

window.WIDM = window.WIDM || {};

(function (WIDM) {
  "use strict";

  /* ------------------------------------------------------------------------
     Small DOM + formatting helpers
     ------------------------------------------------------------------------ */
  const util = {
    $(selector, scope) {
      return (scope || document).querySelector(selector);
    },

    $$(selector, scope) {
      return Array.from((scope || document).querySelectorAll(selector));
    },

    /** Escape user/admin supplied text before it goes into innerHTML. */
    esc(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    /** € 1.240 — Dutch grouping, no decimals. */
    money(amount) {
      const number = Number(amount) || 0;
      return "€ " + number.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
    },

    /** 3:24 */
    duration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      const minutes = Math.floor(total / 60);
      return minutes + ":" + String(total % 60).padStart(2, "0");
    },

    /** 17 aug 2026, 21:19 */
    dateTime(iso) {
      if (!iso) return "—";
      const date = new Date(iso);
      if (isNaN(date)) return "—";
      return date.toLocaleString("nl-NL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    /** 15 aug 2026 */
    dateShort(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (isNaN(date)) return String(value);
      return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    },

    /** 01, 02, 03 … for leaderboard positions. */
    pad2(number) {
      return String(number).padStart(2, "0");
    },

    initials(name) {
      const parts = String(name || "").trim().split(/\s+/);
      if (!parts[0]) return "??";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    slug(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    },

    clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    },

    /** Render an HTML string into a container. */
    fill(target, html) {
      const node = typeof target === "string" ? util.$(target) : target;
      if (node) node.innerHTML = html;
      return node;
    },

    prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
  };

  /* ------------------------------------------------------------------------
     Inline SVG icons — no icon framework, no network requests
     ------------------------------------------------------------------------ */
  const paths = {
    crest:
      '<path d="M12 2 4 6v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6l-8-4Z" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '<path d="M12 7.5 13.3 11h3.5l-2.8 2.1 1 3.4-3-2.1-3 2.1 1-3.4L7.2 11h3.5L12 7.5Z" fill="currentColor" opacity=".9"/>',
    eye:
      '<path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12Z" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    file:
      '<path d="M6 2.8h7.5L19 8.4v12.8H6V2.8Z" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M13.2 3v5.6H19" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    chart:
      '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    crown:
      '<path d="M3 18h18l-1.6-9.6-4.2 3.6L12 5l-3.2 7L4.6 8.4 3 18Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    lock:
      '<rect x="4.5" y="10.4" width="15" height="10.2" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    alert:
      '<path d="M12 3.4 22 20H2L12 3.4Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M12 9.6v4.6M12 17.1h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    key:
      '<circle cx="8" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M12.2 12H21m-3 0v3m-3-3v2.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    check: '<path d="M4.5 12.6 9.4 17.5 19.5 7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    arrowLeft: '<path d="M19 12H5m0 0 6-6m-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    arrowRight: '<path d="M5 12h14m0 0-6-6m6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    download: '<path d="M12 3.5v11m0 0 4.2-4.2M12 14.5l-4.2-4.2M4 18.5v2h16v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    upload: '<path d="M12 20.5v-11m0 0L7.8 13.7M12 9.5l4.2 4.2M4 5.5v-2h16v2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    burger: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4.2h5v2.3M6.5 6.5 7.6 20h8.8l1.1-13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M15.5 5.5h-11v11" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    pen: '<path d="m4 20 1-4L16.6 4.4a2 2 0 0 1 2.8 2.8L8 18.8 4 20Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    feather: '<path d="M19.5 4.5c-8 0-13 4.5-13 11v3l-2.5 2.5M6.5 18.5 20 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  };

  /**
   * icon('eye', 'btn__icon') -> '<svg class="btn__icon" …>'
   */
  function icon(name, className) {
    const body = paths[name] || "";
    return (
      '<svg class="' + (className || "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      body +
      "</svg>"
    );
  }

  /* ------------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------------ */
  function toast(message, variant) {
    let host = util.$(".toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "toasts";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const node = document.createElement("div");
    node.className = "toast" + (variant === "error" ? " toast--error" : "");
    node.textContent = message;
    host.appendChild(node);
    setTimeout(function () {
      node.classList.add("toast--leaving");
      setTimeout(function () {
        node.remove();
      }, 320);
    }, 3600);
  }

  /* ------------------------------------------------------------------------
     Atmosphere — background layers + drifting dust
     ------------------------------------------------------------------------ */
  function mountAtmosphere() {
    if (util.$(".atmos")) return;
    const layer = document.createElement("div");
    layer.className = "atmos";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML =
      '<div class="atmos__moon"></div>' +
      '<div class="atmos__fog atmos__fog--a"></div>' +
      '<div class="atmos__fog atmos__fog--b"></div>' +
      '<canvas class="atmos__dust" id="dust"></canvas>' +
      '<div class="atmos__treeline">' + skyline() + "</div>" +
      '<div class="atmos__vignette"></div>' +
      '<div class="atmos__grain"></div>';
    document.body.prepend(layer);
    startDust();
  }

  /**
   * The silhouette on the horizon: a distant castle behind a pine treeline.
   * Generated rather than drawn by hand so the project ships without image
   * assets. The offsets come from a fixed formula, so it never "flickers"
   * between page loads.
   */
  function skyline() {
    const width = 1200;
    const base = 220;

    // Castle: keep, two towers, spires and a pennant.
    const castle =
      "M520 220 L520 150 L534 150 L534 138 L548 138 L548 150 L562 150 L562 120 " +
      "L556 120 L570 96 L584 120 L578 120 L578 150 L622 150 L622 108 L614 108 " +
      "L630 78 L646 108 L638 108 L638 150 L676 150 L676 126 L670 126 L684 102 " +
      "L698 126 L692 126 L692 150 L706 150 L706 220 Z";
    const pennant = "M630 78 L630 62 L660 68 L630 74 Z";

    // Treeline: overlapping conifers marching across the horizon.
    let trees = "";
    let x = -30;
    let index = 0;
    while (x < width + 30) {
      const height = 54 + ((index * 37) % 78);
      const spread = 30 + ((index * 17) % 26);
      trees +=
        "M" + x.toFixed(0) + " " + base +
        " L" + (x + spread / 2).toFixed(0) + " " + (base - height).toFixed(0) +
        " L" + (x + spread).toFixed(0) + " " + base + " Z ";
      x += spread * 0.62;
      index += 1;
    }

    return (
      '<svg class="atmos__silhouette" viewBox="0 0 ' + width + " " + base + '" ' +
      'preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<path class="atmos__castle" d="' + castle + '"/>' +
      '<path class="atmos__pennant" d="' + pennant + '"/>' +
      '<path class="atmos__trees" d="' + trees.trim() + '"/>' +
      "</svg>"
    );
  }

  /**
   * Slow-drifting motes of golden dust. Deliberately sparse: this runs on
   * phones in a queue at Efteling, not on a gaming rig.
   */
  function startDust() {
    const canvas = document.getElementById("dust");
    if (!canvas || util.prefersReducedMotion()) return;

    const context = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let motes = [];
    let frame = null;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = width < 700 ? 22 : 46;
      motes = Array.from({ length: count }, function () {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.6 + 0.4,
          drift: (Math.random() - 0.5) * 0.12,
          rise: -(Math.random() * 0.16 + 0.04),
          alpha: Math.random() * 0.4 + 0.12,
          phase: Math.random() * Math.PI * 2,
        };
      });
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      for (const mote of motes) {
        mote.x += mote.drift + Math.sin(time / 3600 + mote.phase) * 0.14;
        mote.y += mote.rise;
        if (mote.y < -8) {
          mote.y = height + 8;
          mote.x = Math.random() * width;
        }
        if (mote.x < -8) mote.x = width + 8;
        if (mote.x > width + 8) mote.x = -8;

        const twinkle = 0.65 + 0.35 * Math.sin(time / 900 + mote.phase);
        context.beginPath();
        context.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
        context.fillStyle = "rgba(226, 194, 104, " + (mote.alpha * twinkle).toFixed(3) + ")";
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    // Stop burning battery while the page is hidden.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
      } else if (!frame) {
        frame = requestAnimationFrame(draw);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Header & footer
     ------------------------------------------------------------------------ */
  const PLAYER_NAV = [
    { href: "dashboard.html", label: "Dossier" },
    { href: "test.html", label: "De Test" },
    { href: "archief.html", label: "Archief" },
    { href: "results.html", label: "Antwoorden" },
    { href: "stats.html", label: "Statistieken" },
    { href: "leaderboard.html", label: "Het Bord" },
  ];

  const ADMIN_NAV = [
    { href: "admin.html", label: "Overzicht" },
    { href: "admin-questions.html", label: "Vragen" },
    { href: "admin-tests.html", label: "Tests" },
    { href: "admin-players.html", label: "Spelers" },
    { href: "admin-archief.html", label: "Enveloppen" },
    { href: "admin-executie.html", label: "Executie" },
    { href: "admin-game.html", label: "Spel" },
  ];

  function currentPage() {
    const path = window.location.pathname.split("/").pop();
    return path || "index.html";
  }

  /**
   * Renders the site header into <div id="site-header" data-nav="player|admin">.
   */
  function mountHeader(session) {
    const host = document.getElementById("site-header");
    if (!host) return;

    const kind = host.dataset.nav === "admin" ? "admin" : "player";
    const items = kind === "admin" ? ADMIN_NAV : PLAYER_NAV;
    const here = currentPage();

    const links = items
      .map(function (item) {
        const current = item.href === here ? ' aria-current="page"' : "";
        return '<a class="nav__link" href="' + item.href + '"' + current + ">" + util.esc(item.label) + "</a>";
      })
      .join("");

    const name = session ? session.name : "";
    const badge = kind === "admin"
      ? '<span class="chip chip--red">Spelleider</span>'
      : '<span class="avatar avatar--sm">' + util.esc(util.initials(name)) + "</span>";

    host.innerHTML =
      '<header class="site-header">' +
      '<div class="shell shell--wide site-header__inner">' +
      '<a class="brand" href="' + (kind === "admin" ? "admin.html" : "dashboard.html") + '">' +
      '<span class="seal seal--sm brand__mark"><img src="assets/logo.png" alt=""></span>' +
      '<span class="brand__text">' +
      '<span class="brand__title">Wie is Pardoes?</span>' +
      '<span class="brand__sub">Efteling</span>' +
      "</span></a>" +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu openen">' +
      icon("burger", "btn__icon") +
      "</button>" +
      '<nav class="nav" id="site-nav" aria-label="Hoofdnavigatie">' +
      links +
      '<span class="nav__user">' +
      badge +
      '<span class="nav__name">' + util.esc(name) + "</span>" +
      '<button class="btn btn--sm btn--ghost" type="button" data-action="logout">Uitloggen</button>' +
      "</span></nav>" +
      "</div></header>";

    setupNavToggle(host);

    const logout = host.querySelector('[data-action="logout"]');
    if (logout) {
      logout.addEventListener("click", function () {
        WIDM.auth.logout();
      });
    }
  }

  /** Collapsible nav below 900px; re-opens automatically on resize up. */
  function setupNavToggle(host) {
    const toggle = host.querySelector(".nav-toggle");
    const nav = host.querySelector(".nav");
    if (!toggle || !nav) return;

    const query = window.matchMedia("(max-width: 900px)");

    function apply() {
      if (query.matches) {
        nav.hidden = toggle.getAttribute("aria-expanded") !== "true";
      } else {
        nav.hidden = false;
      }
    }

    toggle.addEventListener("click", function () {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Menu openen" : "Menu sluiten");
      apply();
    });

    query.addEventListener("change", apply);
    apply();
  }

  function mountFooter() {
    const host = document.getElementById("site-footer");
    if (!host) return;
    const year = new Date().getFullYear();
    host.innerHTML =
      '<footer class="site-footer"><div class="shell shell--wide site-footer__inner">' +
      '<span>Wie is Pardoes? — Efteling editie · ' + year + "</span>" +
      '<span class="site-footer__motto">Vertrouw niemand.</span>' +
      "</div></footer>";
  }

  /* ------------------------------------------------------------------------
     Error & empty screens
     ------------------------------------------------------------------------ */
  function emptyState(title, text, iconName) {
    return (
      '<div class="empty">' +
      icon(iconName || "moon", "empty__glyph") +
      '<p class="empty__title">' + util.esc(title) + "</p>" +
      '<p class="empty__text">' + util.esc(text) + "</p>" +
      "</div>"
    );
  }

  function notice(title, text, variant) {
    const iconName = variant === "danger" ? "alert" : variant === "info" ? "eye" : "lock";
    return (
      '<div class="notice' + (variant ? " notice--" + variant : "") + '">' +
      icon(iconName, "notice__icon") +
      "<div><p class=\"notice__title\">" + util.esc(title) + "</p>" +
      '<p class="notice__text">' + util.esc(text) + "</p></div>" +
      "</div>"
    );
  }

  /** Full-page failure — almost always "the JSON could not be fetched". */
  function fatal(error) {
    const main = util.$("#main") || document.body;
    const isFileProtocol = window.location.protocol === "file:";
    main.innerHTML =
      '<div class="shell shell--narrow page">' +
      '<div class="card card--danger card--pad-lg">' +
      '<span class="eyebrow">Dossier onbereikbaar</span>' +
      "<h1 class=\"mt-2\">Het archief blijft gesloten</h1>" +
      '<p class="lede mt-3">De gegevens van het spel konden niet geladen worden.</p>' +
      (isFileProtocol
        ? '<p class="mt-3 muted">Je opent deze site rechtstreeks vanaf de schijf (<code>file://</code>). ' +
          "Browsers mogen dan geen JSON-bestanden inlezen. Start een lokale webserver of gebruik Docker — " +
          "zie de README.</p>"
        : '<p class="mt-3 muted">Controleer of de bestanden in <code>data/</code> aanwezig en geldig zijn.</p>') +
      '<p class="mt-3 faint" style="font-size:.85rem">' + util.esc(error && error.message ? error.message : String(error)) + "</p>" +
      '<div class="actionbar"><a class="btn" href="index.html">Terug naar de poort</a></div>' +
      "</div></div>";
    // eslint-disable-next-line no-console
    console.error("[WIDM]", error);
  }

  /* ------------------------------------------------------------------------
     De raaf
     ------------------------------------------------------------------------ */
  /**
   * Laat een raaf het bos in vliegen en roept daarna `done` aan. Gebruikt na
   * het inloggen: de pagina lost op, de vogel neemt je mee naar je dossier.
   *
   * Bij prefers-reduced-motion slaan we het hele tafereel over en gaan we
   * meteen door — anders zit iemand twee seconden naar een stilstaand beeld
   * te kijken.
   */
  function flyAway(done) {
    if (util.prefersReducedMotion()) {
      done();
      return;
    }

    const stage = document.createElement("div");
    stage.className = "raven-stage";
    stage.setAttribute("aria-hidden", "true");
    stage.innerHTML =
      '<svg class="raven" viewBox="0 0 200 120" fill="currentColor">' +
      // lijf en staart
      '<path d="M100 30c5 0 9 7 9 17l-3 34 6 26-12-7-12 7 6-26-3-34c0-10 4-17 9-17Z"/>' +
      // kop en snavel
      '<circle cx="100" cy="27" r="8"/>' +
      '<path d="M100 20 L118 24 L100 30 Z"/>' +
      // vleugels, samen in een groep zodat ze als een paar slaan
      '<g class="raven__wings">' +
      '<path d="M93 50C68 36 38 30 4 42c34 10 60 22 88 26Z"/>' +
      '<path d="M107 50c25-14 55-20 89-8-34 10-60 22-88 26Z"/>' +
      "</g></svg>" +
      '<p class="raven-stage__whisper">Ergens weet iemand meer dan jij.</p>';

    document.body.appendChild(stage);
    window.setTimeout(done, 1900);
  }

  /* ------------------------------------------------------------------------
     Page boot
     ------------------------------------------------------------------------ */
  /**
   * WIDM.page({ require: 'player' | 'admin' | null, run: async (ctx) => {} })
   *
   * Handles: DOM ready, atmosphere, data loading, auth guard, chrome, errors.
   */
  function page(options) {
    const config = options || {};

    function boot() {
      mountAtmosphere();

      let session = null;
      if (config.require) {
        session = WIDM.auth.guard(config.require);
        if (!session) return; // guard() already redirected
      } else {
        session = WIDM.auth.session();
      }

      mountHeader(session);
      mountFooter();

      WIDM.data
        .load()
        .then(function (db) {
          // Voor de opening komt niemand verder dan de voorpagina. Die pagina
          // toont zelf de aftelklok, dus die mag hier niet omgeleid worden.
          const here = currentPage();
          if (here !== "index.html" && here !== "404.html" && WIDM.game.isLocked()) {
            window.location.replace("index.html");
            return null;
          }
          return config.run ? config.run({ db: db, session: session }) : null;
        })
        .catch(fatal);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  /* ------------------------------------------------------------------------
     Exports
     ------------------------------------------------------------------------ */
  WIDM.util = util;
  WIDM.icon = icon;
  WIDM.toast = toast;
  WIDM.emptyState = emptyState;
  WIDM.notice = notice;
  WIDM.fatal = fatal;
  WIDM.page = page;
  WIDM.flyAway = flyAway;
  WIDM.mountAtmosphere = mountAtmosphere;
})(window.WIDM);
