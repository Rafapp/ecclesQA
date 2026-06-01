(() => {
  const REQUEST_MESSAGE = "wand:capture-next-window-open";
  const RESPONSE_MESSAGE = "wand:captured-window-open";

  if (window.__wandWindowOpenCaptureInstalled) {
    return;
  }

  window.__wandWindowOpenCaptureInstalled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== REQUEST_MESSAGE) {
      return;
    }

    const token = event.data.token;
    const originalOpen = window.open;
    let restored = false;

    const restore = () => {
      if (restored) {
        return;
      }

      window.open = originalOpen;
      restored = true;
    };

    const shouldCaptureUrl = (url) => {
      try {
        return /^https:\/\/[^/]+\.instructure\.com\//.test(new URL(String(url), window.location.href).href);
      } catch {
        return false;
      }
    };

    const postUrl = (url) => {
      if (!shouldCaptureUrl(url)) {
        return;
      }

      restore();
      window.postMessage({
        type: RESPONSE_MESSAGE,
        token,
        url: String(url ?? ""),
      }, "*");
    };

    window.open = function wandCaptureWindowOpen(url, target, features) {
      if (shouldCaptureUrl(url)) {
        postUrl(url);
        return null;
      }

      return originalOpen.call(window, url, target, features);
    };

    window.setTimeout(restore, 3000);
  });
})();
