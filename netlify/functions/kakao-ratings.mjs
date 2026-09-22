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
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.place) ? data.place : []);
    const sameId = rows.find(row => String(row?.confirmid || row?.id || "") === place.id);
    const sameName = rows
      .filter(row => String(row?.name || "").trim() === place.name)
      .sort((a, b) => {
        const da = distanceMeters(place, { x: numberOrNull(a?.lon), y: numberOrNull(a?.lat) });
        const db = distanceMeters(place, { x: numberOrNull(b?.lon), y: numberOrNull(b?.lat) });
        return da - db;
      })[0];

    const match = sameId || (sameName && distanceMeters(place, {
      x: numberOrNull(sameName?.lon), y: numberOrNull(sameName?.lat)
    }) < 1000);

    if (match) {
      return {
        id: place.id,
        rating: numberOrNull(match.rating_average ?? match.ratingAverage),
        reviewCount: numberOrNull(match.reviewCount ?? match.review_count ?? match.ratingCount),
        matched: true,
        source: "kakaomap"
      };
    }
  }

  return { id: place.id, rating: null, reviewCount: null, matched: false, source: "kakaomap" };
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
