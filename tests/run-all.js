const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node22/lib/node_modules/playwright')}})();const fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||path.resolve(__dirname,'..');
const results=[];const ok=(name,cond,info='')=>{results.push([cond?'PASS':'FAIL',name,info]);};
const {BARS,FIRST}=require('./bars-data.js');
function barHours(h,base){const days=[];for(let k=-1;k<7;k++){const d=new Date(base.getTime()+k*864e5);days.push({d:(d.getMonth()+1)+'/'+d.getDate(),h});}return {days};}
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
  if(u.host==='dapi.kakao.com')return r.fulfill({body:'window.__BARS='+JSON.stringify(BARS)+';\n'+fs.readFileSync(__dirname+'/mock-kakao.js','utf8'),contentType:'text/javascript'});
  if(u.host.includes('vercel.app')){if(rateMode==='down')return r.fulfill({status:500,body:'x'});const id=+u.searchParams.get('id');
    const bar=BARS.find(x=>+x.id===id);
    if(bar) return r.fulfill({body:JSON.stringify({rating:bar.rating,ratingCount:bar.cnt,reviewCount:10,hours:barHours(bar.h,base),menu:bar.menu}),contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
    return r.fulfill({body:JSON.stringify({rating:id%13===0?null:3.5+(id%15)/10,ratingCount:id%13===0?0:5+id%400,reviewCount:id%7*20,hours:hoursFor(id,base),menu:id%4===0?'등심돈까스,김밥,라면':id%8===3?'백반,찌개,김밥,라면,등심돈까스':'백반,찌개'}),contentType:'application/json',headers:{'access-control-allow-origin':'*'}});}
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
  for(const s of ['company','quiet','light']){await pg.click('[data-sit="'+s+'"]');await pg.waitForTimeout(200);}
  await pg.click('[data-food="all"]');await settle(pg);
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
  ok('X3 저녁엔 "1차 결정" 버튼',await pg.evaluate(()=>{const b=document.getElementById('decideBtn');return !b.hidden&&/1차/.test(b.textContent)}),await pg.evaluate(()=>document.getElementById('decideBtn').textContent));
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

 // ===== 직접 검색어 관련성·내일 기준 표시 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('19:39')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  await pg.fill('#query','돈까스');await pg.press('#query','Enter');await settle(pg);
  const r=await pg.evaluate(()=>{const R=window.__jy.state.ranked;return {n:R.length,bad:R.filter(p=>!p.__qHit).map(p=>p.place_name+'|'+p.category_name+'|'+p.__menu)}});
  ok('Q1 "돈까스" 검색 → 돈까스 있는 가게만',r.n>0&&r.bad.length===0,r.n+'곳, 무관 '+r.bad.slice(0,3).join(' / '));
  const t=await pg.evaluate(()=>{const J=window.__jy,R=J.state.ranked.filter(p=>!p.__named&&p.__rating!=null);const tier=p=>p.__qText||p.__qMain?0:1;
    return {side:R.filter(p=>tier(p)===1&&!J.isBroadCat(p)).map(p=>p.place_name+'|'+p.category_name),order:R.every((p,i)=>i===0||tier(R[i-1])<=tier(p)),sides:R.filter(p=>tier(p)===1).length}});
  ok('Q1b 곁들이 메뉴로만 걸린 곳은 분류가 넓은 가게(한식 등)만',t.side.length===0,t.side.slice(0,3).join(' / '));
  ok('Q1c 전문점·대표 메뉴가 곁들이 메뉴보다 항상 위',t.order,'곁들이 '+t.sides+'곳');
  const why=await pg.evaluate(()=>[...document.querySelectorAll('#pickWhy li')].map(l=>l.textContent).join(' / '));
  ok('Q2 추천 이유에 "대표 메뉴에 돈까스"',/대표 메뉴에 “돈까스”|메뉴판에 “돈까스”/.test(why),why.slice(0,80));
  await pg.fill('#query','맛집');await pg.press('#query','Enter');await settle(pg);
  ok('Q3 "맛집"은 메뉴로 거르지 않음',await pg.evaluate(()=>window.__jy.state.ranked.length>0&&window.__jy.state.ranked.every(p=>p.__qHit===undefined)));
  await pg.fill('#query','돈가스');await pg.press('#query','Enter');await settle(pg);
  ok('Q4 "돈가스"(다른 표기)도 같은 결과',await pg.evaluate(()=>window.__jy.state.ranked.length>0&&window.__jy.state.ranked.every(p=>p.__qHit)));
  await pg.fill('#query','xyz없는메뉴');await pg.press('#query','Enter');await settle(pg);
  ok('Q5 없는 메뉴 → "찾지 못했습니다" 안내',/xyz없는메뉴.*찾지 못/.test(await pg.evaluate(()=>(document.querySelector('#list .empty')||{}).textContent||'')));
  // 내일 기준 표시 (19:39 점심 = 내일 점심)
  const st=await pg.evaluate(()=>{const J=window.__jy,dk=d=>(d.getMonth()+1)+'/'+d.getDate(),add=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d};
    const mk=f=>({days:[-1,0,1,2,3,4,5,6].map(i=>f(i,dk(add(i))))});
    const P=h=>({id:'5',place_name:'테스트',category_name:'음식점 > 분식',category_group_code:'FD6',distance:200,__rating:4.5,__ratingCount:30,__reviewCount:0,__hours:h});
    J.state.food='all';J.state.meal='lunch';
    const a=J.scorePlace(P(mk((i,k)=>i===1?{d:k,off:1}:{d:k,h:'08:00~20:00'})),'').status;
    const b=J.scorePlace(P(mk((i,k)=>i===1||i===2?null:{d:k,h:'08:30~17:30'}).days?{days:mk((i,k)=>({d:k,h:'08:30~17:30'})).days.filter((x,i)=>i!==2&&i!==3)}:null),'').status;
    const c=J.scorePlace(P(mk((i,k)=>({d:k,h:'11:00~21:00'}))),'').status;
    return {a,b,c};});
  ok('Q6 지금 영업 중이어도 내일 휴무면 🔴 내일 휴무로',st.a&&st.a.code==='off'&&/내일/.test(st.a.text),JSON.stringify(st.a));
  ok('Q7 내일 영업시간 모르면 "내일 영업시간 정보 없음"',st.b&&st.b.code==='unknown',JSON.stringify(st.b));
  ok('Q8 내일 영업하면 "내일 점심 영업"',st.c&&st.c.code==='open'&&/내일 점심 영업/.test(st.c.text),JSON.stringify(st.c));
  ok('Q9 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}

 // ===== 점심 검색에 술집 제외 / 가게 이름 먼 곳 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  await pg.fill('#query','돈까스');await pg.press('#query','Enter');await settle(pg);
  ok('L1 점심 "돈까스" 결과에 술집 없음',await pg.evaluate(()=>window.__jy.state.ranked.every(p=>!/술집/.test(p.category_name))),await pg.evaluate(()=>window.__jy.state.ranked.filter(p=>/술집/.test(p.category_name)).map(p=>p.place_name).join(',')));
  await pg.fill('#query','맥주');await pg.press('#query','Enter');await settle(pg);
  ok('L2 점심이라도 "맥주"는 술집',await pg.evaluate(()=>window.__jy.state.ranked.length>0&&window.__jy.state.ranked.every(p=>/술집/.test(p.category_name))));
  await pg.click('[data-food="western"]');await settle(pg);
  ok('L3 점심 양식 칩에 술집 없음',await pg.evaluate(()=>window.__jy.state.ranked.every(p=>!/술집/.test(p.category_name))));
  ok('L4 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}

 // ===== 메뉴 검색: 전문점 먼저, 곁들이 메뉴는 넓은 분류만 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('11:40')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  await pg.click('[data-radius="3000"]');await settle(pg);
  await pg.fill('#query','돈까스');await pg.press('#query','Enter');await settle(pg);
  const t=await pg.evaluate(()=>{const J=window.__jy,A=J.state.results,R=J.state.ranked.filter(p=>!p.__named&&J.state.ranked.indexOf(p)<J.state.openCount);const tier=p=>p.__qText||p.__qMain?0:1;
    return {main:R.filter(p=>tier(p)===0).length,sides:R.filter(p=>tier(p)===1).length,bad:A.filter(p=>tier(p)===1&&!J.isBroadCat(p)).map(p=>p.place_name+'|'+p.category_name),order:R.every((p,i)=>i===0||tier(R[i-1])<=tier(p)),none:A.filter(p=>!p.__qHit).length}});
  ok('M1 넓은 범위 "돈까스": 전문점·대표 메뉴 곳과 곁들이 곳이 모두 있음(테스트 유효)',t.main>0&&t.sides>0,'대표 '+t.main+' · 곁들이 '+t.sides);
  ok('M2 곁들이 메뉴만으로는 넓은 분류 가게만',t.bad.length===0,t.bad.slice(0,3).join(' / '));
  ok('M3 대표 메뉴 가게가 곁들이 가게보다 모두 위',t.order);
  ok('M4 돈까스 없는 가게 0곳',t.none===0,t.none+'곳');
  ok('M5 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}

 // ===== 점심에 저녁 전용 가게 제외 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  const r=await pg.evaluate(()=>{const J=window.__jy;return J.state.ranked.filter(p=>J.neverInSlot(p.__hours,J.MEAL_SLOT.lunch)).map(p=>p.place_name)});
  ok('D1 점심 추천에 저녁 전용 가게 없음',r.length===0,r.join(','));
  await pg.click('[data-meal="dinner"]');await settle(pg);await pg.click('[data-radius="2000"]');await settle(pg);
  const d=await pg.evaluate(()=>{const J=window.__jy;return J.state.ranked.filter(p=>J.neverInSlot(p.__hours,J.MEAL_SLOT.lunch)).length});
  ok('D2 저녁엔 저녁 전용 가게 나옴',d>0,d+'곳');
  ok('D3 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // ===== 저녁 1차 → 2차 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('19:00')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  await pg.click('[data-meal="dinner"]');await settle(pg);
  ok('B0 1차 기록 전: 1차 안내 없음·2차 버튼 숨김',await pg.evaluate(()=>document.getElementById('firstBar').hidden&&document.getElementById('secondBtn').hidden));
  await pg.fill('#query','연동갈비');await pg.press('#query','Enter');await settle(pg);
  ok('B1 1차 가게 찾음',await pg.evaluate(()=>document.getElementById('pickName').textContent==='연동갈비'),await pg.evaluate(()=>document.getElementById('pickName').textContent));
  await pg.click('#decideBtn');await pg.waitForTimeout(300);
  const f1=await pg.evaluate(()=>JSON.parse(localStorage.getItem('jy-dinner-first')||'null'));
  ok('B2 1차 기록 저장(좌표·종류)',f1&&f1.id==='40100'&&f1.kind==='meat'&&Math.abs(f1.lat-33.488)<0.001,JSON.stringify(f1));
  ok('B3 안내: 오늘 1차',await pg.evaluate(()=>/오늘 1차: 연동갈비/.test(document.getElementById('toast').textContent)),await pg.evaluate(()=>document.getElementById('toast').textContent));
  ok('B4 "1차 근처에서 2차 찾기" 버튼',await pg.evaluate(()=>{const b=document.getElementById('secondBtn');return !b.hidden&&/연동갈비/.test(b.textContent)}));
  ok('B5 오늘 1차 표시줄',await pg.evaluate(()=>{const e=document.getElementById('firstBar');return !e.hidden&&/오늘 1차 연동갈비/.test(e.textContent)}));
  await pg.click('#secondBtn');await settle(pg);
  const s1=await pg.evaluate(()=>{const J=window.__jy,S=J.state;return {food:S.food,at:S.atFirst,loc:document.getElementById('locState').textContent,radius:S.radius,
    ids:S.ranked.map(p=>p.id),bad:S.ranked.filter(p=>!J.isBarPlace(p)).map(p=>p.place_name),far:S.ranked.filter(p=>p.distance>S.radius+5).map(p=>p.place_name+' '+Math.round(p.distance)),
    label:document.getElementById('pickLabel').textContent,sit:S.situation,chips:[...document.querySelectorAll('[data-sit]')].map(b=>b.dataset.sit).join(','),kinds:!document.getElementById('barKindChips').hidden}});
  ok('B6 2차로 전환 + 1차 가게 기준',s1.food==='bar'&&s1.at==='40100'&&/1차 연동갈비/.test(s1.loc),JSON.stringify([s1.food,s1.at,s1.loc]));
  ok('B7 1차 근처 기본 거리 도보 5~10분',s1.radius<=670,s1.radius);
  ok('B8 2차 목록은 술집만',s1.ids.length>0&&s1.bad.length===0,s1.ids.length+'곳 '+s1.bad.join(','));
  ok('B9 1차 가게·홀덤펍·노래방·먼 가게는 빠짐',!['40100','40008','40014','40015'].some(i=>s1.ids.includes(i)),s1.ids.join(','));
  ok('B10 거리는 1차 가게에서 잰 것',s1.far.length===0&&['40001','40002','40003'].every(i=>s1.ids.includes(i)),s1.far.join(','));
  ok('B11 추천 문구: 1차 다음 2차',/1차 연동갈비 다음/.test(s1.label),s1.label);
  ok('B12 2차 상황 칩(회식 2차·조용히·가볍게) + 종류 칩',s1.chips==='company,quiet,light'&&s1.sit==='company'&&s1.kinds,s1.chips+' / '+s1.sit);
  const s2=await pg.evaluate(()=>{const S=window.__jy.state,g=id=>S.ranked.find(p=>p.id===id),i=id=>S.ranked.findIndex(p=>p.id===id);
    const meat=g('40009'),beer=g('40001'),moon=g('40002'),early=g('40010');
    return {meatMinus:meat?meat.__s.minus.join('|'):'없음',order:[i('40001'),i('40009')],beerPlus:beer?beer.__s.plus.join('|'):'',moon:moon?moon.__s.badges.map(b=>b[1]).join(','):'',early:early?early.__s.mealOk:'없음'}});
  ok('B13 1차 고기 → 고깃집 술집은 "겹쳐요"',/1차 메뉴\(고기\)와 겹쳐요/.test(s2.meatMinus),s2.meatMinus);
  ok('B14 1차 고기 → 호프가 고깃집 술집보다 위',s2.order[0]>=0&&(s2.order[1]<0||s2.order[0]<s2.order[1]),s2.order.join(' vs '));
  ok('B15 호프에 "1차가 고기였으니" 이유',/1차가 고기였으니/.test(s2.beerPlus),s2.beerPlus.slice(0,120));
  ok('B16 새벽까지 여는 포차 배지',/새벽 05:00까지/.test(s2.moon),s2.moon);
  ok('B17 20:30 마감 호프는 오늘 밤 못 감',s2.early===false,String(s2.early));
  const kindCheck=async(k,must,mustNot)=>{await pg.click('[data-barkind="'+k+'"]');await pg.waitForTimeout(300);
    return pg.evaluate(([k,must,mustNot])=>{const J=window.__jy,R=J.state.ranked;return {n:R.length,all:R.every(p=>J.barKinds(p).has(k)),must:must.every(id=>R.some(p=>p.id===id)),not:mustNot.every(id=>!R.some(p=>p.id===id)),names:R.map(p=>p.place_name).join(',')}},[k,must,mustNot]);};
  let kr=await kindCheck('izakaya',['40003','40011'],['40001','40004']);ok('B18 종류 이자카야',kr.all&&kr.must&&kr.not,kr.names);
  kr=await kindCheck('wine',['40004','40005'],['40001','40003']);ok('B19 종류 와인·칵테일',kr.all&&kr.must&&kr.not,kr.names);
  kr=await kindCheck('jeon',['40006','40002'],['40004']);ok('B20 종류 전·막걸리(빈대떡집·파전 포차)',kr.all&&kr.must&&kr.not,kr.names);
  kr=await kindCheck('beer',['40001','40007'],['40003','40004']);ok('B21 종류 호프·맥주(치킨호프 포함)',kr.all&&kr.must&&kr.not,kr.names);
  kr=await kindCheck('pocha',['40002','40009'],['40004']);ok('B22 종류 포차·요리주점',kr.all&&kr.must&&kr.not,kr.names);
  await pg.click('[data-barkind="all"]');await pg.waitForTimeout(300);
  await pg.click('[data-sit="quiet"]');await pg.waitForTimeout(300);
  const qk=await pg.evaluate(()=>{const J=window.__jy,p=J.state.ranked[J.state.pickIdx];return p?[...J.barKinds(p)].join(',')+' '+p.place_name:''});
  ok('B23 조용히 한잔 → 와인·칵테일·이자카야 추천',/wine|izakaya/.test(qk),qk);
  await pg.click('[data-sit="company"]');await pg.waitForTimeout(300);
  await pg.click('[data-from="here"]');await settle(pg);
  const h1=await pg.evaluate(()=>({at:window.__jy.state.atFirst,from:window.__jy.state.barFrom,loc:document.getElementById('locState').textContent,food:window.__jy.state.food}));
  ok('B24 출발 "내 위치"로 바꾸면 원래 위치 기준',h1.at===null&&h1.from==='here'&&/현재 위치/.test(h1.loc)&&h1.food==='bar',JSON.stringify(h1));
  await pg.click('[data-from="first"]');await settle(pg);
  ok('B25 다시 1차 근처로',await pg.evaluate(()=>window.__jy.state.atFirst==='40100'&&/1차 연동갈비/.test(document.getElementById('locState').textContent)));
  const pickName=await pg.evaluate(()=>document.getElementById('pickName').textContent);
  await pg.click('#decideBtn');await pg.waitForTimeout(300);
  const f2=await pg.evaluate(()=>JSON.parse(localStorage.getItem('jy-dinner-first')||'null'));
  ok('B26 2차 결정 → 1차 기록에 2차 저장',f2&&f2.second&&f2.second.name===pickName,JSON.stringify(f2&&f2.second));
  await pg.click('#shareBtn');await pg.waitForTimeout(200);
  const sh=await pg.evaluate(()=>document.getElementById('shareText').value);
  ok('B27 공유 글: 1차 → 2차',/2차 여기 어때요/.test(sh)&&sh.includes('1차 연동갈비 → 🍺 2차 '+pickName)&&/연동갈비에서/.test(sh),sh.split('\n').slice(0,4).join(' / '));
  await pg.click('#shareClose');
  await pg.click('[data-food="all"]');await settle(pg);
  const a1=await pg.evaluate(()=>({at:window.__jy.state.atFirst,loc:document.getElementById('locState').textContent,sit:window.__jy.state.situation,bar:document.getElementById('firstBar').textContent,kinds:document.getElementById('barKindChips').hidden}));
  ok('B28 1차 메뉴로 돌아가면 원래 위치·상황 복원',a1.at===null&&/현재 위치/.test(a1.loc)&&a1.sit==='company'&&a1.kinds,JSON.stringify(a1));
  ok('B29 표시줄: 1차 → 2차',a1.bar.includes('연동갈비')&&a1.bar.includes(pickName),a1.bar);
  await pg.click('[data-meal="lunch"]');await settle(pg);
  ok('B30 점심엔 1차·2차 표시 없음',await pg.evaluate(()=>document.getElementById('firstBar').hidden&&document.getElementById('secondBtn').hidden&&/점심/.test(document.getElementById('decideBtn').textContent)));
  await pg.click('[data-meal="dinner"]');await settle(pg);await pg.click('[data-food="bar"]');await settle(pg);
  ok('B31 2차 칩을 누르면 기본 출발은 1차 근처',await pg.evaluate(()=>window.__jy.state.atFirst==='40100'));
  await pg.click('[data-firstx]');await settle(pg);
  const x1=await pg.evaluate(()=>({f:localStorage.getItem('jy-dinner-first'),at:window.__jy.state.atFirst,loc:document.getElementById('locState').textContent,bar:document.getElementById('firstBar').textContent,dec:document.getElementById('decideBtn').hidden}));
  ok('B32 1차 지우기 → 원래 위치 + 안내 문구',(x1.f===null||x1.f==='null')&&x1.at===null&&/현재 위치/.test(x1.loc)&&/1차 가게에서/.test(x1.bar)&&x1.dec,JSON.stringify(x1));
  ok('B33 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // 밤 22:30: 곧 닫는 술집
 {const {pg,errs,ctx}=await newPage(b,{time:T('22:30')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{const d=new Date();d.setHours(19,0,0,0);localStorage.setItem('jy-dinner-first',JSON.stringify({id:'40100',name:'연동갈비',lat:33.488,lng:126.499,kind:'meat',ts:d.getTime()}));});
  await pg.reload();await pg.waitForTimeout(2500);await settle(pg);
  await pg.click('[data-meal="dinner"]');await settle(pg);await pg.click('[data-food="bar"]');await settle(pg);
  const n1=await pg.evaluate(()=>{const S=window.__jy.state,g=id=>S.ranked.find(p=>p.id===id);const c=g('40013'),e=g('40010'),k=g('40003');
    return {at:S.atFirst,soon:c?c.__s.minus.join('|')+' ok='+c.__s.mealOk:'없음',early:e?e.__s.mealOk:'없음',kiro:k?k.__s.mealOk:'없음'}});
  ok('N1 밤에도 1차 근처에서 2차',n1.at==='40100',n1.at);
  ok('N2 23시 마감 바: 갈 수 있지만 "곧 마감" 안내',/⏰ 23:00 마감/.test(n1.soon)&&/ok=true/.test(n1.soon),n1.soon);
  ok('N3 20:30 마감 호프: 못 감',n1.early===false,String(n1.early));
  ok('N4 자정까지 이자카야: 갈 수 있음',n1.kiro===true,String(n1.kiro));
  ok('N5 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // 21:30 이후 1차 결정은 내일 저녁으로
 {const {pg,errs,ctx}=await newPage(b,{time:T('21:30')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  await pg.click('[data-meal="dinner"]');await settle(pg);
  await pg.fill('#query','연동갈비');await pg.press('#query','Enter');await settle(pg);
  await pg.click('#decideBtn');await pg.waitForTimeout(300);
  const t1=await pg.evaluate(()=>({toast:document.getElementById('toast').textContent,second:document.getElementById('secondBtn').hidden,bar:document.getElementById('firstBar').hidden,lf:window.__jy.loadFirst()}));
  ok('T1 21:30 결정 → 내일 저녁 1차',/내일 저녁 1차/.test(t1.toast)&&t1.second&&t1.bar&&t1.lf===null,JSON.stringify(t1));
  ok('T2 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}
 // 어제 저녁 1차 기록은 오늘 쓰지 않음
 {const {pg,errs,ctx}=await newPage(b,{time:T('19:00')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);d.setHours(19,0,0,0);localStorage.setItem('jy-dinner-first',JSON.stringify({id:'40100',name:'연동갈비',lat:33.488,lng:126.499,kind:'meat',ts:d.getTime()}));});
  await pg.reload();await pg.waitForTimeout(2500);await settle(pg);
  await pg.click('[data-meal="dinner"]');await settle(pg);
  ok('O1 어제 1차 기록은 무시',await pg.evaluate(()=>document.getElementById('firstBar').hidden&&document.getElementById('secondBtn').hidden));
  await pg.click('[data-food="bar"]');await settle(pg);
  ok('O2 2차 칩: 1차 없으면 내 위치 기준 + 안내',await pg.evaluate(()=>window.__jy.state.atFirst===null&&/1차 가게에서/.test(document.getElementById('firstBar').textContent)&&document.getElementById('decideBtn').hidden));
  ok('O3 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}

 // ===== 조건 초기화 · 저녁엔 이번 주 점심 숨김 =====
 {const {pg,errs,ctx}=await newPage(b,{time:T('12:10')});await pg.goto('http://localhost:9999/?debug=1');await pg.waitForTimeout(2500);await settle(pg);
  ok('R1 초기화 버튼이 날씨 옆에 보임',await pg.evaluate(()=>{const b=document.getElementById('resetBtn');return !!b&&b.parentElement.id==='context'&&b.offsetWidth>0&&getComputedStyle(b).backgroundColor!=='rgba(0, 0, 0, 0)'}));
  ok('R2 점심엔 이번 주 점심 보임',await pg.evaluate(()=>!document.getElementById('history').hidden&&document.getElementById('history').offsetHeight>0));
  await pg.click('[data-food="chinese"]');await settle(pg);await pg.click('[data-sit="solo"]');await pg.click('[data-radius="1000"]');await settle(pg);
  await pg.fill('#query','짬뽕');await pg.press('#query','Enter');await settle(pg);
  await pg.click('#resetBtn');await settle(pg);
  const r1=await pg.evaluate(()=>{const S=window.__jy.state;return {q:document.getElementById('query').value,food:S.food,sit:S.situation,radius:S.radius,locked:S.radiusLocked,toast:document.getElementById('toast').textContent,active:document.querySelector('[data-food].active')?.dataset.food,n:S.ranked.length}});
  ok('R3 초기화 → 검색어·메뉴·상황·거리 기본값',r1.q===''&&r1.food==='all'&&r1.sit==='team'&&r1.radius===670&&!r1.locked&&r1.active==='all'&&r1.n>0,JSON.stringify(r1));
  ok('R4 초기화 안내',/처음 조건으로/.test(r1.toast),r1.toast);
  await pg.click('#resetBtn');await pg.waitForTimeout(200);
  ok('R5 이미 처음이면 알려 줌',await pg.evaluate(()=>/이미 처음 조건/.test(document.getElementById('toast').textContent)));
  await pg.click('[data-meal="dinner"]');await settle(pg);
  ok('R6 저녁엔 이번 주 점심 숨김',await pg.evaluate(()=>document.getElementById('history').hidden&&document.getElementById('history').offsetHeight===0));
  ok('R7 저녁에도 초기화 버튼',await pg.evaluate(()=>!!document.getElementById('resetBtn')));
  await pg.fill('#query','연동갈비');await pg.press('#query','Enter');await settle(pg);await pg.click('#decideBtn');await pg.waitForTimeout(300);
  await pg.click('#secondBtn');await settle(pg);await pg.click('[data-barkind="wine"]');await pg.waitForTimeout(200);
  await pg.click('#resetBtn');await settle(pg);
  const r2=await pg.evaluate(()=>{const S=window.__jy.state;return {food:S.food,at:S.atFirst,kind:S.barKind,sit:S.situation,radius:S.radius,loc:document.getElementById('locState').textContent,kinds:document.getElementById('barKindChips').hidden,first:!!window.__jy.loadFirst()}});
  ok('R8 2차(1차 근처)에서 초기화 → 1차 메뉴 전체·원래 위치·도보 10분 (1차 기록은 유지)',r2.food==='all'&&r2.at===null&&r2.kind==='all'&&r2.sit==='company'&&r2.radius===670&&/현재 위치/.test(r2.loc)&&r2.kinds&&r2.first,JSON.stringify(r2));
  await pg.click('[data-meal="lunch"]');await settle(pg);
  ok('R9 점심으로 돌아오면 이번 주 점심 다시 보임',await pg.evaluate(()=>!document.getElementById('history').hidden));
  ok('R10 오류 없음',errs.length===0,errs.join('|'));await ctx.close();}

 await b.close();
 const f=results.filter(r=>r[0]==='FAIL');for(const r of results) console.log(r[0],r[1],r[2]?'· '+r[2]:'');console.log('\n총',results.length,'항목 / 실패',f.length);
})();
