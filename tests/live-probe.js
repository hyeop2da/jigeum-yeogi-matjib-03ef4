// 임시 점검: 배포본에서 메뉴 검색 순서·표시를 실제 데이터로 확인
const {chromium}=require('playwright');
const BASE='https://hyeop2da.github.io/jigeum-yeogi-matjib-03ef4/?debug=1';
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({timezoneId:'Asia/Seoul',permissions:['geolocation'],geolocation:{latitude:33.48892,longitude:126.49836}});
 const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date('2026-09-28T11:40:00+09:00'));
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(BASE);await pg.waitForTimeout(6000);
 const settle=async()=>{for(let i=0;i<300;i++){await pg.waitForTimeout(100);const st=await pg.evaluate(()=>({b:document.body.classList.contains('busy'),w:document.getElementById('summary').textContent.includes('확인 중')}));if(!st.b&&!st.w)break;}await pg.waitForTimeout(800);};
 await settle();console.log('버전',await pg.evaluate(()=>document.body.dataset.appVersion));
 await pg.click('[data-radius="1000"]');await settle();
 const dump=async t=>{const r=await pg.evaluate(()=>({sum:document.getElementById('summary').textContent,rows:window.__jy.state.ranked.map((p,i)=>{const c=document.querySelector('.card[data-index="'+i+'"]');return (i+1)+'. '+(p.__qText?'[전문]':p.__qMain?'[대표]':p.__qMenu?'[곁들이]':'')+' '+p.place_name+' ['+(c?c.querySelector('.cat').textContent:'')+'] '+p.category_name})}));
   console.log('\n### '+t+' | '+r.sum);r.rows.forEach(x=>console.log(x));};
 await dump('점심 전체');
 for(const q of ['돈까스','냉면','칼국수','갈비탕','짬뽕','초밥','회','김밥']){await pg.fill('#query',q);await pg.press('#query','Enter');await settle();await dump('검색 '+q);}
 console.log('\n오류: '+(errs.join(' | ')||'없음'));
 await b.close();
})();
