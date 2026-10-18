// 임시 점검: 배포된 앱이 지금 실제로 제대로 동작하는지 (실제 카카오·평점 서버·도보 경로)
const {chromium}=require('playwright');
const SITE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/';
const R=[];const ok=(n,c,i='')=>{R.push([c?'PASS':'FAIL',n,i]);console.log((c?'PASS ':'FAIL ')+n+(i?' · '+i:''));};
(async()=>{
 const b=await chromium.launch();
 // 1) 페이지·파일
 for(const [path,re,name] of [['','data-app-version','앱 첫 화면'],['about.html','다른 앱과 뭐가 달라요','배포 안내 페이지'],['install.html','about.html','설치 주소 → 안내 페이지'],['sw.js','jigeum-yeogi-matjib-v','서비스워커'],['manifest.json','지금 여기','앱 설치 정보']]){
   const r=await fetch(SITE+path+'?t='+Date.now());const t=await r.text();ok('파일 '+name+' ('+(path||'/')+')',r.ok&&t.includes(re),r.status+' '+(t.match(/data-app-version="[^"]+"|v\d+'/)||[''])[0]);}
 const run=async(label,time,fn)=>{
  const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
  const pg=await ctx.newPage();if(time) await pg.clock.setFixedTime(new Date(time));
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|Failed to load resource/.test(m.text()))errs.push('console:'+m.text().slice(0,120))});
  await pg.goto(SITE+'?debug=1');await pg.waitForTimeout(6000);
  const settle=async()=>{for(let i=0;i<300;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(800);};
  await settle();
  console.log('\n######## '+label);
  await fn(pg,settle);
  ok(label+' · 화면 오류 없음',errs.length===0,errs.slice(0,3).join(' | '));
  await ctx.close();
 };
 const info=pg=>pg.evaluate(()=>{const S=window.__jy.state;const R=S.ranked;return {n:R.length,rated:R.filter(p=>p.__rating!=null).length,hours:R.filter(p=>p.__hours).length,down:S.ratingsDown,routed:R.filter(p=>!p.__est).length,sum:document.getElementById('summary').textContent,pick:document.getElementById('pickLabel').textContent+' '+document.getElementById('pickName').textContent,loc:document.getElementById('locState').textContent,top:R.slice(0,3).map(p=>p.place_name+'('+(p.__rating??'-')+')').join(', ')}});
 // 2) 지금 이 시각 그대로
 await run('지금 시각(실제) · 도청',null,async(pg,settle)=>{
   const v=await pg.evaluate(()=>document.body.dataset.appVersion);ok('배포 버전',/stagetabs/.test(v),v);
   ok('카카오 지도 불러옴',await pg.evaluate(()=>!!(window.kakao&&kakao.maps&&kakao.maps.services)));
   const a=await info(pg);console.log(JSON.stringify(a));
   ok('위치 → 도청 근처 추천 나옴',a.n>0&&/현재 위치/.test(a.loc),a.loc+' · '+a.n+'곳');
   ok('평점 서버 동작 (평점 붙은 가게)',!a.down&&a.rated>=Math.min(5,a.n),'평점 '+a.rated+'/'+a.n+(a.down?' · 서버 멈춤':''));
   ok('영업시간 정보 받아 옴',a.hours>=Math.min(3,a.n),a.hours+'/'+a.n);
   ok('도보 경로 계산',a.routed>0,'길 따라 잰 곳 '+a.routed+'/'+a.n+' (나머지는 직선 추정)');
 });
 // 3) 월요일 점심
 await run('월 12:10 점심',"2026-10-19T12:10:00+09:00",async(pg,settle)=>{
   const a=await info(pg);console.log(JSON.stringify(a));ok('점심 추천',a.n>=10&&/오늘/.test(a.pick),a.n+'곳 · '+a.pick+' · '+a.top);
   for(const f of ['korean','soup','chinese','japanese','western','snack','cafe','haejang']){await pg.click('[data-food="'+f+'"]');await settle();const x=await info(pg);ok('점심 칩 '+f,x.n>0,x.n+'곳 · '+x.top);}
   await pg.click('[data-food="all"]');await settle();
   for(const q of ['돈까스','고기국수','짬뽕']){await pg.fill('#query',q);await pg.press('#query','Enter');await settle();
     const x=await pg.evaluate(()=>{const R=window.__jy.state.ranked;return {n:R.length,bad:R.filter(p=>!p.__qHit&&!p.__named).length,top:R.slice(0,3).map(p=>p.place_name).join(', ')}});ok('검색 "'+q+'"',x.n>0&&x.bad===0,x.n+'곳 · '+x.top);}
   await pg.fill('#query','');await pg.press('#query','Enter');await settle();
   await pg.click('#resetBtn');await settle();ok('조건 초기화 버튼',await pg.evaluate(()=>window.__jy.state.food==='all'));
 });
 // 4) 월요일 저녁 1차 → 2차
 await run('월 19:00 저녁 1차→2차',"2026-10-19T19:00:00+09:00",async(pg,settle)=>{
   await pg.click('[data-meal="dinner"]');await settle();
   ok('저녁: 이번 주 점심 숨김 · 1차/2차 탭',await pg.evaluate(()=>document.getElementById('history').hidden&&!document.getElementById('stageTabs').hidden));
   const a=await info(pg);ok('저녁 1차 추천',a.n>=10,a.n+'곳 · '+a.top);
   for(const f of ['meat','blackpork','sea','jokbal','chicken','stew','chinese']){await pg.click('[data-food="'+f+'"]');await settle();const x=await info(pg);ok('1차 칩 '+f,x.n>0,x.n+'곳 · '+x.top);}
   await pg.click('[data-food="all"]');await settle();
   await pg.fill('#query','돌돌이숯불갈비');await pg.press('#query','Enter');await settle();
   const nm=await pg.evaluate(()=>document.getElementById('pickName').textContent);ok('1차 가게 찾기',/돌돌이/.test(nm),nm);
   await pg.click('#decideBtn');await pg.waitForTimeout(400);
   ok('1차 결정 → 2차 버튼',await pg.evaluate(()=>!document.getElementById('secondBtn').hidden));
   await pg.click('#secondBtn');await settle();
   const s=await pg.evaluate(()=>{const J=window.__jy,S=J.state;return {at:!!S.atFirst,n:S.ranked.length,bad:S.ranked.filter(p=>!J.isBarPlace(p)).length,loc:document.getElementById('locState').textContent,tab:document.querySelector('[data-stage].on')?.dataset.stage,row:document.getElementById('foodChips').hidden,top:S.ranked.slice(0,4).map(p=>p.place_name+' '+Math.round(p.distance)+'m').join(', '),pick:document.getElementById('pickLabel').textContent}});
   ok('2차: 1차 가게 근처 술집',s.at&&s.n>0&&s.bad===0&&/1차/.test(s.loc)&&s.tab==='2'&&s.row,s.n+'곳 · '+s.top);
   for(const k of ['beer','pocha','izakaya','wine']){await pg.click('[data-barkind="'+k+'"]');await pg.waitForTimeout(400);const n=await pg.evaluate(()=>window.__jy.state.ranked.length);ok('2차 종류 '+k,n>=0,n+'곳');}
   await pg.click('[data-barkind="all"]');
   await pg.click('#shareBtn');await pg.waitForTimeout(300);ok('공유 글: 1차 → 2차',await pg.evaluate(()=>/1차 돌돌이.*→ 🍺 2차/.test(document.getElementById('shareText').value)));
   await pg.click('#shareClose');
   await pg.click('[data-stage="1"]');await settle();ok('1차 탭으로 복귀 · 원래 위치',await pg.evaluate(()=>!window.__jy.state.atFirst&&/현재 위치/.test(document.getElementById('locState').textContent)));
 });
 // 5) 지역 검색
 await run('지역 검색 구좌읍 · 월 12:10',"2026-10-19T12:10:00+09:00",async(pg,settle)=>{
   await pg.fill('#locationQuery','구좌읍');await pg.press('#locationQuery','Enter');await pg.waitForTimeout(1500);await settle();
   const a=await info(pg);ok('구좌읍 전체 추천',a.n>0&&/구좌/.test(a.loc),a.loc+' · '+a.n+'곳 · '+a.top);
   await pg.fill('#locationQuery','서귀포시청');await pg.press('#locationQuery','Enter');await pg.waitForTimeout(1500);await settle();
   const c=await info(pg);ok('서귀포시청 기준 추천',c.n>0&&/서귀포/.test(c.loc),c.loc+' · '+c.n+'곳 · '+c.top);
 });
 const f=R.filter(r=>r[0]==='FAIL');console.log('\n총 '+R.length+'개 점검 · 실패 '+f.length+(f.length?'\n'+f.map(x=>'  ✗ '+x[1]+' · '+x[2]).join('\n'):''));
 await b.close();
})();
