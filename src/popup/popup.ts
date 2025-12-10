document.addEventListener("DOMContentLoaded", () => {
  console.log("popup.ts:");
  const toggle = document.getElementById("toggle") as HTMLInputElement;
  const toggle_site = document.getElementById("toggle-site") as HTMLInputElement;
  const toggleLogsButton = document.getElementById('toggle-logs');
  const logContainer = document.getElementById('log-container');
  const logContent = document.getElementById('log-content');
  const clearLogsButton = document.getElementById('clear-logs');
  // Load initial state
  chrome.storage.local.get("enabled", result => {
    toggle.checked = result.enabled !== false;
    console.log("Popup loaded with state:", result.enabled);
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = new URL(tabs[0].url || "");
      const hostname = url.hostname;

      chrome.storage.local.get("allowlist", (res: { allowlist?: string[] }) => {
          toggle_site.checked = res.allowlist?.includes(hostname) || false;
      });
  });

  // Add event listener
  toggle.addEventListener("change", (e) => {
    console.log("checkmark change");
    const enabled = (e.target as HTMLInputElement).checked;
    chrome.runtime.sendMessage({ action: "toggle", enabled });
  });

  toggle.addEventListener("change", (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (enabled) {
        statusIndicator?.classList.remove('bg-red-500');
        statusIndicator?.classList.add('bg-green-500');
        statusText!.textContent = 'Enabled';
    } else {
        statusIndicator?.classList.remove('bg-green-500');
        statusIndicator?.classList.add('bg-red-500');
        statusText!.textContent = 'Disabled';
    }
    
    chrome.runtime.sendMessage({ action: "toggle", enabled });
});

toggle_site.addEventListener("change", async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const hostname = new URL(tabs[0].url!).hostname;

      chrome.runtime.sendMessage({
          type: "toggle-allowlist",
          hostname,
          enabled: !toggle_site.checked
      });

      // reload page so content script re-evaluates
      chrome.tabs.reload();
  });

  if (toggleLogsButton && logContainer) {
        toggleLogsButton.addEventListener('click', async () => {
            logContainer.classList.toggle('hidden');
            toggleLogsButton.textContent = logContainer.classList.contains('hidden') 
                ? 'Show Block Logs' 
                : 'Hide Block Logs';
            
            if (!logContainer.classList.contains('hidden')) {
                // Load logs when showing the container
                const result = await chrome.storage.local.get('block_logs') as { block_logs?: any[] };
                const logs = result.block_logs || [];
                if (logContent) {
                    const formatLogEntry = (log: any): string => {
                        try {
                            const url = new URL(log.request?.url || '');
                            const domain = url.hostname.replace(/^www\./, '');
                            const initiator = log.request?.initiator || 'unknown';
                            const type = log.request?.type || 'unknown';
                            return `${domain}\n  From: ${initiator}\n  Type: ${type}`;
                        } catch (e) {
                            return 'Invalid log entry';
                        }
                    };

                    logContent.innerHTML = logs.length > 0 
                        ? logs.map(log => 
                            `<div class="log-entry">${formatLogEntry(log)}</div>`
                          ).join('\n')
                        : 'No block logs available';
                }
            }
        });
    }
    
    clearLogsButton?.addEventListener('click', async () => {
        chrome.storage.local.set({ block_logs: [] });
        if (logContent) {
            logContent.innerHTML = 'No block logs available';
        }
    });
});