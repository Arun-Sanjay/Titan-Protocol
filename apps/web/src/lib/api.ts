export async function apiGet(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_URL");
  }

  const url =
    path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${text}`.trim());
  }
  return res.json();
}

export async function getQuests() {
  const res = await fetch("http://localhost:8000/quests");
  return res.json();
}

export async function completeQuest(id: string) {
  await fetch(`http://localhost:8000/quests/${id}/complete`, {
    method: "POST",
  });
}
