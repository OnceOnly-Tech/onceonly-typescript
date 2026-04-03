export function makeResponse(status, jsonData = undefined, headers = {}) {
  const bodyText =
    jsonData === undefined ? "" : typeof jsonData === "string" ? jsonData : JSON.stringify(jsonData);
  return {
    status,
    headers: {
      get(name) {
        const found = Object.entries(headers).find(([k]) => k.toLowerCase() === String(name).toLowerCase());
        return found ? found[1] : null;
      }
    },
    async text() {
      return bodyText;
    }
  };
}

export function makeFetchQueue(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    const next = responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    if (!next) {
      throw new Error("No queued response");
    }
    return next;
  };
  return { fetchImpl, calls };
}
