(() => {
  const DOWNLOAD_RE = /^\/minecraft\/mc-mods\/([^/]+)\/download\/(\d+)\/?$/;
  let settings = {
    directDownloadsEnabled: true,
    confirmBeforeDownload: false
  };

  chrome.storage.local.get(settings).then(value => {
    settings = { ...settings, ...value };
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.directDownloadsEnabled) settings.directDownloadsEnabled = changes.directDownloadsEnabled.newValue !== false;
    if (changes.confirmBeforeDownload) settings.confirmBeforeDownload = changes.confirmBeforeDownload.newValue === true;
  });

  document.addEventListener("click", event => {
    if (!settings.directDownloadsEnabled || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    const match = url.pathname.match(DOWNLOAD_RE);
    if (!match) return;
    if (settings.confirmBeforeDownload && !confirm("Download this file directly from CurseForge?")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    chrome.runtime.sendMessage({
      type: "CF_DIRECT_DOWNLOAD",
      slug: match[1],
      fileId: Number(match[2])
    }).then(result => {
      if (result?.error) alert("CurseForge Direct Downloads: " + result.error);
    }).catch(error => alert("CurseForge Direct Downloads: " + (error?.message || "Could not start the download.")));
  }, true);
})();
