const VERSION = "2026-09-24-match-v2";
const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const KAKAO_SEARCH_URL = "https://search.map.kakao.com/mapsearch/map.daum";
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "").replace(/[()[\]{}·.,'"`]/g, "");
}

async function fetchKakaoSearch(place, diagnostics) {
  diagnostics.requests++;

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

    if (!response.ok) {
      diagnostics.httpErrors++;
      diagnostics.lastError = `HTTP ${response.status}`;
      continue;
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      diagnostics.parseErrors++;
      diagnostics.lastError = `JSON parse failed: ${String(error?.message || error)}; body=${text.slice(0, 160)}`;
      continue;
    }
    // 카카오 응답의 x/y 는 WCONGNAMUL 좌표이므로 거리 계산에는 lon/lat 만 사용한다.
    const rows = (Array.isArray(data?.place) ? data.place : []).filter(row =>
      row && typeof row === "object" && (row.confirmid != null || row.name != null)
    );

    diagnostics.responses++;
    diagnostics.rowCounts.push(rows.length);
    if (rows.length && diagnostics.sample.length < 3) {
      diagnostics.sample.push({
        query: q,
        first: rows.slice(0, 3).map(row => ({
          id: row.confirmid ?? null,
          name: row.name ?? null,
          rating: row.rating_average ?? null,
          ratingCount: row.rating_count ?? null,
          reviews: row.reviewCount ?? null
        }))
      });
    }

    const placeId = place.id;
    const sameId = rows.find(row =>
      String(row.confirmid ?? "") === placeId
    );

    const wantedName = normalizeText(place.name);
    const wantedAddress = normalizeText(place.address);
    const sameName = rows
      .filter(row => {
        const rowName = normalizeText(row.name);
        const rowAddress = normalizeText(row.new_address ?? row.address);
        return rowName === wantedName ||
          (rowName && wantedName && (rowName.includes(wantedName) || wantedName.includes(rowName)) &&
           (!wantedAddress || !rowAddress || rowAddress.includes(wantedAddress) || wantedAddress.includes(rowAddress)));
      })
      .sort((a, b) => {
        const da = distanceMeters(place, {
          x: numberOrNull(a.lon),
          y: numberOrNull(a.lat)
        });
        const db = distanceMeters(place, {
          x: numberOrNull(b.lon),
          y: numberOrNull(b.lat)
        });
        return da - db;
      })[0];

    // 위치만 가까운 다른 가게의 평점을 빌려오지 않도록 ID 또는 이름이 맞을 때만 사용한다.
    const match = sameId || sameName;

    if (match) {
      const ratingAverage = numberOrNull(match.rating_average);
      const ratingCount = numberOrNull(match.rating_count);
      // rating_average·rating_count 가 모두 0 이면 아직 평가가 없는 장소(미평가)다.
      const rating = ratingAverage === null || (ratingAverage === 0 && !ratingCount) ? null : ratingAverage;
      const reviewCount = numberOrNull(match.reviewCount);
      if (rating !== null) {
        diagnostics.rated++;
        return {
          id: place.id,
          rating,
          reviewCount,
          ratingCount,
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
async function enrichOne(place, diagnostics) {
  const cached = CACHE.get(place.id);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const value = await fetchKakaoSearch(place, diagnostics);
    CACHE.set(place.id, { value, expires: Date.now() + CACHE_TTL });
    return value;
  } catch (error) {
    diagnostics.exceptions++;
    diagnostics.lastError = String(error?.message || error);
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

async function handler(request) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method === "GET") return json({ ok: true, service: "jigeum-yeogi-kakao-ratings", version: VERSION }, 200, origin);
  if (request.method !== "POST") return json({ error: "POST만 허용됩니다." }, 405, origin);

  try {
    const body = await request.json();
    const input = Array.isArray(body?.places) ? body.places.slice(0, 45) : [];
    const places = input.map(cleanPlace).filter(Boolean);
    if (!places.length) return json({ places: [], filtered: 0, source: "kakaomap" }, 200, origin);
    const diagnostics = { requests: 0, responses: 0, httpErrors: 0, parseErrors: 0, exceptions: 0, rated: 0, rowCounts: [], sample: [], lastError: null };
    const enriched = await mapLimit(places, 6, place => enrichOne(place, diagnostics));
    return json({
      places: enriched,
      filtered: enriched.filter(item => item.rating !== null && item.rating >= 4).length,
      source: "kakaomap",
      diagnostics
    }, 200, origin);
  } catch (error) {
    return json({
      error: "카카오맵 평점/후기 데이터를 가져오지 못했습니다.",
      detail: String(error?.message || error)
    }, 502, origin);
  }
}

export default {
  async fetch(request) {
    return handler(request);
  }
};
