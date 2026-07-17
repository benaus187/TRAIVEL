import re
import time
from datetime import datetime, timezone, timedelta
import httpx

_SPONSORED_RE = re.compile(r'\b#?(ad|sponsored|gifted|collab|partner)\b', re.IGNORECASE)
_UA = "TRAIVEL/1.0 (mailto:benhuynh1807@gmail.com; portfolio travel app)"
_TRAVEL_KW = {
    "travel", "trip", "visit", "food", "restaurant", "hotel", "tourism", "tourist",
    "vacation", "holiday", "culture", "museum", "cuisine", "explore", "guide",
    "sightseeing", "itinerary", "cafe", "bar", "street", "market", "temple",
    "neighbourhood", "neighborhood", "district", "architecture", "ferry",
}


def _is_travel_relevant(title: str, city: str) -> bool:
    low = title.lower()
    if city.lower() not in low:
        return False
    return any(kw in low for kw in _TRAVEL_KW)


async def _fetch_hackernews(destination: str) -> list[dict]:
    city = destination.split(",")[0].strip()
    cutoff = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://hn.algolia.com/api/v1/search",
                params={
                    "query": city,
                    "tags": "story",
                    "numericFilters": f"created_at_i>{cutoff},points>2",
                    "hitsPerPage": 25,
                },
                headers={"User-Agent": _UA},
            )
            r.raise_for_status()
            hits = r.json().get("hits", [])
    except Exception:
        return []

    results = []
    for hit in hits:
        title = hit.get("title", "")
        if not title or _SPONSORED_RE.search(title):
            continue
        if not _is_travel_relevant(title, city):
            continue

        age_hours = (time.time() - (hit.get("created_at_i") or 0)) / 3600
        recency = max(0.05, 1.0 / (1 + age_hours / 48))
        points = hit.get("points") or 0
        comments = hit.get("num_comments") or 0
        score = (points + comments * 2) * recency

        if score < 0.5:
            continue

        results.append({
            "text": title[:280],
            "score": round(score, 1),
            "upvotes": points,
            "comments": comments,
            "source": "hackernews",
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)[:5]


async def _fetch_wikipedia_spike(destination: str) -> dict | None:
    city = destination.split(",")[0].strip().replace(" ", "_")
    today = datetime.now(timezone.utc)
    # Wikipedia has ~2 day data lag — use day-2 as end to avoid 404
    end = (today - timedelta(days=2)).strftime("%Y%m%d")
    start = (today - timedelta(days=37)).strftime("%Y%m%d")

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
                f"/en.wikipedia/all-access/all-agents/{city}/daily/{start}/{end}",
                headers={"User-Agent": _UA},
            )
            r.raise_for_status()
            items = r.json().get("items", [])
    except Exception:
        return None

    if len(items) < 14:
        return None

    recent = [x["views"] for x in items[-7:]]
    prior = [x["views"] for x in items[:-7]]
    prior_avg = sum(prior) / len(prior) if prior else 0

    if prior_avg == 0:
        return None

    recent_avg = sum(recent) / len(recent)
    spike = recent_avg / prior_avg

    # Show spike signal if unusual activity, OR show popularity if destination is well-known
    if spike >= 1.1:
        label = f"{city.replace('_', ' ')} is trending — {round(spike, 1)}× more Wikipedia views than usual this week"
    elif recent_avg >= 2000:
        label = f"{city.replace('_', ' ')} — {int(recent_avg):,} avg daily Wikipedia views (high-interest destination)"
    else:
        return None

    return {
        "text": label,
        "score": round(max(spike, 1.0) * recent_avg / 500, 1),
        "upvotes": int(recent_avg),
        "comments": 0,
        "source": "wikipedia",
    }


async def fetch_trends(destination: str) -> list[dict]:
    hn = await _fetch_hackernews(destination)
    wiki = await _fetch_wikipedia_spike(destination)

    results = list(hn)
    if wiki:
        results.append(wiki)

    return results
