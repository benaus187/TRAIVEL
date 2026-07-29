import urllib.parse

from .places import search_place


async def verify_stop(db, stop_id: str, name: str, destination: str) -> dict:
    """Verify a single stop via Google Places, update its `stops` row, and
    return the fields that changed. Shared by both the initial generation
    verification loop (itinerary.py) and the chat edit endpoint (chat.py)."""
    maps_q = urllib.parse.quote_plus(f"{name}, {destination}")
    booking_url = f"https://www.google.com/maps/search/?q={maps_q}"
    update: dict = {"booking_url": booking_url}
    verified = False
    place_id = None
    lat = None
    lon = None

    try:
        place = await search_place(name, destination)
    except Exception:
        place = None

    if place and place.get("place_id"):
        place_id = place["place_id"]
        verified = True
        lat = place.get("lat")
        lon = place.get("lon")
        update["place_id"] = place_id
        update["verified"] = True
        if lat is not None:
            update["lat"] = lat
        if lon is not None:
            update["lon"] = lon

    db.table("stops").update(update).eq("id", stop_id).execute()
    return {"verified": verified, "place_id": place_id, "booking_url": booking_url, "lat": lat, "lon": lon}


def _day_start_index(ordered: list[dict], day: int) -> int:
    for i, s in enumerate(ordered):
        if s.get("day", 1) >= day:
            return i
    return len(ordered)


def apply_operations(db, itinerary_id: str, stops: list[dict], raw_ops: list[dict]) -> list[dict]:
    """Applies add/remove/replace operations (as returned by the `update_itinerary`
    Claude tool) against the itinerary's stops, in-memory then to Supabase, and
    renumbers `position` only for rows whose slot actually shifted. Small itineraries
    (max ~14 days x 6 stops) make a full in-memory pass cheap and simple."""
    ordered = list(stops)
    applied: list[dict] = []

    for raw in raw_ops:
        op = raw.get("op")

        if op == "remove":
            stop_id = raw.get("stop_id")
            idx = next((i for i, s in enumerate(ordered) if s["id"] == stop_id), None)
            if idx is None:
                continue
            db.table("stops").delete().eq("id", stop_id).execute()
            ordered.pop(idx)
            applied.append({"op": "remove", "stop_id": stop_id})

        elif op == "replace":
            stop_id = raw.get("stop_id")
            idx = next((i for i, s in enumerate(ordered) if s["id"] == stop_id), None)
            if idx is None:
                continue
            existing = ordered[idx]
            day = raw.get("day", existing.get("day", 1))
            update = {
                "day": day,
                "time": raw.get("time", existing.get("time")),
                "name": raw.get("name", existing.get("name")),
                "description": raw.get("description", existing.get("description")),
                "reason_codes": raw.get("reason_codes", existing.get("reason_codes", [])),
                "transit_note": raw.get("transit_note", existing.get("transit_note")),
                "weather_alternate": raw.get("weather_alternate", existing.get("weather_alternate")),
                # It's effectively a new place — needs re-verification just like a
                # freshly-generated stop.
                "verified": False,
                "place_id": None,
                "lat": None,
                "lon": None,
                "booking_url": None,
            }
            db.table("stops").update(update).eq("id", stop_id).execute()
            new_stop = {**existing, **update}
            if day != existing.get("day", 1):
                ordered.pop(idx)
                ordered.insert(_day_start_index(ordered, day), new_stop)
            else:
                ordered[idx] = new_stop
            applied.append({"op": "replace", "stop_id": stop_id, "stop": new_stop})

        elif op == "add":
            day = raw.get("day", 1)
            after_stop_id = raw.get("after_stop_id")
            if after_stop_id:
                after_idx = next((i for i, s in enumerate(ordered) if s["id"] == after_stop_id), None)
                if after_idx is not None:
                    # Trust the anchor stop's own day, not the model's separately
                    # supplied `day` field — if the two ever disagree, inserting
                    # by anchor position while claiming a different `day` would
                    # break the day-sort invariant `_day_start_index` depends on.
                    day = ordered[after_idx].get("day", day)
                    insert_idx = after_idx + 1
                else:
                    insert_idx = _day_start_index(ordered, day)
            else:
                insert_idx = _day_start_index(ordered, day)

            new_row = {
                "itinerary_id": itinerary_id,
                "position": insert_idx,
                "day": day,
                "time": raw.get("time", ""),
                "name": raw.get("name", ""),
                "description": raw.get("description", ""),
                "reason_codes": raw.get("reason_codes", []),
                "transit_note": raw.get("transit_note"),
                "weather_alternate": raw.get("weather_alternate"),
                "verified": False,
                "place_id": None,
            }
            inserted = db.table("stops").insert(new_row).execute()
            new_stop = inserted.data[0]
            ordered.insert(insert_idx, new_stop)
            applied.append({"op": "add", "after_stop_id": after_stop_id, "stop": new_stop})

    # Renumber positions only for rows whose slot actually shifted.
    for i, s in enumerate(ordered):
        if s.get("position") != i:
            db.table("stops").update({"position": i}).eq("id", s["id"]).execute()
            s["position"] = i

    return applied
