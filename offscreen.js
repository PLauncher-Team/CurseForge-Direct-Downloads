chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CF_FETCH_AND_CREATE_URL") return;
  (async () => {
    const url = new URL(message.downloadUrl);
    if (!url.hostname.endsWith(".forgecdn.net")) throw new Error("Blocked an unexpected download host.");
    const response = await fetch(url.href, { headers: { "x-api-key": message.apiKey } });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("ForgeCDN rejected the API key (HTTP " + response.status + ").");
      throw new Error("ForgeCDN error: HTTP " + response.status);
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error("CDN returned an empty file.");
    const objectUrl = URL.createObjectURL(blob);
    sendResponse({ ok: true, objectUrl });
  })().catch(error => sendResponse({ error: error.message || String(error) }));
  return true;
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "CF_REVOKE_OBJECT_URL" && message.objectUrl) URL.revokeObjectURL(message.objectUrl);
});
