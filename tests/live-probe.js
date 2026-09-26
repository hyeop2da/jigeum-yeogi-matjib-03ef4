// 임시 점검: 배포본 2차 기능을 실제 카카오 데이터로 확인
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
(async()=>{
 const b=await chromium.launch();
 const run=async(time,firstQ,label)=>{
  const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(time));
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE);await pg.waitForTimeout(6000);
  const settle=async()=>{for(let i=0;i<300;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(800);};
  await settle();console.log('\n\n######## '+label+' · 버전',await pg.evaluate(()=>document.body.dataset.appVersion));
  await pg.click('[data-meal="dinner"]');await settle();
  await pg.fill('#query',firstQ);await pg.press('#query','Enter');await settle();
  console.log('1차 후보:',await pg.evaluate(()=>document.getElementById('pickName').textContent+' / '+document.getElementById('pickMenu').textContent));
  await pg.click('#decideBtn');await pg.waitForTimeout(400);
  console.log('저장:',await pg.evaluate(()=>localStorage.getItem('jy-dinner-first')),'| 안내:',await pg.evaluate(()=>document.getElementById('toast').textContent));
  if(await pg.evaluate(()=>document.getElementById('secondBtn').hidden)){console.log('2차 버튼 없음');await ctx.close();return;}
  await pg.click('#secondBtn');await settle();
  const dump=async t=>{const r=await pg.evaluate(()=>{const J=window.__jy,S=J.state;return {sum:document.getElementById('summary').textContent,loc:document.getElementById('locState').textContent,pick:document.getElementById('pickLabel').textContent+' '+document.getElementById('pickName').textContent,
    why:[...document.querySelectorAll('#pickWhy li')].map(l=>l.textContent).join(' / '),
    rows:S.ranked.map((p,i)=>(i+1)+'. '+p.place_name+' ['+p.category_name.replace('음식점 > ','')+'] '+Math.round(p.distance)+'m 종류:'+[...J.barKinds(p)].join('+')+' | '+(p.__s.status?p.__s.status.text:'시간?')+(p.__s.mealOk===false?' ❌':'')+' | '+p.__s.badges.map(b=>b[1]).join(',')+' | '+p.__s.plus.concat(p.__s.minus).filter(x=>/1차|겹쳐|마감/.test(x)).join(',')+' | 메뉴:'+String(p.__menu||'').slice(0,40))}});
   console.log('\n### '+t+'\n위치: '+r.loc+'\n요약: '+r.sum+'\n추천: '+r.pick+'\n이유: '+r.why+'\n'+r.rows.join('\n'));};
  await dump('2차 전체 (1차 근처)');
  // '술집' 한 단어 검색만으로는 몇 곳이 잡히는지 비교
  const cov=await pg.evaluate(()=>new Promise(res=>{const S=window.__jy.state;const ps=new kakao.maps.services.Places();const ids=new Set();let page=0;
    ps.keywordSearch('술집',(d,s,pgn)=>{(d||[]).forEach(p=>ids.add(p.id));if(pgn&&pgn.hasNextPage&&++page<3)pgn.nextPage();else{const all=S.results.map(p=>p.id);res({all:all.length,only:all.filter(i=>ids.has(i)).length});}},{location:new kakao.maps.LatLng(S.lat,S.lng),radius:1000,sort:kakao.maps.services.SortBy.DISTANCE,size:15});}));
  console.log('\n검색 범위 비교: 지금 후보 '+cov.all+'곳 중 "술집" 한 단어 검색으로도 잡히는 곳 '+cov.only+'곳');
  for(const k of ['beer','pocha','izakaya','wine','jeon']){await pg.click('[data-barkind="'+k+'"]');await pg.waitForTimeout(400);
    console.log('종류 '+k+': '+await pg.evaluate(()=>window.__jy.state.ranked.map(p=>p.place_name).join(', ')||'(없음) '+document.querySelector('#list .empty')?.textContent));}
  await pg.click('[data-barkind="all"]');await pg.waitForTimeout(300);
  for(const s of ['quiet','light']){await pg.click('[data-sit="'+s+'"]');await pg.waitForTimeout(400);console.log('상황 '+s+' 추천: '+await pg.evaluate(()=>document.getElementById('pickName').textContent+' ('+[...window.__jy.barKinds(window.__jy.state.ranked[window.__jy.state.pickIdx]||{})].join('+')+')'));}
  await pg.click('[data-sit="company"]');
  await pg.click('[data-from="here"]');await settle();
  console.log('\n내 위치로: '+await pg.evaluate(()=>document.getElementById('locState').textContent+' · '+document.getElementById('summary').textContent));
  await pg.click('[data-from="first"]');await settle();
  await pg.click('#shareBtn');await pg.waitForTimeout(200);console.log('\n공유 글:\n'+await pg.evaluate(()=>document.getElementById('shareText').value));
  console.log('\n오류: '+(errs.join(' | ')||'없음'));
  await ctx.close();
 };
 await run('2026-10-02T19:00:00+09:00','돌돌이숯불갈비','금 19:00 · 1차 갈비(도청 근처)');
 await run('2026-10-02T22:30:00+09:00','만년호횟집','금 22:30 · 1차 횟집');
 await b.close();
})();
