const ANON_ID_KEY = "traivel_anon_id";

export function getAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
