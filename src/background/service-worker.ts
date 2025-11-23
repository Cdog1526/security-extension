console.log("SERVICE WORKER LOADED");

chrome.declarativeNetRequest.updateDynamicRules(
  {
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "example.com/ads/",
          resourceTypes: ["script", "image", "sub_frame"]
        }
      }
    ]
  },
  () => {
    if (chrome.runtime.lastError) {
      console.error("DNR error:", chrome.runtime.lastError.message);
    } else {
      console.log("Rules installed!");
    }
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        console.log("Updated dynamic rules:", rules);
      });
  }
);