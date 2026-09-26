// 임시 점검: 사용자가 본 '돈까스' 검색 결과(재현이네갈비·육남매·넝쿨하늘연동)를 실제 데이터로 재현
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
const H={"Accept":"application/json","pf":"web","appVersion":"6.6.0","Origin":"https://place.map.kakao.com","Referer":"https://place.map.kakao.com/","User-Agent":"Mozilla/5.0"};
const panel=async id=>{try{const r=await fetch('https://place-api.map.kakao.com/places/panel3/'+id,{headers:H});const d=await r.json();const m=d.menu||{};
  const a=(Array.isArray(m.menus)?m.menus:(m.menus?.items||[])).map(x=>x.name);const y=(m.yogiyo_menus?.items||[]).map(x=>x.name);
  return 'status '+r.status+'\n   매장: '+a.join(',')+'\n   요기요: '+y.join(',')+'\n   키: '+Object.keys(d).join(',')+'\n   메뉴키: '+Object.keys(m).join(',')}catch(e){return 'ERR '+e.message}};
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
 const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date('2026-09-26T10:58:00+09:00'));
 const logs=[];pg.on('console',m=>logs.push(m.text()));pg.on('response',r=>{if(/api|relay|vercel/.test(r.url())&&!/kakao/.test(r.url()))logs.push('RESP '+r.status()+' '+r.url().slice(0,120));});
 await pg.goto(BASE);await pg.waitForTimeout(6000);
 const settle=async()=>{for(let i=0;i<300;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(800);};
 await settle();console.log('버전',await pg.evaluate(()=>document.body.dataset.appVersion));
 await pg.click('[data-radius="1000"]');await settle();
 for(let k=0;k<2;k++){
  await pg.fill('#query','돈까스');await pg.press('#query','Enter');await settle();
  const r=await pg.evaluate(()=>({sum:document.getElementById('summary').textContent,rows:window.__jy.state.ranked.map(p=>[p.id,p.place_name,p.category_name,p.__qText,p.__qMain,p.__qMenu,p.__menu,p.distance].join(' | '))}));
  console.log('\n### 돈까스 #'+k+' '+r.sum);r.rows.forEach(x=>console.log(x));
  await pg.fill('#query','');await pg.press('#query','Enter');await settle();
 }
 const ids=await pg.evaluate(()=>new Promise(res=>{const ps=new kakao.maps.services.Places();const out=[];let n=0;const names=['재현이네갈비','육남매','넝쿨하늘연동','몽땅하우스'];
   names.forEach(q=>ps.keywordSearch(q,(d,s)=>{(d||[]).slice(0,2).forEach(p=>out.push([p.id,p.place_name,p.category_name,p.address_name]));if(++n===names.length)res(out);},{location:new kakao.maps.LatLng(33.48892,126.49836),radius:5000}))}));
 for(const [id,n,c,a] of ids){console.log('\n## '+n+' ('+id+') '+c+' '+a+'\n   '+await panel(id));}
 console.log('\n로그:\n'+logs.slice(-30).join('\n'));
 await b.close();
})();
