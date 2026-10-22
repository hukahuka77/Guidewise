import { fontFaceCss } from "./fonts";
import { icon } from "./icons";
import type { GuideModel } from "./model";
import { THEMES, themeVars, type ThemeKey } from "./themes";
import type { NormalizedItem } from "../recommendations";

export type PageSize = "letter" | "a4";

export interface GuideRender {
  html: string;
  /**
   * Pairs of texts that must land on the same PDF page (a heading and its first card, a card's title and
   * its last line). Used by the layout tests to catch orphaned headings and split cards.
   */
  keepTogether: [string, string][];
  /** Section titles in order. */
  sections: string[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Text for a CSS `content: "..."` string. */
const cssString = (s: string) => s.replace(/[\\"]/g, "\\$&").replace(/[\r\n]+/g, " ").slice(0, 80);

/** URL for CSS `url('...')`: only http(s)/data images, with characters that could end the url encoded. */
function cssUrl(u: string): string {
  if (!/^(https?:|data:image\/)/i.test(u)) return "";
  return u.replace(/[\x00-\x1f\\'"() ]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

const paras = (text: string) =>
  text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");

/** First ~24 characters of a line, for matching against extracted PDF text. */
const probe = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 24);
const lastProbe = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.slice(Math.max(0, t.length - 18));
};

const PAGE_DIMENSIONS: Record<PageSize, { css: string; height: string }> = {
  letter: { css: "Letter", height: "11in" },
  a4: { css: "A4", height: "297mm" },
};

function css(theme: ThemeKey, size: PageSize, title: string): string {
  const pageColor = THEMES[theme].vars["--page"];
  const { css: pageCss, height } = PAGE_DIMENSIONS[size];
  const footerFont = '8pt Inter, Arial, sans-serif';
  return `
${fontFaceCss()}
:root{${themeVars(theme)};--page-h:${height};--pad:0.8in}
@page{size:${pageCss};margin:0.85in 0.8in 0.95in;background:${pageColor};
  @bottom-left{content:"${cssString(title)}";font:${footerFont};color:#8a8178;vertical-align:top;padding-top:0.3in}
  @bottom-right{content:counter(page);font:${footerFont};color:#8a8178;vertical-align:top;padding-top:0.3in}}
@page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
*{box-sizing:border-box}
html{background:var(--page);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font:10pt/1.55 var(--body-font);color:var(--ink);orphans:3;widows:3}
p{margin:0 0 6pt}
.ico{flex:none;vertical-align:-3px}
h1,h2,h3{font-family:var(--head-font);font-weight:var(--head-weight);margin:0;color:var(--ink)}

/* cover */
.cover{position:relative;height:calc(var(--page-h) - 0.03in);break-after:page;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:1in var(--pad) 1.1in;color:#fff;background-color:var(--accent);background-size:cover;background-position:center}
.cover::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.25) 45%,rgba(0,0,0,.78) 100%)}
.cover>*{position:relative}
.cover .kicker{font-size:9pt;letter-spacing:.28em;text-transform:uppercase;opacity:.9;margin-bottom:10pt}
.cover h1{font-size:40pt;line-height:1.1;color:#fff;margin-bottom:10pt;max-width:6.2in}
.cover .where{font-size:13pt;opacity:.95}
.cover .host{margin-top:22pt;padding-top:12pt;border-top:1px solid rgba(255,255,255,.45);font-size:10pt;opacity:.95;max-width:4in}

/* contents */
.toc{break-after:page;padding-top:.2in}
.toc h2{font-size:26pt;margin-bottom:6pt}
.toc .lead{color:var(--muted);margin-bottom:22pt}
.toc ol{list-style:none;margin:0;padding:0}
.toc li{display:flex;align-items:center;gap:12pt;padding:11pt 0;border-bottom:1px solid var(--line);font-size:12pt}
.toc .num{font-family:var(--head-font);color:var(--accent);width:24pt;font-size:12pt}
.toc .ti{color:var(--accent)}

/* sections */
.sec{margin:0 0 26pt}
.sec.new-page{break-before:page}
.sec-head{display:flex;align-items:center;gap:10pt;margin-bottom:12pt;padding-bottom:8pt;border-bottom:2px solid var(--accent);break-after:avoid}
.sec-head .badge{display:inline-flex;align-items:center;justify-content:center;width:26pt;height:26pt;border-radius:50%;background:var(--accent);color:var(--on-accent)}
.sec-head h2{font-size:20pt;line-height:1.15}
.stack>*+*{margin-top:10pt}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10pt}
.span2{grid-column:span 2}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:11pt 13pt;break-inside:avoid}
.card .label{display:flex;align-items:center;gap:5pt;font-size:7.5pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:4pt}
.card .label .ico{color:var(--accent)}
.card .value{font-size:11.5pt;font-weight:600;white-space:pre-line;overflow-wrap:anywhere}
.card .value.plain{font-weight:400;font-size:10pt}
.card h3{font-size:12pt;margin-bottom:3pt}
.card p:last-child{margin-bottom:0}
.prose p{color:var(--ink)}
.prose.lead p{font-size:11.5pt;line-height:1.65}
.host-card{display:flex;gap:12pt;align-items:flex-start}
.host-card .avatar{flex:none;width:34pt;height:34pt;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center}
.host-card .who{font-weight:600;font-size:11pt}
.qr{display:flex;gap:12pt;align-items:center}
.qr img{width:1in;height:1in;flex:none}
.rule,.step{display:flex;gap:9pt;align-items:flex-start;padding:9pt 0;border-bottom:1px solid var(--line);break-inside:avoid}
.rule:last-child,.step:last-child{border-bottom:0}
.rule .ico,.step .ico{color:var(--accent);margin-top:2px}
.rule .t,.step .t{font-weight:600}
.rule .d,.step .d{color:var(--muted);white-space:pre-line}
.list{padding:2pt 13pt}
.places{display:grid;grid-template-columns:1fr 1fr;gap:12pt}
.place{break-inside:avoid;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
.place .ph{height:1.3in;background-color:var(--accent-soft);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:var(--accent)}
.place .body{padding:10pt 12pt 12pt}
.place h3{font-size:12pt;margin-bottom:3pt}
.place .meta{display:flex;align-items:center;gap:5pt;font-size:8.5pt;color:var(--muted);margin-bottom:5pt}
.place .meta .ico{color:var(--accent)}
.place .desc{font-size:9.5pt;white-space:pre-line}
.closing{margin-top:8pt;text-align:center;padding:16pt;border-radius:var(--radius);background:var(--accent-soft);break-inside:avoid}
.closing .big{font-family:var(--head-font);font-size:15pt;margin-bottom:3pt}
.closing .small{color:var(--muted);font-size:9.5pt}
`;
}

function infoCard(label: string, ico: string, value: string, span = false): string {
  return `<div class="card${span ? " span2" : ""}"><div class="label">${icon(ico, 11)}${esc(label)}</div><div class="value">${esc(value)}</div></div>`;
}

function placeCard(p: NormalizedItem, ico: string): string {
  const bg = p.image_url ? cssUrl(p.image_url) : "";
  const meta: string[] = [];
  if (p.address) meta.push(`${icon("pin", 11)}<span>${esc(p.address)}</span>`);
  if (p.driving_minutes) meta.push(`${icon("car", 11)}<span>${esc(String(p.driving_minutes))} min drive</span>`);
  // A background image (not <img>) so a photo that fails to load leaves the soft banner instead of a broken-image box
  return `<article class="place"><div class="ph"${bg ? ` style="background-image:url('${bg}')"` : ""}>${icon(ico, 26)}</div><div class="body"><h3>${esc(p.name)}</h3>${
    meta.length ? `<div class="meta">${meta.join("&nbsp;&nbsp;")}</div>` : ""
  }${p.description ? `<div class="desc">${esc(p.description)}</div>` : ""}</div></article>`;
}

function section(id: string, title: string, ico: string, body: string, newPage = false): string {
  return `<section class="sec${newPage ? " new-page" : ""}" id="${esc(id)}"><header class="sec-head"><span class="badge">${icon(ico, 14)}</span><h2>${esc(title)}</h2></header>${body}</section>`;
}

export function renderGuide(model: GuideModel, options: { theme: ThemeKey; pageSize?: PageSize }): GuideRender {
  const keep: [string, string][] = [];
  const titles: { title: string; ico: string }[] = [];
  const out: string[] = [];
  const has = (tab: string) => model.tabs.includes(tab);

  // ---- Welcome (+ host)
  if (has("welcome") && (model.welcome || model.host.name || model.qrSrc)) {
    const body: string[] = [];
    if (model.welcome) body.push(`<div class="prose lead">${paras(model.welcome)}</div>`);
    const stack: string[] = [];
    if (model.host.name || model.host.bio || model.host.contact) {
      stack.push(
        `<div class="card host-card"><div class="avatar">${icon("user", 18)}</div><div><div class="who">${
          model.host.name ? `Your host, ${esc(model.host.name)}` : "Your host"
        }</div>${model.host.bio ? `<p>${esc(model.host.bio)}</p>` : ""}${
          model.host.contact ? `<p>${icon("phone", 11)} ${esc(model.host.contact)}</p>` : ""
        }</div></div>`,
      );
    }
    if (model.qrSrc) {
      stack.push(
        `<div class="card qr"><img src="${esc(model.qrSrc)}" alt="QR code"><div><div class="who">Open the digital guidebook</div><p>Scan with your phone for the always up-to-date version.</p></div></div>`,
      );
    }
    if (stack.length) body.push(`<div class="stack" style="margin-top:14pt">${stack.join("")}</div>`);
    out.push(section("welcome", "Welcome", "home", body.join("")));
    titles.push({ title: "Welcome", ico: "home" });
    if (model.welcome) keep.push(["Welcome", probe(model.welcome.split(/\n+/)[0])]);
    else if (model.host.name) keep.push(["Welcome", probe(`Your host, ${model.host.name}`)]);
  }

  // ---- Arrival
  if (has("checkin")) {
    const cards: string[] = [];
    const exp: string[] = [];
    const add = (label: string, ico: string, value: string, span = false, probeText?: string) => {
      cards.push(infoCard(label, ico, value, span));
      if (probeText) exp.push(probeText);
    };
    if (model.checkIn) add("Check-in", "clock", model.checkIn, false, "CHECK-IN");
    if (model.checkOut) add("Check-out", "clock", model.checkOut);
    if (model.addressLines.length) add("Address", "pin", model.addressLines.join("\n"), true, "ADDRESS");
    if (model.access) add("Getting in", "key", model.access, true, "GETTING IN");
    if (model.parking) add("Parking", "car", model.parking, true, "PARKING");
    if (model.wifi?.network) add("Wi-Fi network", "wifi", model.wifi.network, false, "WI-FI NETWORK");
    if (model.wifi?.password) add("Wi-Fi password", "key", model.wifi.password, false, "WI-FI PASSWORD");
    if (model.emergencyContact) cards.push(infoCard("Emergency contact", "phone", model.emergencyContact, !model.fireExtinguisher));
    if (model.fireExtinguisher) cards.push(infoCard("Fire extinguisher", "shield", model.fireExtinguisher, !model.emergencyContact));
    if (cards.length) {
      out.push(section("arrival", "Arriving & Getting Settled", "door", `<div class="grid2">${cards.join("")}</div>`));
      titles.push({ title: "Arriving & Getting Settled", ico: "door" });
      keep.push(["Arriving & Getting Settled", exp[0] ?? "ADDRESS"]);
      if (model.wifi?.network && model.wifi?.password) keep.push(["WI-FI NETWORK", "WI-FI PASSWORD"]);
    }
  }

  // ---- House guide
  if (has("property") && model.manual.length) {
    const cards = model.manual
      .map((m) => `<div class="card">${m.name ? `<h3>${esc(m.name)}</h3>` : ""}${m.description ? paras(m.description) : ""}</div>`)
      .join("");
    out.push(section("manual", "House Guide", "book", `<div class="stack">${cards}</div>`));
    titles.push({ title: "House Guide", ico: "book" });
    keep.push(["House Guide", probe(model.manual[0].name || model.manual[0].description)]);
    for (const m of model.manual) if (m.name && m.description) keep.push([probe(m.name), lastProbe(m.description)]);
  }

  // ---- Rules
  if (has("rules") && model.rules.length) {
    const rows = model.rules
      .map(
        (r) =>
          `<div class="rule">${icon("check", 15)}<div>${r.name ? `<div class="t">${esc(r.name)}</div>` : ""}${
            r.description ? `<div class="d">${esc(r.description)}</div>` : ""
          }</div></div>`,
      )
      .join("");
    out.push(section("rules", "House Rules", "shield", `<div class="card list">${rows}</div>`));
    titles.push({ title: "House Rules", ico: "shield" });
    keep.push(["House Rules", probe(model.rules[0].name || model.rules[0].description)]);
  }

  // ---- Places
  const placesSection = (id: string, title: string, ico: string, items: NormalizedItem[]) => {
    out.push(section(id, title, ico, `<div class="places">${items.map((p) => placeCard(p, ico)).join("")}</div>`));
    titles.push({ title, ico });
    keep.push([title, probe(items[0].name)]);
    for (const p of items) if (p.description) keep.push([probe(p.name), lastProbe(p.description)]);
  };
  if (has("food") && model.eat.length) placesSection("eat", "Places to Eat", "utensils", model.eat);
  if (has("activities") && model.todo.length) placesSection("do", "Things to Do", "compass", model.todo);

  // ---- Custom tabs
  for (const c of model.custom) {
    out.push(section(c.key, c.title, "sparkles", `<div class="prose">${c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`));
    titles.push({ title: c.title, ico: "sparkles" });
    keep.push([c.title, probe(c.paragraphs[0])]);
  }

  // ---- Checkout
  if (has("checkout") && (model.checkout.length || model.checkOut)) {
    const parts: string[] = [];
    if (model.checkOut) parts.push(`<div class="grid2" style="margin-bottom:10pt">${infoCard("Check-out time", "clock", model.checkOut, true)}</div>`);
    if (model.checkout.length) {
      parts.push(
        `<div class="card list">${model.checkout
          .map(
            (s) =>
              `<div class="step">${icon("check", 15)}<div>${s.name ? `<div class="t">${esc(s.name)}</div>` : ""}${
                s.description ? `<div class="d">${esc(s.description)}</div>` : ""
              }</div></div>`,
          )
          .join("")}</div>`,
      );
    }
    parts.push(`<div class="closing"><div class="big">Thank you for staying with us!</div><div class="small">We hope you had a wonderful visit.</div></div>`);
    out.push(section("checkout", "Checkout", "door", parts.join("")));
    titles.push({ title: "Checkout", ico: "door" });
    keep.push(["Checkout", model.checkOut ? "CHECK-OUT TIME" : probe(model.checkout[0].name || model.checkout[0].description)]);
  }

  // A guidebook with nothing filled in yet still gets a real page instead of a blank one
  if (out.length === 0) {
    out.push(
      section(
        "welcome",
        "Welcome",
        "home",
        `<div class="prose lead"><p>Welcome to ${esc(model.title)}! We hope you have a wonderful stay.</p></div>`,
      ),
    );
    titles.push({ title: "Welcome", ico: "home" });
  }

  // ---- Cover and contents
  const coverStyle = model.coverUrl && cssUrl(model.coverUrl) ? ` style="background-image:url('${cssUrl(model.coverUrl)}')"` : "";
  const cover = `<section class="cover"${coverStyle}><div class="kicker">Guest Guide</div><h1>${esc(model.title)}</h1>${
    model.city ? `<div class="where">${esc(model.city)}</div>` : ""
  }${model.host.name ? `<div class="host">Welcome! Your host is ${esc(model.host.name)}.</div>` : ""}</section>`;

  const toc =
    titles.length > 3
      ? `<section class="toc"><h2>Contents</h2><div class="lead">Everything you need for your stay.</div><ol>${titles
          .map((t, i) => `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="ti">${icon(t.ico, 16)}</span><span>${esc(t.title)}</span></li>`)
          .join("")}</ol></section>`
      : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(model.title)}</title><style>${css(
    options.theme,
    options.pageSize ?? "letter",
    model.title,
  )}</style></head><body>${cover}${toc}<main>${out.join("")}</main></body></html>`;

  return { html, keepTogether: keep, sections: titles.map((t) => t.title) };
}
