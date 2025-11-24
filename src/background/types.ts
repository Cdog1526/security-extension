export interface Rule {
  id: number;
  priority: number;
  action: {
    type: "block";
  };
  condition: {
    urlFilter: string;
    resourceTypes?: chrome.declarativeNetRequest.ResourceType[];
    domains?: string[];
    excludedDomains?: string[];
  };
}