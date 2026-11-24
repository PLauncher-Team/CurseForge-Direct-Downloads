const API = "https://api.curseforge.com/v1";
const GAME_ID_MINECRAFT = 432;
const DEFAULT_SETTINGS = {
  apiKey: "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm",
  directDownloadsEnabled: true,
  confirmBeforeDownload: false,
  askWhereToSave: false,
  downloadSubfolder: "",
  cacheProjectIds: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) missing[key] = value;
  }
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CF_DIRECT_DOWNLOAD") {
    handleDownload(message).then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (message?.type === "CF_TEST_API_KEY") {
    testApiKey(message.apiKey).then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message || String(error) }));
    return true;
  }
});

async function apiGet(path, key) {
  const response = await fetch(API + path, {
    headers: {
      "x-api-key": key,
      "Accept": "application/json"
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("CurseForge rejected the API key (HTTP " + response.status + "). Check the key and API access.");
    throw new Error("CurseForge API error: HTTP " + response.status);
  }
  if (body.data === undefined) throw new Error("CurseForge API returned an unexpected response.");
  return body.data;
}

async function testApiKey(value) {
  const key = String(value || "").trim();
  if (!key) throw new Error("Enter an API key first.");
  await apiGet("/games/" + GAME_ID_MINECRAFT, key);
  return { ok: true, message: "API key is valid." };
}

async function handleDownload({ slug, fileId }) {
  if (!Number.isSafeInteger(fileId) || fileId <= 0 || !slug) throw new Error("Could not read the CurseForge download link.");
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const key = String(settings.apiKey || "").trim();
  if (!key) throw new Error("Add a CurseForge API key in the extension settings.");

  const cacheKey = "modId:" + slug;
  let modId;
  if (settings.cacheProjectIds) {
    const cached = await chrome.storage.local.get(cacheKey);
    modId = cached[cacheKey];
  }
  if (!modId) {
    const search = await apiGet("/mods/search?gameId=" + GAME_ID_MINECRAFT + "&slug=" + encodeURIComponent(slug), key);
    const mod = Array.isArray(search) ? search.find(item => item.slug === slug) || search[0] : null;
    if (!mod?.id) throw new Error("Could not find the CurseForge project: " + slug);
    modId = mod.id;
    if (settings.cacheProjectIds) await chrome.storage.local.set({ [cacheKey]: modId });
  }

  const file = await apiGet("/mods/" + modId + "/files/" + fileId, key);
  if (file.modId && Number(file.modId) !== Number(modId)) throw new Error("The file ID does not match the selected project. Download cancelled.");
  if (file.isAvailable === false) throw new Error("This file is no longer available on CurseForge.");

  let downloadUrl = file.downloadUrl;
  if (!downloadUrl) {
    const urlData = await apiGet("/mods/" + modId + "/files/" + fileId + "/download-url", key);
    downloadUrl = typeof urlData === "string" ? urlData : urlData?.url;
  }
  if (!downloadUrl) throw new Error("CurseForge did not provide a direct download URL for this file.");

  const parsed = new URL(downloadUrl);
  if (!parsed.hostname.endsWith(".forgecdn.net")) throw new Error("The API returned an unexpected download host: " + parsed.hostname);

  const sourceFilename = file.fileName || decodeURIComponent(parsed.pathname.split("/").pop() || "curseforge-file");
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({
    type: "CF_FETCH_AND_CREATE_URL",
    downloadUrl,
    apiKey: key,
    filename: sourceFilename
  });
  if (!result?.ok) throw new Error(result?.error || "Could not retrieve the file from ForgeCDN.");

  const filename = buildDownloadFilename(settings.downloadSubfolder, sourceFilename);
  try {
    await chrome.downloads.download({
      url: result.objectUrl,
      filename,
      saveAs: Boolean(settings.askWhereToSave)
    });
  } finally {
    setTimeout(() => chrome.runtime.sendMessage({
      type: "CF_REVOKE_OBJECT_URL",
      objectUrl: result.objectUrl
    }).catch(() => {}), 120000);
  }
}

function sanitizeFilename(name) {
  return String(name || "curseforge-file").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 240);
}

function buildDownloadFilename(folder, filename) {
  const safeName = sanitizeFilename(filename);
  const safeFolder = String(folder || "").split(/[\\/]+/)
    .map(part => part.replace(/[<>:"|?*\x00-\x1F]/g, "_").replace(/^\.+|\.+$/g, "").trim())
    .filter(Boolean)
    .join("/");
  return safeFolder ? safeFolder + "/" + safeName : safeName;
}

let offscreenReady;
async function ensureOffscreen() {
  if (offscreenReady) return offscreenReady;
  offscreenReady = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL("offscreen.html")]
    });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "Fetch the authenticated CurseForge file and create a temporary Blob URL for Chrome Downloads."
      });
    }
  })();
  try {
    await offscreenReady;
  } catch (error) {
    offscreenReady = null;
    throw error;
  }
}
