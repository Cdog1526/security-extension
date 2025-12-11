document.addEventListener("DOMContentLoaded", async () => {
  console.log("popup.ts loaded");
  
  // Get DOM elements
  const toggle = document.getElementById("toggle") as HTMLInputElement;
  const toggle_site = document.getElementById("toggle-site") as HTMLInputElement;
  const toggle_js = document.getElementById("toggle-js") as HTMLInputElement;
  const toggleLogsButton = document.getElementById('toggle-logs');
  const logContainer = document.getElementById('log-container');
  const logContent = document.getElementById('log-content');
  const clearLogsButton = document.getElementById('clear-logs');
  
  // Security analysis elements
  const securityScore = document.getElementById('security-score');
  const securityTags = document.getElementById('security-tags');
  const securityStatus = document.getElementById('security-status');
  const dismissAlertButton = document.getElementById('dismiss-alert');

  // Load initial states
  chrome.storage.local.get(["enabled", "js_enabled"], result => {
    toggle.checked = result.enabled !== false;
    toggle_js.checked = result.js_enabled !== false;
    console.log("Popup loaded with states:", result);
  });

  // Get current tab info and update UI
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (currentTab) {
    const url = new URL(currentTab.url || "");
    const hostname = url.hostname;
    
    // Update site allowlist toggle
    chrome.storage.local.get("allowlist", (res: { allowlist?: string[] }) => {
      toggle_site.checked = res.allowlist?.includes(hostname) || false;
    });
    
    // Perform security analysis
    await performSecurityAnalysis(currentTab);
  }

  // Event listeners
  toggle.addEventListener("change", (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    updateStatusIndicator(enabled);
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

    chrome.tabs.reload();
  });

  toggle_js.addEventListener("change", async () => {
    chrome.runtime.sendMessage({
      type: "toggle-js",
      js_enabled: !toggle_js.checked
    });

    chrome.tabs.reload();
  });

  // Logs functionality
  if (toggleLogsButton && logContainer) {
    toggleLogsButton.addEventListener('click', async () => {
      logContainer.classList.toggle('hidden');
      toggleLogsButton.textContent = logContainer.classList.contains('hidden') 
        ? 'Show Block Logs' 
        : 'Hide Block Logs';
      
      if (!logContainer.classList.contains('hidden')) {
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
            ? logs.map(log => `<div class="log-entry">${formatLogEntry(log)}</div>`).join('\n')
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

  // Dismiss alert functionality
  dismissAlertButton?.addEventListener('click', () => {
    const alertPanel = document.getElementById('alert-panel') as HTMLElement;
    if (alertPanel) {
      alertPanel.classList.add('hidden');
    }
  });
});

async function performSecurityAnalysis(tab: chrome.tabs.Tab) {
  console.log("[popup] Starting security analysis for tab:", tab.url);
  
  try {
    // Get CSP meta tag from content script with retry logic
    let cspMeta = null;
    let retries = 3;
    
    while (retries > 0) {
      try {
        console.log(`[popup] Attempting to get CSP meta tag, retries left: ${retries}`);
        const response = await chrome.tabs.sendMessage(tab.id!, { action: "get_csp_meta" });
        cspMeta = response?.cspMeta;
        console.log("[popup] Got CSP meta tag:", cspMeta);
        break;
      } catch (error) {
        console.log(`[popup] Failed to get CSP meta tag, retrying... (${retries} retries left)`);
        retries--;
        if (retries > 0) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log("[popup] Could not get CSP meta tag from content script, proceeding without it");
          cspMeta = null;
        }
      }
    }
    
    // Create fingerprint
    const fingerprint = {
      hostname: new URL(tab.url!).hostname,
      cspMeta: cspMeta,
      hasCSPHeader: null,
      documentTitle: tab.title || '',
      locationHref: tab.url || ''
    };
    
    console.log("[popup] Sending fingerprint to service worker:", fingerprint);
    
    // Send to service worker for analysis
    const analysisResult = await chrome.runtime.sendMessage({ 
      action: "analyze_page", 
      fingerprint 
    });
    
    console.log("[popup] Received analysis result:", analysisResult);
    
    // Update UI with results
    updateSecurityUI(analysisResult);
    
  } catch (error) {
    console.error("[popup] Error performing security analysis:", error);
    updateSecurityUI({ error: "Failed to analyze security" });
  }
}

function updateStatusIndicator(enabled: boolean) {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  if (enabled) {
    statusIndicator?.classList.remove('bg-red-500');
    statusIndicator?.classList.add('bg-green-500');
    if (statusText) statusText.textContent = 'Enabled';
  } else {
    statusIndicator?.classList.remove('bg-green-500');
    statusIndicator?.classList.add('bg-red-500');
    if (statusText) statusText.textContent = 'Disabled';
  }
}

function updateSecurityUI(result: any) {
  const securityScore = document.getElementById('security-score');
  const securityTags = document.getElementById('security-tags');
  const securityStatus = document.getElementById('security-status');
  const alertPanel = document.getElementById('alert-panel');
  const alertScore = document.getElementById('alert-score');
  const alertTags = document.getElementById('alert-tags');
  
  if (result.error) {
    // Show error state
    if (securityScore) securityScore.textContent = 'Error';
    if (securityTags) securityTags.textContent = result.error;
    if (securityStatus) securityStatus.textContent = 'Analysis Failed';
    return;
  }
  
  if (result.result === "allowlisted") {
    // Show allowlisted state
    if (securityScore) securityScore.textContent = 'N/A';
    if (securityTags) securityTags.textContent = 'Domain is allowlisted';
    if (securityStatus) securityStatus.textContent = 'Allowlisted';
    return;
  }
  
  const score = result.score || 0;
  const tags = result.reasonTags || [];
  
  // Update main security display
  if (securityScore) securityScore.textContent = score.toString();
  if (securityTags) securityTags.textContent = tags.join(', ') || 'No issues detected';
  if (securityStatus) {
    if (score >= 50) {
      securityStatus.textContent = 'High Risk';
      securityStatus.className = 'security-status high-risk';
    } else if (score >= 20) {
      securityStatus.textContent = 'Medium Risk';
      securityStatus.className = 'security-status medium-risk';
    } else {
      securityStatus.textContent = 'Low Risk';
      securityStatus.className = 'security-status low-risk';
    }
  }
  
  // Show alert panel if high risk
  if (score >= 50 && alertPanel && alertScore && alertTags) {
    alertScore.textContent = score.toString();
    alertTags.textContent = tags.join(', ');
    alertPanel.classList.remove('hidden');
  }
}