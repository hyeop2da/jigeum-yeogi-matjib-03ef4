// 임시 점검: 2차 술집의 실제 카카오 분류·영업시간·메뉴 분포
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
const H={"Accept":"application/json","pf":"web","appVersion":"6.6.0","Origin":"https://place.map.kakao.com","Referer":"https://place.map.kakao.com/","User-Agent":"Mozilla/5.0"};
const panel=async id=>{try{const r=await fetch('https://place-api.map.kakao.com/places/panel3/'+id,{headers:H});const d=await r.json();const m=d.menu||{};
  const a=(Array.isArray(m.menus)?m.menus:(m.menus?.items||[])).map(x=>x.name).slice(0,8);
  const per=d.open_hours?.week_from_today?.week_periods||[];const days=[];per.forEach(p=>(p.days||[]).forEach(x=>days.push((x.day_of_the_week_desc||'').slice(0,6)+' '+(x.on_days?.start_end_time_desc||x.off_days_desc||'-'))));
  return {menu:a.join(','),hours:days.slice(0,3).join(' / '),rating:d.kakaomap_review?.score_set?.average_score,cnt:d.kakaomap_review?.score_set?.review_count,blog:d.blog_review?.review_count}}catch(e){return {err:e.message}}};
const LOCS={도청:[33.48892,126.49836],노형:[33.4838,126.4787],제주시청:[33.4996,126.5312],서귀포:[33.2496,126.5620]};
const QS=['술집','호프','이자카야','포차','실내포차','요리주점','와인바','칵테일바','막걸리','전집','펍','맥주','이자카야 사케','바','주점','노가리','닭강정 맥주','통닭'];
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
 const pg=await ctx.newPage();await pg.goto(BASE);await pg.waitForTimeout(6000);
 const all=new Map();const perQ={};
 for(const [ln,[la,lo]] of Object.entries(LOCS)){
  for(const q of QS){
   const rows=await pg.evaluate(([q,la,lo])=>new Promise(res=>{const ps=new kakao.maps.services.Places();const out=[];let page=0;
     ps.keywordSearch(q,(d,s,pg)=>{(d||[]).forEach(p=>out.push({id:p.id,n:p.place_name,c:p.category_name,g:p.category_group_code,dist:+p.distance}));if(pg&&pg.hasNextPage&&++page<3)pg.nextPage();else res(out);},{location:new kakao.maps.LatLng(la,lo),radius:1500,sort:kakao.maps.services.SortBy.DISTANCE,size:15});}),[q,la,lo]);
   perQ[ln+'|'+q]=rows.length;
   rows.forEach(r=>{const k=r.id;if(!all.has(k))all.set(k,Object.assign(r,{qs:new Set(),loc:ln}));all.get(k).qs.add(q);});
  }
 }
 console.log('### 검색어별 결과 수');Object.entries(perQ).forEach(([k,v])=>console.log(k,v));
 const cat={};for(const r of all.values()){cat[r.c]=(cat[r.c]||0)+1;}
 console.log('\n### 분류별 가게 수 (전체 '+all.size+')');Object.entries(cat).sort((a,b)=>b[1]-a[1]).forEach(([c,n])=>console.log(n,c));
 // '술집' 한 단어로 못 찾는 술집
 const bars=[...all.values()].filter(r=>/술집|주점|호프|포장마차|이자카야|칵테일|와인|바\(BAR\)|펍/.test(r.c));
 console.log('\n### 술집 분류인데 "술집" 검색에는 안 나온 곳: '+bars.filter(r=>!r.qs.has('술집')).length+' / '+bars.length);
 bars.filter(r=>!r.qs.has('술집')).slice(0,40).forEach(r=>console.log(r.loc,r.n,'|',r.c,'| 걸린 검색어:',[...r.qs].join(',')));
 console.log('\n### 술집 아닌 분류로 술 검색어에 걸린 곳 (샘플)');
 [...all.values()].filter(r=>!/술집|주점|호프|포장마차|이자카야|칵테일|와인|바\(BAR\)|펍/.test(r.c)).slice(0,60).forEach(r=>console.log(r.loc,r.n,'|',r.c,'|',[...r.qs].join(',')));
 console.log('\n### 도청·노형 술집 상세 샘플');
 let k=0;for(const r of bars){if(!/도청|노형/.test(r.loc))continue;if(k++>=45)break;const p=await panel(r.id);console.log(r.n,'|',r.c,'|',Math.round(r.dist)+'m','| ★',p.rating,'('+p.cnt+') 블로그',p.blog,'\n   메뉴:',p.menu,'\n   시간:',p.hours);}
 await b.close();
})();
