const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const KAKAO_SEARCH_URL = "https://place.map.kakao.com/mapsearch/map.daum";
const ALLOWED_ORIGINS = new Set([
  "https://hyeop2da.github.io"
]);

function corsHeaders(origin) {
  const allowed = origin && (
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/[-a-z0-9]+\.netlify\.app$/i.test(origin)
  ) ? origin : "null";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

function cleanPlace(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim();
  const name = String(value.place_name || value.name || "").trim();
  if (!/^\d+$/.test(id) || !name) return null;
  return {
    id,
    name,
    address: String(value.road_address_name || value.address_name || value.address || "").trim(),
    x: Number(value.x ?? value.lon),
    y: Number(value.y ?? value.lat)
  };
}

function numberOrNull(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function distanceMeters(a, b) {
  if (!Number.isFinite(a?.x) || !Number.isFinite(a?.y) ||
      !Number.isFinite(b?.x) || !Number.isFinite(b?.y)) return Infinity;
  const toRad = v => v * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.y - a.y);
  const dLng = toRad(b.x - a.x);
  const aa = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.y)) * Math.cos(toRad(b.y)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function collectObjects(value, out = [], depth = 0) {
  if (depth > 5 || value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    out.push(value);
    for (const key of Object.keys(value)) {
      if (key === "place" || key === "places" || key === "items" || key === "documents" || key === "result" || key === "data") {
        collectObjects(value[key], out, depth + 1);
      }
    }
  }
  return out;
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/\\s+/g, "").replace(/[()\\[\\]{}·.,'"`]/g, "");
}

async function fetchKakaoSearch(place) {
  const queries = [
    place.address ? `${place.name} ${place.address}` : place.name,
    place.name
  ];

  for (const q of queries) {
    const url = new URL(KAKAO_SEARCH_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("page", "1");

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://map.kakao.com/",
        "User-Agent": "Mozilla/5.0 (compatible; JigeumYeogiMatjib/1.0)"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) continue;

    const data = await response.json();
    const rows = collectObjects(data).filter(row =>
      row && (
        row.confirmid != null || row.id != null || row.place_id != null || row.placeId != null ||
        row.name != null || row.place_name != null
      )
    );

    const placeId = place.id;
    const sameId = rows.find(row =>
      String(row.confirmid ?? row.id ?? row.place_id ?? row.placeId ?? "") === placeId
    );

    const wantedName = normalizeText(place.name);
    const wantedAddress = normalizeText(place.address);
    const sameName = rows
      .filter(row => {
        const rowName = normalizeText(row.name ?? row.place_name);
        const rowAddress = normalizeText(row.new_address ?? row.road_address_name ?? row.address_name ?? row.address);
        return rowName === wantedName ||
          (rowName && wantedName && (rowName.includes(wantedName) || wantedName.includes(rowName)) &&
           (!wantedAddress || !rowAddress || rowAddress.includes(wantedAddress) || wantedAddress.includes(rowAddress)));
      })
      .sort((a, b) => {
        const da = distanceMeters(place, {
          x: numberOrNull(a.x ?? a.lon),
          y: numberOrNull(a.y ?? a.lat)
        });
        const db = distanceMeters(place, {
          x: numberOrNull(b.x ?? b.lon),
          y: numberOrNull(b.y ?? b.lat)
        });
        return da - db;
      })[0];

    const nearest = rows
      .map(row => ({
        row,
        distance: distanceMeters(place, {
          x: numberOrNull(row.x ?? row.lon),
          y: numberOrNull(row.y ?? row.lat)
        })
      }))
      .filter(x => Number.isFinite(x.distance))
      .sort((a, b) => a.distance - b.distance)[0];

    const match = sameId || sameName || (nearest && nearest.distance < 300 ? nearest.row : null);

    if (match) {
      const rating = numberOrNull(
        match.rating_average ?? match.ratingAverage ?? match.avgRating ?? match.averageRating ?? match.score
      );
      const reviewCount = numberOrNull(
        match.reviewCount ?? match.review_count ?? match.ratingCount ?? match.rating_count
      );
      if (rating !== null) {
        return {
          id: place.id,
          rating,
          reviewCount,
          matched: true,
          source: "kakaomap"
        };
      }
    }
  }

  return {
    id: place.id,
    rating: null,
    reviewCount: null,
    matched: false,
    source: "kakaomap"
  };
}
async function enrichOne(place) {
  const cached = CACHE.get(place.id);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const value = await fetchKakaoSearch(place);
    CACHE.set(place.id, { value, expires: Date.now() + CACHE_TTL });
    return value;
  } catch {
    const value = { id: place.id, rating: null, reviewCount: null, matched: false, source: "kakaomap" };
    CACHE.set(place.id, { value, expires: Date.now() + 60 * 1000 });
    return value;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export default async function handler(request) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "POST만 허용됩니다." }, 405, origin);

  try {
    const body = await request.json();
    const input = Array.isArray(body?.places) ? body.places.slice(0, 15) : [];
    const places = input.map(cleanPlace).filter(Boolean);
    if (!places.length) return json({ places: [], filtered: 0, source: "kakaomap" }, 200, origin);
    const enriched = await mapLimit(places, 4, enrichOne);
    return json({
      places: enriched,
      filtered: enriched.filter(item => item.rating !== null && item.rating >= 4).length,
      source: "kakaomap"
    }, 200, origin);
  } catch (error) {
    return json({
      error: "카카오맵 평점/후기 데이터를 가져오지 못했습니다.",
      detail: String(error?.message || error)
    }, 502, origin);
  }
}

export const config = { path: "/api/kakao-ratings", method: ["POST", "OPTIONS"] };
