// This file is now minimal - security analysis moved to popup
// Keeping this file for potential future use but it's essentially empty

export interface PageFingerprint {
  hostname: string;
  cspMeta: string | null;
  hasCSPHeader: boolean | null;
  documentTitle: string;
  locationHref: string;
}

// Function to get CSP meta tag if needed by popup
function getCSPMetaTag(): string | null {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  return meta ? meta.getAttribute("content") : null;
}

// Listen for requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_csp_meta") {
    const cspMeta = getCSPMetaTag();
    sendResponse({ cspMeta });
  }
  return true;
});