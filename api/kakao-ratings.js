// Vercel Edge Function: Cloudflare Worker 와 같은 카카오 평점 중계 로직을 재사용한다.
import worker from "../worker/src/index.js";

// 카카오 서버와 가까운 서울 리전에서 실행
export const config = { runtime: "edge", regions: ["icn1"] };

export default function handler(request) {
  return worker.fetch(request);
}
