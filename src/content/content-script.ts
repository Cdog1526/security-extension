async function shouldRun(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["enabled", "allowlist"], (res: any) => {
      const enabled = res.enabled !== false;
      const allowlist = res.allowlist || [];
      const host = location.hostname;

      if (!enabled) return resolve(false);
      if (allowlist.includes(host)) return resolve(false);

      resolve(true);
    });
  });
}

async function getRuntimeURLResource(path: string): Promise<string> {
  const url = chrome.runtime.getURL(path);
  const res = await fetch(url);
  return await res.text();
}

function injectCss(cssText: string, id?: string) {
  try {
    // avoid injecting duplicate styles
    if (id && document.getElementById(id)) return;
    const style = document.createElement("style");
    if (id) style.id = id;
    style.textContent = cssText;
    // insert before anything else for maximum effect
    const root = document.documentElement || document.head || document.body;
    root.prepend(style);
  } catch (e) {
    console.error("injectCss error", e);
  }
}

// Convert an array of selectors into a CSS block that hides them
function selectorsToCss(selectors: string[]): string {
  // join selectors into one rule, using !important to override page rules
  // we guard against empty selectors
  const safe = selectors.filter(s => s && s.trim().length);
  if (safe.length === 0) return "";
  // make sure each selector is safe-ish (simple filtering)
  return `${safe.join(", ")} { display: none !important; visibility: hidden !important; }`;
}

async function main() {
    if (!(await shouldRun())) return;
    try {
        // 1) Inject global CSS (applies to all pages)
        const globalCss = await getRuntimeURLResource("css_rules/hide_global.css");
        if (globalCss && globalCss.trim()) {
        injectCss(globalCss, "adblock-hide-global");
        }

        const jsonText = await getRuntimeURLResource("css_rules/hide_domain.json");
        const map = JSON.parse(jsonText || "{}") as Record<string, string[]>;

        const hostname = location.hostname || window.location.host || "";
        const candidates: string[] = [];

        // exact host first
        if (map[hostname]) candidates.push(...map[hostname]);

        // try progressively stripping subdomains (example: a.b.c.com -> b.c.com -> c.com)
        const parts = hostname.split(".");
        for (let i = 1; i < parts.length - 1; i++) {
        const domain = parts.slice(i).join(".");
        if (map[domain]) candidates.push(...map[domain]);
        }

        // try wildcard/global selectors keyed by "*"
        if (map["*"]) candidates.push(...map["*"]);

        // 4) Inject domain-specific CSS if any
        if (candidates.length > 0) {
        const css = selectorsToCss(Array.from(new Set(candidates))); // dedupe
        if (css) injectCss(css, "adblock-hide-domain");
        }
    } catch (err) {
        console.error("content script error", err);
    }
  
  
}

main();