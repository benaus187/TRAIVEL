"use client";

import { useMemo, useRef, useEffect } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Stop } from "@/lib/schemas/itinerary";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type StopWithCoords = Stop & { lat: number; lon: number };

const lineLayer = {
  id: "route",
  type: "line" as const,
  paint: {
    "line-color": "#e85d3d",
    "line-width": 2,
    "line-dasharray": [2, 2] as number[],
  },
};

export function MapView({ stops }: { stops: Stop[] }) {
  const mapRef = useRef<MapRef>(null);

  const stopsWithCoords = useMemo(
    () =>
      stops.filter(
        (s): s is StopWithCoords =>
          typeof s.lat === "number" && typeof s.lon === "number"
      ),
    [stops]
  );

  const geojson = useMemo(
    () => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: stopsWithCoords.map((s) => [s.lon, s.lat]),
      },
      properties: {},
    }),
    [stopsWithCoords]
  );

  // Fit map to all stops once coords are known
  useEffect(() => {
    if (!mapRef.current || stopsWithCoords.length < 2) return;
    const lons = stopsWithCoords.map((s) => s.lon);
    const lats = stopsWithCoords.map((s) => s.lat);
    mapRef.current.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: 15, duration: 800 }
    );
  }, [stopsWithCoords]);

  if (!MAPBOX_TOKEN || stopsWithCoords.length === 0) return null;

  const center = stopsWithCoords[0];

  return (
    <div className="w-full h-[320px] rounded-lg overflow-hidden border border-border">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lon,
          latitude: center.lat,
          zoom: 13,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
      >
        {stopsWithCoords.length >= 2 && (
          <Source id="route" type="geojson" data={geojson}>
            <Layer {...lineLayer} />
          </Source>
        )}
        {stopsWithCoords.map((stop, i) => (
          <Marker
            key={i}
            longitude={stop.lon}
            latitude={stop.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-mono font-bold shadow-md ring-2 ring-background">
                {i + 1}
              </div>
              <div className="text-[9px] font-mono bg-background/90 px-1 rounded shadow-sm leading-tight whitespace-nowrap">
                {stop.time}
              </div>
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
