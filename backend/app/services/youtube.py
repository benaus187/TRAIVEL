import html
import re
from datetime import datetime, timezone, timedelta
import httpx
from ..config import settings

_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
_SPONSORED_RE = re.compile(r'\b#?(ad|sponsored|gifted|collab|partner)\b', re.IGNORECASE)


async def fetch_youtube_trending(destination: str) -> list[dict]:
    """Fetch recent, popular travel-guide videos for a destination to use as trend context."""
    if not settings.youtube_api_key:
        return []

    city = destination.split(",")[0].strip()
    published_after = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            search_r = await client.get(
                _SEARCH_URL,
                params={
                    "part": "snippet",
                    "q": f"{city} travel guide",
                    "type": "video",
                    "order": "viewCount",
                    "maxResults": 10,
                    "publishedAfter": published_after,
                    "safeSearch": "moderate",
                    "key": settings.youtube_api_key,
                },
            )
            search_r.raise_for_status()
            items = search_r.json().get("items", [])

            candidates = []
            for item in items:
                snippet = item.get("snippet", {})
                title = html.unescape(snippet.get("title", ""))
                video_id = item.get("id", {}).get("videoId")
                if not title or not video_id or _SPONSORED_RE.search(title):
                    continue
                candidates.append({
                    "video_id": video_id,
                    "title": title,
                    "channel": html.unescape(snippet.get("channelTitle", "")),
                })

            if not candidates:
                return []

            video_ids = ",".join(c["video_id"] for c in candidates)
            stats_r = await client.get(
                _VIDEOS_URL,
                params={"part": "statistics", "id": video_ids, "key": settings.youtube_api_key},
            )
            stats_r.raise_for_status()
            stats = {v["id"]: v.get("statistics", {}) for v in stats_r.json().get("items", [])}

            results = []
            for c in candidates:
                view_count = int(stats.get(c["video_id"], {}).get("viewCount") or 0)
                results.append({
                    "source": "youtube",
                    "title": c["title"],
                    "channel": c["channel"],
                    "view_count": view_count,
                    "video_id": c["video_id"],
                })
    except Exception:
        return []

    return sorted(results, key=lambda x: x["view_count"], reverse=True)[:5]
