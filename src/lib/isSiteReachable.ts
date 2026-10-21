export const isSiteReachable = async (url: string, timeoutMs = 6000): Promise<boolean> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const response = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return response.ok;
  } catch (error) {
    return false;
  }
};
