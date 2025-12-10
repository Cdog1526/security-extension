const rulesetIds = ['ruleset_1', 'ruleset_2', 'ruleset_3', 'ruleset_4'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["enabled", "allowlist", "block_logs"], (res) => {
    const update: any = {};
    if (res.enabled === undefined) update.enabled = true;
    if (!Array.isArray(res.allowlist)) update.allowlist = [];
    if (!Array.isArray(res.block_logs)) update.block_logs = [];
    if (Object.keys(update).length > 0)
      chrome.storage.local.set(update);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "toggle-allowlist") {
        console.log("logging toggle")
        const hostname = message.hostname;

        chrome.storage.local.get("allowlist", (res: { allowlist?: string[] }) => {
            const list = new Set(res.allowlist || []);

            if (message.enabled === false) {
                list.add(hostname);
            } else {
                list.delete(hostname);
            }

            chrome.storage.local.set({ allowlist: [...list] });
            sendResponse({ ok: true });
        });
        reloadActiveTab();
        return true; // keep async
    }
    if (message.action === "toggle") {
        console.log("SW RECEIVED MESSAGE:", message);
        
        const updateRules = async () => {
            try {
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
            } catch (error) {
                console.error("Error updating rulesets:", error);
            }
        };
        updateRules();
        reloadActiveTab();
        return true; // Keep the message channel open for async response
    }
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