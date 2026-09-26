// 임시 점검: 메뉴 검색이 어떤 메뉴(매장/요기요)로 걸렸는지, 분류가 무엇인지 실제 데이터로 확인
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
const H={"Accept":"application/json","pf":"web","appVersion":"6.6.0","Origin":"https://place.map.kakao.com","Referer":"https://place.map.kakao.com/","User-Agent":"Mozilla/5.0"};
const panel=async id=>{try{const r=await fetch('https://place-api.map.kakao.com/places/panel3/'+id,{headers:H});const d=await r.json();const m=d.menu||{};
  const a=(Array.isArray(m.menus)?m.menus:(m.menus?.items||[])).map(x=>x.name);const y=(m.yogiyo_menus?.items||[]).map(x=>x.name);
  return {store:a.join(','),yogiyo:y.join(','),cat:JSON.stringify(d.summary?.category||d.basic_info?.category||'')}}catch(e){return {err:e.message}}};
const QS=(process.env.QUERIES||'돈까스,짬뽕,파스타,김밥,초밥,회,고기국수,냉면,칼국수,쌀국수,피자,햄버거,떡볶이,갈비탕,순대국').split(',');
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
 const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date('2026-09-28T10:58:00+09:00'));
 await pg.goto(BASE);await pg.waitForTimeout(6000);
 const settle=async()=>{for(let i=0;i<200;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(400);};
 await settle();await pg.click('[data-radius="1000"]');await settle();
 const all=await pg.evaluate(()=>window.__jy.state.ranked.map(p=>({id:p.id,n:p.place_name,c:p.category_name,t:window.__jy.catText(p),m:p.__menu})));
 console.log('### 점심 전체 1km 분류');for(const p of all) console.log(p.n,'|',p.c,'| 표시:',p.t,'| 메뉴:',p.m);
 for(const q of QS){await pg.fill('#query',q);await pg.press('#query','Enter');await settle();
  const r=await pg.evaluate(()=>window.__jy.state.ranked.map(p=>({id:p.id,n:p.place_name,c:p.category_name,txt:!!p.__qText,main:!!p.__qMain,menu:!!p.__qMenu,m:p.__menu})));
  console.log('\n### 검색 "'+q+'" '+r.length+'곳');
  for(const p of r){const pn=(p.menu)?await panel(p.id):null;console.log((p.txt?'[이름/분류]':p.main?'[대표메뉴]':'[곁메뉴]'),p.n,'|',p.c,'| 메뉴:',p.m,pn?'\n      매장메뉴: '+pn.store+'\n      요기요: '+pn.yogiyo:'');}
 }
 await b.close();
})();
