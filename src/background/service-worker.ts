const rulesetIds = ['ruleset_1', 'ruleset_2', 'ruleset_3', 'ruleset_4'];

const GOOGLE_WEIGHT = 80; // Change to manage how we weight security score

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["enabled", "allowlist", "block_logs", "toggle_js", "security_settings_threshold", "security_allowlist", "security_cache_domainInfo"], (res: any) => {
    const update: any = {};
    if (res.enabled === undefined) update.enabled = true;
	if (res.js_enabled === undefined) update.js_enabled = false;
    if (!Array.isArray(res.allowlist)) update.allowlist = [];
    if (!Array.isArray(res.block_logs)) update.block_logs = [];
    if (res.security_settings_threshold === undefined) update["security_settings_threshold"] = 50;
    if (!res.security || !Array.isArray(res.security_allowlist)) update["security_allowlist"] = [];
    if (!res.security || !res.security.cache || !res.security_cache_domainInfo) update["security_cache_domainInfo"] = {};
    if (Object.keys(update).length > 0)
      chrome.storage.local.set(update);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[service-worker] Received message:", message, "from sender:", sender);
    
    const handleMessage = async () => {
        try {
            if (message.type === "toggle-allowlist") {
                console.log("logging toggle")
                const hostname = message.hostname;

                const res = await chrome.storage.local.get("allowlist");
                const list = new Set((res.allowlist as string[]) || []);

                if (message.enabled === false) {
                    list.add(hostname);
                } else {
                    list.delete(hostname);
                }

                await chrome.storage.local.set({ allowlist: [...list] });
                reloadActiveTab();
                sendResponse({ ok: true });
                return;
            }
            
            if (message.type === "toggle-js") {
                console.log("logging toggle")
                await chrome.storage.local.set({ js_enabled: message.js_enabled });
                reloadActiveTab();
                sendResponse({ ok: true });
                return;
            }
            
            if (message.action === "toggle") {
                console.log("SW RECEIVED MESSAGE:", message);
                
                // Save the new value first
                await chrome.storage.local.set({ enabled: message.enabled });
                
                // Update rulesets based on the new value
                if (message.enabled) {
                    console.log("Enabling rulesets:", rulesetIds);
                    await chrome.declarativeNetRequest.updateEnabledRulesets({
                        enableRulesetIds: rulesetIds,
                        disableRulesetIds: []
                    });
                } else {
                    console.log("Disabling rulesets:", rulesetIds);
                    await chrome.declarativeNetRequest.updateEnabledRulesets({
                        enableRulesetIds: [],
                        disableRulesetIds: rulesetIds
                    });
                }
                console.log("Ruleset update complete");
                
                // Verify the current state
                const enabledRulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
                console.log("Currently enabled rulesets:", enabledRulesets);
                
                // Reload the active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    await chrome.tabs.reload(tab.id);
                }
                
                sendResponse({ ok: true });
                return;
            }
            
            if (message.action === "analyze_page") {
                console.log("[service-worker] Received analyze_page request:", message);
                const fingerprint = message.fingerprint;
                const cleaned = fingerprint.hostname.replace(/^www\./, ''); 
                console.log("[service-worker] Processing hostname:", fingerprint.hostname, "cleaned:", cleaned);
                
                const allowlistRes = await chrome.storage.local.get("security_allowlist");
                const allowlist = allowlistRes.security_allowlist as string[];
                if (allowlist && allowlist.includes(cleaned)) {
                    sendResponse({ result: "allowlisted" });
                    return;
                }
                
                const res = await chrome.storage.local.get(["security_cache_domainInfo", "security_settings_threshold"]);
                const cache = (res.security_cache_domainInfo as Record<string, {score: number, reasonTags: string[], timestamp: number}>) || {};
                const threshold = res.security_settings_threshold as number || 50;
                console.log("[service-worker] Security threshold:", threshold);
                
                let score: number = 0;
                let reasonTags: string[] = [];
                
                if (cache.hasOwnProperty(cleaned)) {
                    console.log("[service-worker] Found cached result for:", cleaned);
                    score = cache[cleaned].score;
                    reasonTags = cache[cleaned].reasonTags;
                } else {
                    console.log("[service-worker] No cached result, analyzing CSP for:", cleaned);
                    // Compute score
                    [score, reasonTags] = await analyzeCSP(fingerprint.cspMeta, fingerprint.hostname);
                    console.log("[service-worker] Analysis complete - score:", score, "reasons:", reasonTags);
                    cache[cleaned] = {
                        score: score,
                        reasonTags: reasonTags,
                        timestamp: new Date().getTime()
                    };
                }
                
                if (score >= threshold) {
                    console.log("[service-worker] Score", score, "exceeds threshold", threshold, ", but alert will be shown in popup only");
                }
                
                await chrome.storage.local.set({ security: { cache: { domainInfo: cache } } });
                sendResponse({ score, reasonTags });
                return;
            }
            
            sendResponse({ error: "Unknown message type" });
        } catch (error) {
            console.error("Error handling message:", error);
            sendResponse({ error: (error as Error).message });
        }
    };
    
    handleMessage();
    return true; // Keep message channel open for async response
});

function reloadActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((ruleMatchedDebugEvent) => {
    chrome.storage.local.get("block_logs", (res: { block_logs?: {}[]; }) => {
        const block_logs = res.block_logs || [];
        block_logs.push(ruleMatchedDebugEvent);
        if (block_logs.length > 100) {
            block_logs.shift(); // remove oldest
        }
        chrome.storage.local.set({ block_logs });
    });
});

async function analyzeCSP(csp: string, url: string): Promise<[number, string[]]> {
    console.log("[service-worker] Analyzing CSP for URL:", url);
    console.log("[service-worker] CSP content:", csp);
    let score = 0;
	const tags: string[] = [];
    if(url.includes("example")){
        //console.log("[service-worker] Example URL detected, returning test score");
        //return [100, ["testing"]];
		score = 20;
		tags.push("example");
    }
    
    // Check if no CSP at all
    if (!csp || csp.trim() === '') {
        score += 50;
        tags.push('no-csp');
        return [score, tags];
    }
    
    // Parse CSP directives
    const directives = csp.split(';').map(d => d.trim().toLowerCase());
    
    // Check for unsafe-inline
    if (directives.some(d => d.includes('unsafe-inline'))) {
        score += 20;
        tags.push('unsafe-inline');
    }
    
    // Check for unsafe-eval
    if (directives.some(d => d.includes('unsafe-eval'))) {
        score += 30;
        tags.push('unsafe-eval');
    }
    
    // Check for wildcard script-src or default-src
    if (directives.some(d => {
        const parts = d.split(' ');
        const directive = parts[0];
        const sources = parts.slice(1);
        return (directive === 'script-src' || directive === 'default-src') && 
               sources.some(s => s === '*' || s.includes('*'));
    })) {
        score += 40;
        tags.push('wildcard-script-src');
    }
    
    // Check for trackers in connect-src
    const trackers = ['google-analytics', 'googletagmanager', 'facebook', 'twitter', 'doubleclick', 'googlesyndication'];
    if (directives.some(d => {
        const parts = d.split(' ');
        if (parts[0] !== 'connect-src') return false;
        return trackers.some(tracker => d.includes(tracker));
    })) {
        score += 15;
        tags.push('tracker-connections');
    }
    
    // Check for missing frame-ancestors 'none'
    const hasFrameAncestors = directives.some(d => d.startsWith('frame-ancestors'));
    const hasFrameAncestorsNone = directives.some(d => d.includes('frame-ancestors') && d.includes("'none'"));
    if (!hasFrameAncestors || !hasFrameAncestorsNone) {
        score += 10;
        tags.push('missing-anti-clickjacking');
    }

	if(score >= 10) {
		const [newScore, newTags] = await assessDomainReputation(url, url);
		score = (score * (1 - GOOGLE_WEIGHT)) + (newScore * GOOGLE_WEIGHT);
		tags.push(...newTags);
	}
    
    return [score, tags];
}

async function assessDomainReputation(url: string, hostname: string) : Promise<[number, string[]]>{
	try {
		const res = await fetch("https://safe-browsing-proxy.cdog1526-adblock.workers.dev", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Proxy-Secret":  "mysecret"
			},
			body: JSON.stringify({ url })
		});
		if (!res.ok) {
			console.error("Proxy returned error:", res.statusText);
			return [-1, []]; // fail open
		}

		const data = await res.json();
		console.log("Domain reputation data:", data);

		if (!data || !data.matches || data.matches.length === 0) {
			return [0, []];
		}

		// If there are matches, extract threat types
		const threats = data.matches.map((match: any) => match.threatType);
		let score = 0;
		for (const threat of threats) {
			switch (threat) {
				case "MALWARE":
					score += 50;
					break;
				case "SOCIAL_ENGINEERING":
					score += 40;
					break;
				case "UNWANTED_SOFTWARE":
					score += 30;
					break;
				case "THREAT":
					score += 20;
					break;
				default:
					score += 10;
					break;
			}
		}
		return [score, threats];
	} catch (err) {
		console.error("Error calling domain reputation proxy:", err);
		return [-1, []]; // fail open
	}
}