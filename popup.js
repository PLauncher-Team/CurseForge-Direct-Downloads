const DEFAULT_SETTINGS = {
  apiKey: "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm",
  directDownloadsEnabled: true,
  confirmBeforeDownload: false,
  askWhereToSave: false,
  downloadSubfolder: "",
  cacheProjectIds: true
};

const fields = {
  apiKey: document.getElementById("apiKey"),
  directDownloadsEnabled: document.getElementById("directDownloadsEnabled"),
  confirmBeforeDownload: document.getElementById("confirmBeforeDownload"),
  askWhereToSave: document.getElementById("askWhereToSave"),
  downloadSubfolder: document.getElementById("downloadSubfolder"),
  cacheProjectIds: document.getElementById("cacheProjectIds")
};
const status = document.getElementById("status");

function showStatus(message, state = "") {
  status.textContent = message;
  status.dataset.state = state;
}

function readForm() {
  return {
    apiKey: fields.apiKey.value.trim(),
    directDownloadsEnabled: fields.directDownloadsEnabled.checked,
    confirmBeforeDownload: fields.confirmBeforeDownload.checked,
    askWhereToSave: fields.askWhereToSave.checked,
    downloadSubfolder: fields.downloadSubfolder.value.trim(),
    cacheProjectIds: fields.cacheProjectIds.checked
  };
}

function writeForm(settings) {
  fields.apiKey.value = settings.apiKey || "";
  fields.directDownloadsEnabled.checked = settings.directDownloadsEnabled !== false;
  fields.confirmBeforeDownload.checked = settings.confirmBeforeDownload === true;
  fields.askWhereToSave.checked = settings.askWhereToSave === true;
  fields.downloadSubfolder.value = settings.downloadSubfolder || "";
  fields.cacheProjectIds.checked = settings.cacheProjectIds !== false;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  writeForm(settings);
}

async function saveSettings() {
  const settings = readForm();
  if (!settings.apiKey) {
    showStatus("Enter a CurseForge API key before saving.", "error");
    fields.apiKey.focus();
    return false;
  }
  await chrome.storage.local.set(settings);
  showStatus("Settings saved.", "success");
  return true;
}

document.getElementById("save").addEventListener("click", saveSettings);

document.getElementById("test").addEventListener("click", async event => {
  const button = event.currentTarget;
  const apiKey = fields.apiKey.value.trim();
  if (!apiKey) {
    showStatus("Enter an API key to test.", "error");
    return;
  }
  button.disabled = true;
  showStatus("Checking API key…");
  try {
    const result = await chrome.runtime.sendMessage({ type: "CF_TEST_API_KEY", apiKey });
    if (result?.ok) showStatus(result.message || "API key is valid.", "success");
    else showStatus(result?.error || "API key test failed.", "error");
  } catch (error) {
    showStatus(error.message || "Could not test the API key.", "error");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("toggleKey").addEventListener("click", event => {
  const visible = fields.apiKey.type === "text";
  fields.apiKey.type = visible ? "password" : "text";
  event.currentTarget.textContent = visible ? "Show" : "Hide";
  event.currentTarget.setAttribute("aria-label", visible ? "Show API key" : "Hide API key");
});

document.getElementById("restore").addEventListener("click", async () => {
  writeForm(DEFAULT_SETTINGS);
  await chrome.storage.local.set(DEFAULT_SETTINGS);
  showStatus("Default settings restored.", "success");
});

document.getElementById("clearCache").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(key => key.startsWith("modId:"));
  if (keys.length) await chrome.storage.local.remove(keys);
  showStatus(keys.length ? "Project cache cleared." : "Project cache is already empty.", "success");
});

loadSettings().catch(error => showStatus(error.message || "Could not load settings.", "error"));
