// 임시 점검: 연동 중심가(술집 밀집)에서 2차 후보가 '술집' 한 단어 검색보다 얼마나 넓게 잡히는지 + 밤 시간 판단
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
(async()=>{
 const b=await chromium.launch();
 for(const [time,label] of [['2026-10-02T20:30:00+09:00','금 20:30'],['2026-10-02T23:40:00+09:00','금 23:40']]){
  const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(time));
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE);await pg.waitForTimeout(3000);
  // 1차: 연동 바오젠거리 근처 고깃집이라고 가정
  await pg.evaluate(()=>{const d=new Date();d.setHours(19,0,0,0);localStorage.setItem('jy-dinner-first',JSON.stringify({id:'test1',name:'연동 1차',lat:33.4871,lng:126.4895,kind:'meat',ts:d.getTime()}));});
  await pg.reload();await pg.waitForTimeout(6000);
  const settle=async()=>{for(let i=0;i<300;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(800);};
  await settle();
  await pg.click('[data-meal="dinner"]');await settle();
  console.log('\n######## '+label+' · 버전 '+await pg.evaluate(()=>document.body.dataset.appVersion)+' · 저녁 화면에 이번 주 점심 숨김: '+await pg.evaluate(()=>document.getElementById('history').hidden)+' · 초기화 버튼: '+await pg.evaluate(()=>!!document.getElementById('resetBtn')));
  await pg.click('[data-food="bar"]');await settle();
  for(const r of [335,670,1000]){
   await pg.click('[data-radius="'+r+'"]');await settle();
   const out=await pg.evaluate(()=>new Promise(res=>{const J=window.__jy,S=J.state;const ps=new kakao.maps.services.Places();const ids=new Set();let page=0;
    ps.keywordSearch('술집',(d,s,pgn)=>{(d||[]).forEach(p=>ids.add(p.id));if(pgn&&pgn.hasNextPage&&++page<3)pgn.nextPage();else{
      const all=S.results;const miss=all.filter(p=>!ids.has(p.id));
      res({loc:document.getElementById('locState').textContent,sum:document.getElementById('summary').textContent,n:all.length,only:all.length-miss.length,miss:miss.slice(0,12).map(p=>p.place_name+'('+p.category_name.split('>').pop().trim()+')').join(', '),
        top:S.ranked.slice(0,8).map((p,i)=>(i+1)+'. '+p.place_name+' ['+[...J.barKinds(p)].join('+')+'] '+Math.round(p.distance)+'m '+(p.__s.status?p.__s.status.text:'시간?')+(p.__s.mealOk===false?' ❌':'')+' '+p.__s.badges.map(b=>b[1]).join(',')+' '+p.__s.plus.concat(p.__s.minus).filter(x=>/1차|겹쳐|마감/.test(x)).join(','))});}},{location:new kakao.maps.LatLng(S.lat,S.lng),radius:Math.max(S.radius,1000),sort:kakao.maps.services.SortBy.DISTANCE,size:15});}));
   console.log('\n### 반경 '+r+'m | '+out.loc+'\n요약: '+out.sum+'\n후보 '+out.n+'곳 중 "술집" 한 단어 검색으로 잡히는 곳 '+out.only+'곳 → 새 검색어로 더 찾은 곳 '+(out.n-out.only)+'곳: '+out.miss+'\n'+out.top.join('\n'));
  }
  for(const k of ['beer','pocha','izakaya','wine','jeon']){await pg.click('[data-barkind="'+k+'"]');await pg.waitForTimeout(400);
    console.log('종류 '+k+' ('+await pg.evaluate(()=>window.__jy.state.ranked.length)+'곳): '+await pg.evaluate(()=>window.__jy.state.ranked.slice(0,8).map(p=>p.place_name).join(', ')));}
  await pg.click('[data-barkind="all"]');
  await pg.click('#resetBtn');await settle();
  console.log('\n초기화 후: '+await pg.evaluate(()=>JSON.stringify({food:window.__jy.state.food,at:window.__jy.state.atFirst,radius:window.__jy.state.radius,loc:document.getElementById('locState').textContent})));
  console.log('오류: '+(errs.join(' | ')||'없음'));
  await ctx.close();
 }
 await b.close();
})();
