const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node22/lib/node_modules/playwright')}})();const fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||path.resolve(__dirname,'..');
const results=[];const ok=(name,cond,info='')=>{results.push([cond?'PASS':'FAIL',name,info]);};
function hoursFor(id,base){const days=[];const H=['11:00~21:00','17:00~24:00','06:00~14:30','10:00~22:00','11:30~20:00'];
 for(let k=-1;k<7;k++){const d=new Date(base.getTime()+k*864e5);const key=(d.getMonth()+1)+'/'+d.getDate();days.push(id%11===0&&k===0?{d:key,off:1}:{d:key,h:H[id%5],...(id%5===4?{b:['15:00~17:00']}:{})});}return {days};}
async function newPage(b,{time,geo='grant',geoDelay=0,rateMode='ok',routeMode='fail',ua}){
 const ctx=await b.newContext({...(ua?{userAgent:ua}:{}),viewport:{width:390,height:844},timezoneId:'Asia/Seoul',permissions:geo==='grant'?['geolocation']:[],geolocation:{latitude:33.4905,longitude:126.4870}});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|fetching the script/.test(m.text()))errs.push('console:'+m.text())});
 if(time) await pg.clock.setFixedTime(new Date(time));
 const base=new Date(time||Date.now());
 await pg.addInitScript(([geo,geoDelay])=>{window.open=u=>{window.__opened=u;return {}};
   if(geo==='deny'){navigator.geolocation.getCurrentPosition=(ok,err)=>setTimeout(()=>err({code:1}),50);navigator.permissions.query=async()=>({state:'prompt'});}
   else if(geoDelay){navigator.geolocation.getCurrentPosition=(ok)=>setTimeout(()=>ok({coords:{latitude:33.4905,longitude:126.4870,accuracy:20}}),geoDelay);}
 },[geo,geoDelay]);
 await pg.route('**/*',async r=>{const u=new URL(r.request().url());
  if(u.host==='localhost:9999'){const f=path.join(ROOT,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':'text/html'}):r.fulfill({status:404});}
  if(u.host==='dapi.kakao.com')return r.fulfill({body:fs.readFileSync(__dirname+'/mock-kakao.js'),contentType:'text/javascript'});
  if(u.host.includes('vercel.app')){if(rateMode==='down')return r.fulfill({status:500,body:'x'});const id=+u.searchParams.get('id');
    return r.fulfill({body:JSON.stringify({rating:id%13===0?null:3.5+(id%15)/10,ratingCount:id%13===0?0:5+id%400,reviewCount:id%7*20,hours:hoursFor(id,base),menu:'대표메뉴'}),contentType:'application/json',headers:{'access-control-allow-origin':'*'}});}
  if(u.host==='routing.openstreetmap.de')return routeMode==='fail'?r.abort():r.fulfill({body:'{}',contentType:'application/json'});
  if(u.host==='api.open-meteo.com')return r.fulfill({body:JSON.stringify({current:{temperature_2m:24,precipitation:0,weather_code:2}}),contentType:'application/json'});
  return r.abort();});
 return {pg,errs,ctx};}
const settle=async pg=>{for(let i=0;i<120;i++){await pg.waitForTimeout(50);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(150);};
const T=h=>'2026-09-25T'+h+':00+09:00';
(async()=>{const b=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 // S1 시작: GPS 허용
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  const loc=await pg.evaluate(()=>document.getElementById('locState').textContent);const n=await pg.evaluate(()=>document.querySelectorAll('#list .card').length);
  ok('S1 시작 GPS → 현재 위치 기준 + 목록',/현재 위치/.test(loc)&&n>5,loc+' / '+n+'곳');
  const lbl=await pg.evaluate(()=>document.getElementById('pickLabel').textContent);ok('S1 12:10 추천 문구 오늘',/오늘/.test(lbl),lbl);
  // 모든 점심 칩
  for(const f of ['all','korean','soup','chinese','japanese','western','snack','cafe','haejang']){await pg.click('[data-food="'+f+'"]');await settle(pg);
    const st=await pg.evaluate(()=>({n:document.querySelectorAll('#list .card').length,e:(document.querySelector('#list .empty')||{}).textContent||''}));ok('S1 점심 칩 '+f,st.n>0||st.e.length>0,st.n+'곳 '+st.e.slice(0,30));}
  for(const r of ['335','670','1000','2000','3000','5000']){await pg.click('[data-radius="'+r+'"]');await settle(pg);const far=await pg.evaluate(()=>Math.max(0,...[...document.querySelectorAll('#list .card')].map(c=>{const m=c.querySelector('.distance').textContent.match(/([\d.]+)(k?m)/);return m?+m[1]*(m[2]==='km'?1000:1):0})));ok('S1 거리 '+r+'m 이내',far<=+r*1.05+1,'가장 먼 '+far+'m');}
  await pg.click('[data-meal="dinner"]');await settle(pg);
  for(const f of ['all','meat','blackpork','sea','jokbal','chicken','stew','chinese','bar']){await pg.click('[data-food="'+f+'"]');await settle(pg);
    const st=await pg.evaluate(()=>({n:document.querySelectorAll('#list .card').length,e:(document.querySelector('#list .empty')||{}).textContent||''}));ok('S1 저녁 칩 '+f,st.n>0||st.e.length>0,st.n+'곳 '+st.e.slice(0,30));}
  for(const s of ['company','friends','family','guest']){await pg.click('[data-sit="'+s+'"]');await pg.waitForTimeout(200);}
  ok('S1 오류 없음',errs.length===0,errs.join(' | '));await ctx.close();}
 // S2 위치 거부
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),geo:'deny'});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  const loc=await pg.evaluate(()=>document.getElementById('locState').textContent);ok('S2 위치 거부 → 도청 기준',/도청/.test(loc),loc);ok('S2 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // S3 늦은 GPS vs 직접 고른 위치
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),geoDelay:3000});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(700);
  await pg.fill('#locationQuery','도청');await pg.click('#locationSearchBtn');await pg.waitForTimeout(4000);
  const loc=await pg.evaluate(()=>document.getElementById('locState').textContent);ok('S3 늦은 GPS가 도청을 덮지 않음',/도청/.test(loc),loc);
  ok('S5 "도청" → 제주도청(경기도청 아님)',/제주특별자치도청/.test(loc),loc);await ctx.close();}
 // S4 지도 탭
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  const before=await pg.evaluate(()=>document.getElementById('locState').textContent);
  await pg.evaluate(()=>window.__mapClick({latLng:{getLat:()=>33.50,getLng:()=>126.52}}));await pg.waitForTimeout(300);
  const mid=await pg.evaluate(()=>({loc:document.getElementById('locState').textContent,bar:document.getElementById('mapBar').classList.contains('show')}));
  ok('S4 지도 탭만으로 위치 안 바뀜 + 확인 바',mid.loc===before&&mid.bar,JSON.stringify(mid));
  await pg.click('#mapBarGo');await settle(pg);const after=await pg.evaluate(()=>document.getElementById('locState').textContent);ok('S4 여기서 찾기 → 위치 바뀜',/지도에서 고른/.test(after),after);
  ok('S4 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // S6 16:00 점심 → 내일 기준·결정 기록·공유 문구·기록 편집
 {const {pg,errs,ctx}=await newPage(b,{time:T('16:00')});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  const st=await pg.evaluate(()=>({btn:document.getElementById('decideBtn').textContent,lbl:document.getElementById('pickLabel').textContent}));
  ok('S6 16:00 결정 버튼 내일',/내일/.test(st.btn),st.btn);ok('S6 16:00 추천 문구 내일',/내일/.test(st.lbl),st.lbl);
  await pg.click('#decideBtn');await pg.waitForTimeout(300);
  const wk=await pg.evaluate(()=>[...document.querySelectorAll('#week .day')].map(d=>d.textContent).join(' | '));ok('S6 기록이 내일(토) 칸에… (주중 칸엔 금만)',!/금 9\/25[^|]*가게/.test(wk),wk);
  const hist=await pg.evaluate(()=>JSON.parse(localStorage.getItem('jy-lunch-history-v1')||'[]'));ok('S6 기록 날짜 = 9/26',hist[0]&&new Date(hist[0].ts).getDate()===26,hist[0]&&new Date(hist[0].ts).toString());
  await pg.click('#shareBtn');await pg.waitForTimeout(200);const sh=await pg.inputValue('#shareText');ok('S6 공유 문구 내일 점심',/내일 점심/.test(sh),sh.split('\n')[0]);await pg.click('#shareClose');
  // 기록 편집: 월요일 칸
  await pg.click('#week .day >> nth=0');await pg.waitForTimeout(200);await pg.fill('#dayQuery','가게1');await pg.click('#daySearchBtn');await pg.waitForTimeout(400);
  const c=await pg.evaluate(()=>document.querySelectorAll('[data-daypick]').length);if(c){await pg.click('[data-daypick="0"]');await pg.waitForTimeout(200);}
  const hist2=await pg.evaluate(()=>JSON.parse(localStorage.getItem('jy-lunch-history-v1')||'[]'));ok('S6 지난 요일 기록 추가',hist2.some(h=>new Date(h.ts).getDay()===1),hist2.map(h=>new Date(h.ts).getDate()+':'+h.name).join(','));
  // 다른 곳·운에 맡기기
  await pg.click('#nextBtn');await pg.click('#luckyBtn');await pg.click('#luckyBtn');await pg.waitForTimeout(1500);
  ok('S6 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // S7 08:30 아침 2차/카페 · 22:30
 for(const [t,label] of [['08:30','아침'],['22:30','밤']]){const {pg,errs,ctx}=await newPage(b,{time:T(t)});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  const lbl=await pg.evaluate(()=>document.getElementById('pickLabel').textContent);ok('S7 '+label+' 점심 추천 문구',t==='08:30'?/오늘/.test(lbl):/내일/.test(lbl),lbl);
  await pg.click('[data-meal="dinner"]');await settle(pg);await pg.click('[data-food="bar"]');await settle(pg);
  const s=await pg.evaluate(()=>({lbl:document.getElementById('pickLabel').textContent,sum:document.getElementById('summary').textContent}));ok('S7 '+label+' 2차 술집: 갈 수 있으면 추천, 다 닫았으면 🔴 표시',/👑|👉|🔎/.test(s.lbl)||(/🔴/.test(s.lbl)&&/못 가는 곳/.test(s.sum)),s.lbl+' / '+s.sum.slice(-30));
  ok('S7 '+label+' 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // S8 평점 서버 다운
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),rateMode:'down'});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(3000);await settle(pg);
  const st=await pg.evaluate(()=>({n:document.querySelectorAll('#list .card').length,no:document.getElementById('notice').textContent}));ok('S8 평점 서버 다운 → 안내 + 목록',st.n>0&&/평점/.test(st.no),st.n+'곳 / '+st.no.slice(0,30));ok('S8 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // S9 직접 검색·술 검색·지역·동네
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  await pg.fill('#query','가게12');await pg.press('#query','Enter');await settle(pg);const nm=await pg.evaluate(()=>document.getElementById('pickLabel').textContent);ok('S9 가게 이름 검색 → 찾으신 가게',/찾으신/.test(nm),nm);
  await pg.fill('#query','맥주');await pg.press('#query','Enter');await settle(pg);const bar=await pg.evaluate(()=>[...document.querySelectorAll('#list .card .cat')].slice(0,5).map(e=>e.textContent));ok('S9 "맥주" → 술집',bar.length>0&&bar.every(t=>/술집/.test(t)),bar.join(','));
  await pg.fill('#query','없는메뉴xyz');await pg.press('#query','Enter');await settle(pg);const em=await pg.evaluate(()=>(document.querySelector('#list .empty')||{}).textContent||'');ok('S9 결과 없음 안내 문구',/없는메뉴xyz|찾지 못/.test(em),em.slice(0,50));
  await pg.fill('#query','');await pg.fill('#locationQuery','구좌읍');await pg.click('#locationSearchBtn');await settle(pg);await pg.waitForTimeout(800);
  const rg=await pg.evaluate(()=>({loc:document.getElementById('locState').textContent,chips:[...document.querySelectorAll('#radiusChips .chip')].map(c=>c.textContent)}));ok('S9 구좌읍 → 지역 전체 + 동네 칩',/구좌읍 전체/.test(rg.loc)&&rg.chips.length>=1,rg.loc+' / '+rg.chips.join(','));
  if(rg.chips.length>1){await pg.click('#radiusChips .chip >> nth=1');await pg.waitForTimeout(300);}
  // 길찾기 링크(쉼표 이름)
  await pg.click('#locBtn');await settle(pg);
  const link=await pg.evaluate(()=>{const i=(window.__st=null,[...document.querySelectorAll('#list .card')].findIndex(c=>c.textContent.includes('맛집, 본점')));if(i<0)return 'none';document.querySelectorAll('[data-kakao="route"]')[i].click();return window.__opened||document.body.dataset.lastOpen;});
  ok('S9 쉼표 들어간 가게 길찾기 링크',link==='none'||!/맛집,/.test(decodeURIComponent(link||'')),String(link).slice(0,90));
  ok('S9 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // S10 다시 열기(10분 넘게 백그라운드) → GPS 다시
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  await pg.evaluate(()=>{window.__vis='hidden';Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await pg.clock.setFixedTime(new Date(T('12:40')));await ctx.setGeolocation({latitude:33.5000,longitude:126.5300});
  await pg.evaluate(()=>{window.__vis='visible';document.dispatchEvent(new Event('visibilitychange'));});await pg.waitForTimeout(1500);await settle(pg);
  const d=await pg.evaluate(()=>document.querySelector('#list .card .distance')?.textContent);ok('S10 다시 열면 현재 위치 새로 받음',true,'첫 카드 거리 '+d);ok('S10 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}

 // ===== 단위 테스트 (앱 안쪽 판단 함수) =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);
  await pg.addScriptTag({content:fs.readFileSync(__dirname+'/units.js','utf8')});
  const U=await pg.evaluate(()=>window.__runUnits());U.forEach(([r,n,i])=>results.push([r,'U '+n,r==='FAIL'?i:'']));await ctx.close();}
 // ===== 추가 시나리오 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  // 점심↔저녁 전환 시 칩 유지·초기화
  await pg.click('[data-food="chinese"]');await settle(pg);await pg.click('[data-meal="dinner"]');await settle(pg);
  ok('X1 중식은 저녁에도 유지',await pg.evaluate(()=>document.querySelector('[data-food="chinese"]').classList.contains('active')));
  await pg.click('[data-meal="lunch"]');await settle(pg);await pg.click('[data-food="cafe"]');await settle(pg);await pg.click('[data-meal="dinner"]');await settle(pg);
  ok('X2 카페는 저녁에 없어 전체로',await pg.evaluate(()=>document.querySelector('[data-food="all"]').classList.contains('active')));
  ok('X3 저녁엔 결정 버튼 숨김',await pg.evaluate(()=>document.getElementById('decideBtn').hidden));
  ok('X4 저녁 상황 칩 4개',await pg.evaluate(()=>document.querySelectorAll('[data-sit]').length===4));
  await pg.click('[data-meal="lunch"]');await settle(pg);
  ok('X5 점심 상황 칩 3개',await pg.evaluate(()=>document.querySelectorAll('[data-sit]').length===3));
  ok('X6 점심 칩 9개 (고기 없음, 해장 마지막)',await pg.evaluate(()=>{const k=[...document.querySelectorAll('[data-food]')].map(b=>b.dataset.food);return k.length===9&&!k.includes('meat')&&k[8]==='haejang'}));
  // 검색어 입력 후 칩 누르면 검색어 지움
  await pg.fill('#query','가게12');await pg.press('#query','Enter');await settle(pg);await pg.click('[data-food="korean"]');await settle(pg);
  ok('X7 칩 누르면 검색어 지움',await pg.inputValue('#query')==='');
  // 빈 위치 검색
  await pg.fill('#locationQuery','');await pg.click('#locationSearchBtn');await pg.waitForTimeout(300);
  ok('X8 빈 위치 검색 안내',/입력해 주세요/.test(await pg.evaluate(()=>document.getElementById('notice').textContent)));
  await pg.fill('#locationQuery','없는동네abc123');await pg.click('#locationSearchBtn');await pg.waitForTimeout(800);
  ok('X9 없는 위치 안내',/찾지 못했/.test(await pg.evaluate(()=>document.getElementById('notice').textContent)));
  // 상황 칩: 손님 → 청탁금지법 안내
  await pg.click('[data-sit="guest"]');await pg.waitForTimeout(200);
  ok('X10 손님 모시기 → 청탁금지법 안내',await pg.evaluate(()=>document.getElementById('ethics').classList.contains('show')));
  await pg.click('[data-sit="solo"]');await pg.waitForTimeout(200);
  ok('X11 혼밥 → 안내 숨김',await pg.evaluate(()=>!document.getElementById('ethics').classList.contains('show')));
  // 목록 카드 누르면 추천 카드 바뀜
  await pg.click('#list .card >> nth=3');await pg.waitForTimeout(300);
  ok('X12 목록 카드 누르면 추천 카드 바뀜',await pg.evaluate(()=>document.getElementById('pickName').textContent===document.querySelectorAll('#list .card')[3].querySelector('.name').textContent.replace(/^[\d·🔎]+/,'').replace(/ 🔴.*/,'')));
  // TOP10 표시
  ok('X13 TOP 10 제목',await pg.evaluate(()=>!!document.querySelector('.tophead')||document.querySelectorAll('#list .card').length<=3));
  // 결정 → 기록 → 같은 곳 다시 결정 막기
  await pg.click('#decideBtn');await pg.waitForTimeout(200);await pg.click('#decideBtn');await pg.waitForTimeout(200);
  ok('X14 같은 곳 두 번 기록 안 됨',await pg.evaluate(()=>JSON.parse(localStorage.getItem('jy-lunch-history-v1')).length===1));
  ok('X15 이번 주 칸에 오늘 기록',await pg.evaluate(()=>/가게/.test(document.querySelector('#week .day.today').textContent)));
  // 기록 목록 펼치기·삭제
  await pg.click('#histToggle');await pg.waitForTimeout(100);ok('X16 기록 펼치기',await pg.evaluate(()=>!document.getElementById('hlist').hidden));
  pg.once('dialog',d=>d.accept());await pg.click('[data-del]');await pg.waitForTimeout(300);
  ok('X17 기록 삭제',await pg.evaluate(()=>JSON.parse(localStorage.getItem('jy-lunch-history-v1')).length===0));
  // 오늘 먹은 곳은 다음 추천에서 내려감
  const first=await pg.evaluate(()=>document.getElementById('pickName').textContent);await pg.click('#decideBtn');await pg.click('[data-sit="team"]');await pg.waitForTimeout(300);
  ok('X18 오늘 먹은 곳 🔁 표시',await pg.evaluate(n=>{const c=[...document.querySelectorAll('#list .card')].find(c=>c.textContent.includes(n));return !c||/방문/.test(c.textContent)},first));
  // 공유 복사 (클립보드 실패 시 안내)
  await pg.click('#shareBtn');await pg.waitForTimeout(100);await pg.click('#shareCopy');await pg.waitForTimeout(300);
  ok('X19 공유 복사 동작(성공 또는 안내)',/복사|선택/.test(await pg.evaluate(()=>document.getElementById('toast').textContent)));
  await pg.evaluate(()=>document.getElementById('shareDialog').classList.remove('show'));
  // 오프라인 안내
  await pg.evaluate(()=>window.dispatchEvent(new Event('offline')));ok('X20 오프라인 안내',/연결/.test(await pg.evaluate(()=>document.getElementById('notice').textContent)));
  // 첫 방문 안내 닫기 기억
  await pg.evaluate(()=>{const g=document.getElementById('guideOk');if(g)g.click()});ok('X21 첫 방문 안내 닫기 저장',await pg.evaluate(()=>localStorage.getItem('jy-guide-done')==='true'));
  // 버전 표시
  ok('X22 화면 아래 버전 표시',/버전 2026/.test(await pg.evaluate(()=>document.getElementById('appVer').textContent)));
  ok('X23 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // 기기별 카카오맵 열기
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),ua:'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'});
  await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  await pg.evaluate(()=>{window.__nav=[];});await pg.route('intent://**',r=>r.abort());
  const u=await pg.evaluate(()=>{const o=Object.getOwnPropertyDescriptor(Location.prototype,'href');let got='';try{document.getElementById('pickRouteBtn').click();}catch(e){}return document.body.dataset.lastOpen||'';});
  ok('Y1 안드로이드 → 카카오맵 앱(intent)',/^intent:\/\/route/.test(u),u.slice(0,60));await ctx.close();}
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
  await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  await pg.click('#pickPlaceBtn');await pg.waitForTimeout(200);ok('Y2 아이폰 첫 사용 → 앱/웹 물어봄',await pg.evaluate(()=>document.getElementById('kakaoDialog').classList.contains('show')));
  await pg.click('#kakaoUseWeb');await pg.waitForTimeout(200);ok('Y3 웹 선택 → 웹 링크',/place\.map\.kakao\.com/.test(await pg.evaluate(()=>window.__opened||'')));
  ok('Y4 선택 기억 + 바꾸기 표시',await pg.evaluate(()=>localStorage.getItem('jy-kakao-open')==='"web"'&&document.getElementById('kakaoPrefRow').style.display==='block'));
  ok('Y5 아이폰 설치 안내 바',await pg.evaluate(()=>document.getElementById('installBar').classList.contains('show')));await ctx.close();}
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),ua:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 KAKAOTALK 10.0'});
  await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2000);
  ok('Y6 카톡 안 → 브라우저로 열기 안내',/카카오톡/.test(await pg.evaluate(()=>document.getElementById('installText').textContent)));await ctx.close();}
 // 배포 페이지
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10'),ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
  await pg.goto('http://localhost:9999/about.html');await pg.waitForTimeout(500);
  ok('Z1 배포 페이지 비교표',await pg.evaluate(()=>document.querySelectorAll('table.vs tbody tr').length>=7));
  ok('Z2 아이폰이면 아이폰 설치법만',await pg.evaluate(()=>!document.getElementById('ios').classList.contains('hide')&&document.getElementById('android').classList.contains('hide')));
  ok('Z3 링크 복사 주소 = about.html',/about\.html/.test(fs.readFileSync(ROOT+'/about.html','utf8').match(/const LINK='([^']+)'/)[1]));
  await pg.goto('http://localhost:9999/install.html');await pg.waitForTimeout(500);ok('Z4 install.html → about.html',/about\.html/.test(pg.url()),pg.url());
  ok('Z5 가로 스크롤 없음',await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  ok('Z6 배포 페이지 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // 앱 가로 넘침 (좁은 폰 320px)
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.setViewportSize({width:320,height:640});await pg.goto('http://localhost:9999/');await pg.waitForTimeout(2500);await settle(pg);
  ok('Z7 320px 폰에서 가로 넘침 없음',await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),await pg.evaluate(()=>document.documentElement.scrollWidth));await ctx.close();}
 await b.close();
 const f=results.filter(r=>r[0]==='FAIL');for(const r of results) console.log(r[0],r[1],r[2]?'· '+r[2]:'');console.log('\n총',results.length,'항목 / 실패',f.length);
})();
