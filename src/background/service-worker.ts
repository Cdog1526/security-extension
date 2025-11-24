// import { fetchBlockList } from "./fetchBlockList";
// import { parseBlock } from "./parseBlock";

// console.log("Service worker initialized");

// async function updateBlocklist() {
//     try {
//         // Get existing rules to remove
//         const existingRules = await new Promise<chrome.declarativeNetRequest.Rule[]>(resolve => {
//             chrome.declarativeNetRequest.getDynamicRules(resolve);
//         });
        
//         const removeRuleIds = existingRules.map(rule => rule.id);
//         console.log(`Removing ${removeRuleIds.length} existing rules`);

//         // Fetch and parse new rules
//         const blocklistText = await fetchBlockList();
//         const newRules = parseBlock(blocklistText);
        
//         // Update rules
//         await new Promise<void>((resolve, reject) => {
//             chrome.declarativeNetRequest.updateDynamicRules(
//                 {
//                     removeRuleIds,
//                     addRules: newRules
//                 },
//                 () => {
//                     if (chrome.runtime.lastError) {
//                         console.error("Error updating rules:", chrome.runtime.lastError.message);
//                         reject(chrome.runtime.lastError);
//                     } else {
//                         console.log(`Successfully updated ${newRules.length} rules`);
//                         resolve();
//                     }
//                 }
//             );
//         });

//     } catch (error) {
//         console.error("Failed to update blocklist:", error);
//     }
// }

// // Run on service worker startup
// updateBlocklist();