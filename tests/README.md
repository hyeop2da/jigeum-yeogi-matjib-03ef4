# 자동 테스트 (235개)

앱을 고친 뒤 오류가 생기지 않았는지 한 번에 확인합니다.

```
npm i -g playwright   # 처음 한 번
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/run-all.js
```

- `units.js` : 메뉴 분류·영업시간·점수·검색어·링크 등 앱 안쪽 판단 (약 110개, 주소에 `?debug=1` 일 때만 열리는 `window.__jy` 사용)
- `run-all.js` : 실제 화면 사용 흐름 (시각 08:30·12:10·16:00·22:30, 위치 허용·거부·늦은 GPS, 칩 18개, 거리 6단계, 기록·공유, 기기별 카카오맵 열기, 배포 페이지 등)
- `mock-kakao.js` : 카카오 지도·검색을 흉내 낸 가짜 데이터 (실제 카카오에 요청하지 않음)
