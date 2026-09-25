const VERSION = "2026-09-25-panel-v2";
const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const KAKAO_SEARCH_URL = "https://search.map.kakao.com/mapsearch/map.daum";
const KAKAO_PANEL_URL = "https://place-api.map.kakao.com/places/panel3/";
const ALLOWED_ORIGINS = new Set([
  "https://hyeop2da.github.io"
]);

const PUBLIC_ORIGIN = "https://hyeop2da.github.io";
// 가게별 평점은 모든 직원이 같은 답을 받으므로 CDN 에 하루 보관한다.
const PLACE_CACHE_SECONDS = 24 * 60 * 60;

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin) {
  const allowed = isAllowedOrigin(origin) ? origin : "null";

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
// 카카오맵 가게 상세의 '오늘부터 7일' 영업시간만 짧게 정리한다: [{d:"9/25", h:"12:00~23:00", b:["15:00~16:30"], lo:"14:10"} | {d, off:1}]
function hhmmRange(text) {
  const m = String(text || "").match(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/);
  return m ? `${m[1]}~${m[2]}` : null;
}
// 가게 상세 한 번으로 평점(카카오맵 별점)·블로그 후기 수·영업시간을 모두 받는다
async function fetchHours(place) {
  if (!/^\d+$/.test(place.id)) return { hours: null, failed: false, panel: null };
  try {
    const response = await fetch(KAKAO_PANEL_URL + place.id, {
      headers: {
        "Accept": "application/json",
        "pf": "web",
        "appVersion": "6.6.0",
        "Origin": "https://place.map.kakao.com",
        "Referer": "https://place.map.kakao.com/",
        "User-Agent": "Mozilla/5.0 (compatible; JigeumYeogiMatjib/1.0)"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return { hours: null, failed: response.status >= 500 || response.status === 429, panel: null };
    const data = await response.json();
    const score = data?.kakaomap_review?.score_set;
    const ratingCount = numberOrNull(score?.review_count);
    const avg = numberOrNull(score?.average_score);
    const panel = {
      rating: ratingCount && avg ? avg : null,
      ratingCount: ratingCount || 0,
      blogCount: numberOrNull(data?.blog_review?.review_count) || 0
    };
    const oh = data?.open_hours;
    const periods = oh?.week_from_today?.week_periods;
    if (!Array.isArray(periods)) return { hours: null, failed: false, panel };
    const days = [];
    for (const period of periods) {
      for (const day of period?.days || []) {
        const d = String(day?.day_of_the_week_desc || "").match(/(\d{1,2}\/\d{1,2})/)?.[1];
        if (!d) continue;
        if (day.off_days_desc && !day.on_days) { days.push({ d, off: 1 }); continue; }
        const h = hhmmRange(day?.on_days?.start_end_time_desc);
        if (!h) continue;
        const item = { d, h };
        const b = (day.on_days.break_times_desc || []).map(hhmmRange).filter(Boolean);
        if (b.length) item.b = b;
        const lo = String((day.on_days.last_order_times_desc || [])[0] || "").match(/\d{1,2}:\d{2}/)?.[0];
        if (lo) item.lo = lo;
        days.push(item);
      }
    }
    if (!days.length) return { hours: null, failed: false, panel };
    const off = oh?.week_from_today?.days_off_desc || oh?.headline_addition?.days_off_desc || null;
    return { hours: off ? { days, off: String(off).slice(0, 40) } : { days }, failed: false, panel };
  } catch (error) {
    return { hours: null, failed: true, panel: null };
  }
}

async function enrichOne(place, diagnostics) {
  const cached = CACHE.get(place.id);
  if (cached && cached.expires > Date.now()) return cached.value;
  const errorsBefore = diagnostics.httpErrors + diagnostics.parseErrors;
  try {
    // 가게 상세를 먼저 보고, 거기서 평점을 못 얻을 때만 검색으로 찾아 맞춘다 (카카오 호출 1번으로 끝나는 경우가 대부분)
    const hoursResult = await fetchHours(place);
    const pn = hoursResult.panel;
    const value = pn && (pn.rating !== null || pn.blogCount)
      ? { id: place.id, rating: pn.rating, reviewCount: pn.blogCount, ratingCount: pn.ratingCount, matched: true, source: "kakaomap-panel" }
      : await fetchKakaoSearch(place, diagnostics);
    if (pn && pn.rating !== null && value.source === "kakaomap-panel") diagnostics.rated++;
    value.hours = hoursResult.hours;
    if (hoursResult.failed) value.hoursRetry = true;
    // 카카오 일시 오류로 못 찾은 결과는 오래 보관하지 않는다.
    const transient = value.rating === null && diagnostics.httpErrors + diagnostics.parseErrors > errorsBefore;
    if (transient) value.transient = true;
    CACHE.set(place.id, { value, expires: Date.now() + (transient ? 60 * 1000 : hoursResult.failed ? 5 * 60 * 1000 : CACHE_TTL) });
    return value;
  } catch (error) {
    diagnostics.exceptions++;
    diagnostics.lastError = String(error?.message || error);
    const value = { id: place.id, rating: null, reviewCount: null, matched: false, source: "kakaomap", transient: true };
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
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    if (!params.has("id")) return json({ ok: true, service: "jigeum-yeogi-kakao-ratings", version: VERSION }, 200, origin);
    return placeLookup(params, origin);
  }
  if (request.method !== "POST") return json({ error: "GET/POST만 허용됩니다." }, 405, origin);
  if (!isAllowedOrigin(origin)) return json({ error: "허용되지 않은 사이트의 요청입니다." }, 403, origin);

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

// GET ?id=&name=&addr=&x=&y= : 가게 1곳 평점. 같은 URL 은 CDN 이 하루 동안 대신 응답한다.
async function placeLookup(params, origin) {
  const headers = {
    "Access-Control-Allow-Origin": PUBLIC_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "허용되지 않은 사이트의 요청입니다." }), {
      status: 403, headers: { ...headers, "Cache-Control": "no-store" }
    });
  }
  const place = cleanPlace({
    id: params.get("id"),
    name: params.get("name"),
    address: params.get("addr"),
    x: params.get("x"),
    y: params.get("y")
  });
  if (!place) {
    return new Response(JSON.stringify({ error: "id·name 이 필요합니다." }), {
      status: 400, headers: { ...headers, "Cache-Control": "no-store" }
    });
  }
  const diagnostics = { requests: 0, responses: 0, httpErrors: 0, parseErrors: 0, exceptions: 0, rated: 0, rowCounts: [], sample: [], lastError: null };
  const value = await enrichOne(place, diagnostics);
  // 영업시간만 일시 오류면 평점은 쓰되 CDN 에는 10분만 보관해 곧 다시 받아온다.
  const cacheControl = value.transient
    ? "no-store"
    : value.hoursRetry
      ? "public, max-age=600, s-maxage=600"
      : `public, max-age=3600, s-maxage=${PLACE_CACHE_SECONDS}, stale-while-revalidate=${PLACE_CACHE_SECONDS}`;
  return new Response(JSON.stringify({ ...value, version: VERSION }), {
    status: 200,
    headers: { ...headers, "Cache-Control": cacheControl }
  });
}

export default {
  async fetch(request) {
    return handler(request);
  }
};
