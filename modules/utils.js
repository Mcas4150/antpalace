// simple fetch loader for text resources (e.g. GLSL)
export async function loadText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.statusText}`);
    return await res.text();
  }
  