// 실제 배포된 앱 + 실제 카카오 데이터로 여러 상황의 상위 10곳을 뽑아 사람이 눈으로 점검한다 (GitHub Actions 에서 실행)
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
const LOCS={도청:[33.48892,126.49836],서귀포:[33.2496,126.5620]};
const QUERIES=(process.env.QUERIES||'돈까스,짬뽕,파스타,김밥,초밥,고기국수,순대국,냉면,떡볶이,칼국수,갈비탕,쌀국수,흑돼지,커피,맥주,우진해장국').split(',');
(async()=>{
 const b=await chromium.launch();
 for(const [time,label,loc] of [['2026-09-28T11:40:00+09:00','도청 월 11:40','도청'],['2026-09-28T19:40:00+09:00','도청 월 19:40','도청'],['2026-09-28T12:10:00+09:00','서귀포 월 12:10','서귀포']]){
  const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:LOCS[loc][0],longitude:LOCS[loc][1]}});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(time));
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE);await pg.waitForTimeout(6000);
  const settle=async()=>{for(let i=0;i<200;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(400);};
  const dump=async(title)=>{await settle();const r=await pg.evaluate(()=>{const S=window.__jy.state;
     return {sum:document.getElementById('summary').textContent,pick:document.getElementById('pickLabel').textContent+' '+document.getElementById('pickName').textContent,why:[...document.querySelectorAll('#pickWhy li')].map(l=>l.textContent).join(' / '),
       top:S.ranked.slice(0,10).map((p,i)=>{const c=document.querySelector('.card[data-index="'+i+'"]');return (i+1)+'. '+p.place_name+' ['+(c?c.querySelector('.cat').textContent:'')+'] '+(c?c.querySelector('.rating').textContent:'')+' | '+(c&&c.querySelector('.hours')?c.querySelector('.hours').textContent:'영업시간?')+' | '+(c?c.querySelector('.distance').textContent:'')+(p.__qHit===false?' ❗검색어무관':'')+(c&&c.querySelector('.offtag')?' '+c.querySelector('.offtag').textContent:'')})};});
    console.log('\n### ['+label+'] '+title+'\n요약: '+r.sum+'\n추천: '+r.pick+'\n이유: '+r.why+'\n'+r.top.join('\n'));};
  const meal=async m=>{await pg.click('[data-meal="'+m+'"]');await settle();};
  await dump('점심 전체(팀 점심)');
  for(const f of ['korean','soup','chinese','japanese','western','snack','cafe','haejang']){await pg.click('[data-food="'+f+'"]');await dump('점심 칩 '+f);}
  await pg.click('[data-food="all"]');await pg.click('[data-sit="guest"]');await dump('점심 손님 모시기');await pg.click('[data-sit="team"]');
  for(const q of QUERIES){await pg.fill('#query',q);await pg.press('#query','Enter');await dump('검색 "'+q+'"');}
  await pg.fill('#query','');await meal('dinner');
  for(const f of ['all','meat','blackpork','sea','jokbal','chicken','stew','chinese','bar']){await pg.click('[data-food="'+f+'"]');await dump('저녁 칩 '+f);}
  await pg.click('[data-food="all"]');await pg.click('[data-radius="3000"]');await dump('저녁 전체 3km');
  console.log('\n오류: '+(errs.join(' | ')||'없음'));
  await ctx.close();
 }
 await b.close();
})();
// run 1790335576
