// import type { Rule } from "./types";

// export function parseBlock(text: string): Rule[] {
//     const lines = text.split("\n");
//     const r: Rule[] = [];
//     var i: number = 0;
//     for (const line of lines) {
//         const trimmed = line.trim();

//         if (!trimmed || trimmed.startsWith("!") || trimmed.includes("##") || trimmed.startsWith("@@")) {
//             continue;
//         }

//         // Very primitive: only match "||domain^" syntax for now
//         const match = trimmed.match(/^\|\|(.+?)\^/);
//         if (!match) continue;

//         const domain = match[1];

//         r.push({
//             id: i++,
//             priority: 1,
//             action: { type: "block" },
//             condition: {
//                 urlFilter: domain,
//                 resourceTypes: ["script" as chrome.declarativeNetRequest.ResourceType, 
//                           "image" as chrome.declarativeNetRequest.ResourceType, 
//                           "sub_frame" as chrome.declarativeNetRequest.ResourceType, 
//                           "xmlhttprequest" as chrome.declarativeNetRequest.ResourceType, 
//                           "other" as chrome.declarativeNetRequest.ResourceType]
//             }
//         });
//     }
//     return r;

// }