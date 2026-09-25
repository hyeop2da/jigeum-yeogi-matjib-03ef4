// 브라우저 안에서 돌아가는 단위 테스트 (window.__jy 사용)
window.__runUnits=function(){
const J=window.__jy, R=[];const t=(n,c,i='')=>R.push([c?'PASS':'FAIL',n,String(i)]);
const P=(name,cat,code)=>({id:'1',place_name:name,category_name:cat,category_group_code:code||(/카페|간식 > 제과/.test(cat)?'CE7':'FD6'),x:'126.5',y:'33.49',address_name:'제주특별자치도 제주시 구좌읍 김녕리 123'});
const L=k=>J.FOODS_LUNCH.find(f=>f[0]===k)[3], D=k=>J.FOODS_DINNER.find(f=>f[0]===k)[3];
const cases=[
 ['점심 한식: 국밥집',L('korean'),P('옛날국밥','음식점 > 한식 > 국밥'),true],
 ['점심 국밥·국수: 국수집',L('soup'),P('대박국수','음식점 > 한식 > 국수'),true],
 ['점심 국밥·국수: 김밥집 아님',L('soup'),P('고슬','음식점 > 분식'),false],
 ['점심 중식: 짬뽕집',L('chinese'),P('짬뽕에취한날','음식점 > 중식 > 중국요리'),true],
 ['점심 중식: 양꼬치 제외',L('chinese'),P('경성숯불양꼬치','음식점 > 중식 > 양꼬치'),false],
 ['점심 일식·회: 초밥',L('japanese'),P('스시이케','음식점 > 일식 > 초밥,롤'),true],
 ['점심 일식·회: 이자카야 제외',L('japanese'),P('키로','음식점 > 술집 > 일본식주점'),false],
 ['점심 일식·회: 동네 횟집',L('japanese'),P('싱싱바다횟집','음식점 > 한식 > 해물,생선 > 회'),true],
 ['점심 일식·회: 김밥상회 제외',L('japanese'),P('김밥상회','음식점 > 분식'),false],
 ['점심 일식·회: 돈까스',L('japanese'),P('카도돈카츠','음식점 > 일식 > 돈까스,우동'),true],
 ['점심 양식: 피자',L('western'),P('빅컷피자','음식점 > 양식 > 피자'),true],
 ['점심 양식: 멕시카나치킨 제외',L('western'),P('멕시카나치킨','음식점 > 치킨 > 멕시카나치킨'),false],
 ['점심 양식: 멕시칸 타코',L('western'),P('타코봉','음식점 > 양식 > 멕시칸,브라질'),true],
 ['점심 분식: 떡볶이',L('snack'),P('배떡','음식점 > 분식 > 떡볶이'),true],
 ['점심 카페·빵: 카페',L('cafe'),P('커피비터스윗','음식점 > 카페','CE7'),true],
 ['점심 카페·빵: 빵집',L('cafe'),P('어머니빵집','음식점 > 간식 > 제과,베이커리'),true],
 ['점심 카페·빵: 닭강정 제외',L('cafe'),P('애월닭강정','음식점 > 간식 > 닭강정','FD6'),false],
 ['점심 카페·빵: 떡집',L('cafe'),P('오메기떡','음식점 > 간식 > 떡,한과','FD6'),true],
 ['점심 해장: 해장국',L('haejang'),P('해장길','음식점 > 한식 > 해장국'),true],
 ['점심 해장: 짬뽕',L('haejang'),P('교동짬뽕','음식점 > 중식 > 중국요리'),true],
 ['점심 해장: 백반 아님',L('haejang'),P('백반집','음식점 > 한식 > 백반'),false],
 ['점심 전체: 카페 제외',L('all'),P('카페','음식점 > 카페','CE7'),false],
 ['저녁 고기: 삼겹살',D('meat'),P('돗담','음식점 > 한식 > 육류,고기 > 삼겹살'),true],
 ['저녁 고기: 족발 제외',D('meat'),P('엄지족발','음식점 > 한식 > 육류,고기 > 족발,보쌈'),false],
 ['저녁 고기: 장어구이 제외',D('meat'),P('일도바다장어구이','음식점 > 한식 > 해물,생선 > 장어'),false],
 ['저녁 고기: 흑돼지강정 제외',D('meat'),P('신촌흑돼지강정','음식점 > 간식'),false],
 ['저녁 고기: 한우소머리국밥 제외',D('meat'),P('연동한우소머리국밥','음식점 > 한식 > 국밥'),false],
 ['저녁 고기: 양꼬치',D('meat'),P('마라양꼬치','음식점 > 중식 > 양꼬치'),true],
 ['저녁 고기: 분류 한식+이름 흑돼지',D('meat'),P('숙성왕 제주흑돼지','음식점 > 한식'),true],
 ['저녁 고기: 생고기김치찌개 제외',D('meat'),P('24시생고기김치찌개','음식점 > 한식 > 찌개,전골'),false],
 ['저녁 고기: 닭갈비 제외',D('meat'),P('춘천닭갈비','음식점 > 한식 > 육류,고기 > 닭요리'),false],
 ['저녁 고기: 희양양(육류,고기)',D('meat'),P('희양양 연동점','음식점 > 한식 > 육류,고기'),true],
 ['저녁 고기: 물고기집(횟집) 제외',D('meat'),P('물고기집','음식점 > 한식 > 해물,생선 > 회'),false],
 ['저녁 흑돼지: 흑돼지집',D('blackpork'),P('깜돈흑돼지','음식점 > 한식 > 육류,고기'),true],
 ['저녁 흑돼지: 강정 제외',D('blackpork'),P('짱이네흑돼지강정','음식점 > 간식 > 닭강정'),false],
 ['저녁 회·해산물: 횟집',D('sea'),P('회찬숙성회','음식점 > 한식 > 해물,생선 > 회'),true],
 ['저녁 회·해산물: 장어',D('sea'),P('연동장어','음식점 > 한식 > 해물,생선 > 장어'),true],
 ['저녁 회·해산물: 추어탕 제외',D('sea'),P('일소추어탕','음식점 > 한식 > 해물,생선 > 추어'),false],
 ['저녁 회·해산물: 굴국밥 제외',D('sea'),P('김명자굴국밥','음식점 > 한식 > 해물,생선 > 굴,전복'),false],
 ['저녁 족발',D('jokbal'),P('엄지족발','음식점 > 한식 > 육류,고기 > 족발,보쌈'),true],
 ['저녁 치킨: 치킨집',D('chicken'),P('BBQ 제주점','음식점 > 치킨 > BBQ'),true],
 ['저녁 치킨: 삼계탕',D('chicken'),P('신제주삼계탕','음식점 > 한식 > 육류,고기 > 닭요리 > 삼계탕'),true],
 ['저녁 치킨: 닭해장국 제외',D('chicken'),P('서귀포닭해장국','음식점 > 한식 > 해장국'),false],
 ['저녁 치킨: 닭칼국수 제외',D('chicken'),P('정연이네닭칼국수','음식점 > 한식 > 국수 > 칼국수'),false],
 ['저녁 치킨: 마라탕 오리목 제외',D('chicken'),P('쇼린마라탕 오리목전문점','음식점 > 중식'),false],
 ['저녁 치킨: 부가네얼큰이',D('chicken'),P('부가네얼큰이','음식점 > 한식 > 육류,고기 > 닭요리'),true],
 ['저녁 전골: 감자탕',D('stew'),P('제주감자탕','음식점 > 한식 > 감자탕'),true],
 ['저녁 전골: 샤브',D('stew'),P('온담샤브','음식점 > 샤브샤브'),true],
 ['저녁 전골: 설렁탕 제외',D('stew'),P('설농옥','음식점 > 한식 > 설렁탕'),false],
 ['저녁 전골: 마라탕 제외',D('stew'),P('탕화쿵푸마라탕','음식점 > 중식 > 중국요리 > 탕화쿵푸마라탕'),false],
 ['저녁 전골: 삼계탕 제외',D('stew'),P('신제주삼계탕','음식점 > 한식 > 육류,고기 > 닭요리 > 삼계탕'),false],
 ['저녁 전골: 찜닭',D('stew'),P('진교동찜닭','음식점 > 한식 > 육류,고기 > 닭요리 > 진교동찜닭'),true],
 ['저녁 중식 요리: 양꼬치 포함',D('chinese'),P('마라양꼬치','음식점 > 중식 > 양꼬치'),true],
 ['저녁 2차 술집: 호프',D('bar'),P('미하이','음식점 > 술집 > 호프,요리주점'),true],
 ['저녁 2차 술집: 이자카야',D('bar'),P('키로','음식점 > 술집 > 일본식주점'),true],
 ['저녁 1차 전체: 김밥집 제외',D('all'),P('고슬','음식점 > 분식'),false],
 ['저녁 1차 전체: 고깃집',D('all'),P('돗담','음식점 > 한식 > 육류,고기 > 삼겹살'),true],
];
cases.forEach(([n,f,p,w])=>{let g;try{g=!!f(p)}catch(e){g='오류:'+e.message}t(n,g===w,'결과 '+g);});
t('키즈카페는 식당·카페 아님',!J.isEatery(P('해피키즈카페','음식점 > 카페','CE7')));
t('스터디카페 제외',!J.isEatery(P('작심스터디카페','음식점 > 카페','CE7')));
J.setMeal('dinner');
t('저녁 표시: 소머리국밥 → 국밥·국수',J.foodLabelOf(P('연동한우소머리국밥','음식점 > 한식 > 국밥'))==='국밥·국수',J.foodLabelOf(P('연동한우소머리국밥','음식점 > 한식 > 국밥')));
J.setMeal('lunch');
t('표시: 빵집 → 베이커리',J.foodLabelOf(P('어머니빵집','음식점 > 간식 > 제과,베이커리'))==='베이커리');
t('표시: 호프 → 술집',J.foodLabelOf(P('미하이','음식점 > 술집 > 호프,요리주점'))==='술집');
t('표시: 김밥상회 → 분식',J.foodLabelOf(P('김밥상회','음식점 > 분식'))==='분식',J.foodLabelOf(P('김밥상회','음식점 > 분식')));
const tx=p=>p.category_name+' '+p.place_name;
t("'회': 김밥상회는 아님",!J.kwIn(tx(P('김밥상회','음식점 > 분식')),'회'));
t("'회': 돈지방 회관 아님",!J.kwIn(tx(P('돈지방 회관','음식점 > 한식')),'회'));
t("'회': 분류 회",J.kwIn(tx(P('바다','음식점 > 한식 > 해물,생선 > 회')),'회'));
t("'회': 참치회",J.kwIn(tx(P('강참치','음식점 > 일식 > 참치회')),'회'));
t("'회': 이름에 횟집",J.kwIn(tx(P('싱싱바다횟집','음식점 > 한식')),'회'));
t("'탕': 탕수육 아님",!J.kwIn(tx(P('탕수육명가','음식점 > 중식')),'탕'));
t("'탕': 감자탕",J.kwIn(tx(P('제주감자탕','음식점 > 한식 > 감자탕')),'탕'));
t('이름 검색: 메가커피 → 메가MGC커피',J.isNamed({place_name:'메가MGC커피 제주도청점'},'메가커피'));
t('이름 검색: 우진해장국 본점 → 우진해장국',J.isNamed({place_name:'우진해장국'},'우진해장국 본점'));
t('이름 검색: 국밥 ≠ 옛날국밥',!J.isNamed({place_name:'옛날국밥'},'국밥'));
t('이름 검색: 한 글자는 무시',!J.isNamed({place_name:'가게'},'가'));
t('술 검색: 맥주 → 호프',(J.drinkOf('맥주')||{}).query==='호프');
t('술 검색: 포차 → 포장마차',(J.drinkOf('포차')||{}).query==='포장마차');
t('술 검색: 소주 → 술집',(J.drinkOf('소주')||{}).query==='술집');
t('술 검색: 칵테일바',(J.drinkOf('칵테일 바')||{}).query==='칵테일바');
t('술 검색: 국밥은 술 아님',J.drinkOf('국밥')===null);
t('링크 이름 쉼표 제거',!/,/.test(J.linkName('맛집, 본점')));
t('링크 이름 빈 값 → 위치',J.linkName('')==='위치');
const st=J.state, keep={lat:st.lat,lng:st.lng,startName:st.startName,region:st.region};
Object.assign(st,{lat:33.48892,lng:126.49836,startName:'제주도청',region:null});
const place={id:'123',place_name:'가게, 1호',x:'126.5',y:'33.49'};
const u1=J.kakaoWebUrl('route',place);t('웹 길찾기: 출발지 제주도청 포함',/by\/walk\/.*33\.48892,126\.49836/.test(u1),u1);
t('웹 길찾기: 좌표 개수 정상(쉼표 이름 안전)',decodeURIComponent(u1).split(',').length===5,decodeURIComponent(u1));
t('앱 길찾기: 도보',/by=FOOT/.test(J.kakaoAppPath('route',place)));
Object.assign(st,{startName:null});
t('현재 위치면 카카오가 현재 위치로 (link/to)',/link\/to\//.test(J.kakaoWebUrl('route',place)));
Object.assign(st,{region:{name:'구좌읍',radius:8000}});
t('읍·면 전체면 차 길찾기',/by=CAR/.test(J.kakaoAppPath('route',place)));
t('동네: 구좌읍 김녕리 뽑기',J.villageOf(P('x','음식점 > 한식'))==='김녕리');
Object.assign(st,keep);
t('상세 링크 = 가게 번호',/place\.map\.kakao\.com\/123/.test(J.kakaoWebUrl('place',place)));
t('도보 670m ≈ 10분',J.walkMin(670)===10);
t('도보 0m → 최소 1분',J.walkMin(0)===1);
t('거리 1500m → 1.5km',J.fmtDistance(1500)==='1.5km');
t('거리 999m → 999m',J.fmtDistance(999)==='999m');
t('분류 뚜렷: 분식',J.DISTINCT_CAT.test('음식점 > 분식'));
t('분류 넓음: 한식',!J.DISTINCT_CAT.test('음식점 > 한식'));
t('프랜차이즈: 스타벅스',J.isFranchise({place_name:'스타벅스 제주노형점'}));
t('프랜차이즈 아님: 제주버거',!J.isFranchise({place_name:'제주버거'}));
t('국물집: 해장국',J.isSoupPlace(P('해장길','음식점 > 한식 > 해장국')));
t('국물집 아님: 숯불갈비',!J.isSoupPlace(P('돌돌이숯불갈비','음식점 > 한식 > 육류,고기 > 갈비')));
t('보조 검색어: 전골에 샤브샤브',J.EXTRA_Q.stew.includes('샤브샤브'));
t('보조 검색어: 회·해산물에 장어',J.EXTRA_Q.sea.includes('장어'));
t('보조 검색어: 고기에 양갈비',J.EXTRA_Q.meat.includes('양갈비'));
t('접대 사유: 회',/생선회/.test(J.guestReason('회',{label:'🤝 손님',why:'x'})));
t('접대 사유: 한정식',/코스/.test(J.guestReason('한정식',{label:'🤝 손님',why:'x'})));
// 영업시간
const dk=d=>(d.getMonth()+1)+'/'+d.getDate();const add=(d,n)=>{const x=new Date(d.getTime());x.setDate(x.getDate()+n);return x};
const base=new Date(2026,8,25,12,0);
const H=(h,f)=>({days:[-1,0,1,2,3,4,5,6].map(i=>{const d=add(base,i);return f?f(i,dk(d)):{d:dk(d),h};})});
const at=(h,m)=>new Date(2026,8,25,h,m);
const hc=[
 ['24시간 가게 점심',J.mealOpen(H('00:00~24:00'),'lunch',at(12,0),'all').ok,true],
 ['24시간 가게 새벽 3시 영업 중',J.openStatus(H('00:00~24:00'),at(3,0)).code,'open'],
 ['새벽 2시 마감 술집 01:00 지금',J.mealOpen(H('18:00~02:00'),'dinner',at(1,0),'bar').ok,true],
 ['새벽 2시 마감 01:00 상태',J.openStatus(H('18:00~02:00'),at(1,0)).code,'open'],
 ['브레이크 중 16:00',J.openStatus({days:H('11:00~21:00').days.map(x=>Object.assign(x,{b:['15:00~17:00']}))},at(16,0)).code,'break'],
 ['영업 전 09:00',J.openStatus(H('11:00~21:00'),at(9,0)).code,'before'],
 ['영업 종료 22:00',J.openStatus(H('11:00~21:00'),at(22,0)).code,'closed'],
 ['오늘 휴무 상태',J.openStatus(H('',(i,k)=>i===0?{d:k,off:1}:{d:k,h:'11:00~21:00'}),at(12,0)).code,'off'],
 ['저녁만 여는 곳 점심 12시',J.mealOpen(H('17:00~23:00'),'lunch',at(12,0),'all').ok,false],
 ['저녁만 여는 곳 아침 저녁 모드',J.mealOpen(H('17:00~23:00'),'dinner',at(9,0),'all').ok,true],
 ['14:30 마감 13:00 남은 분',J.mealOpen(H('06:00~14:30'),'lunch',at(13,0),'all').left,90],
 ['내일 휴무 16시 점심(내일 기준)',J.mealOpen(H('',(i,k)=>i===1?{d:k,off:1}:{d:k,h:'11:00~21:00'}),'lunch',at(16,0),'all').ok,false],
 ['목록에 빠진 날 = 정기휴무',JSON.stringify(J.hoursOn({days:H('11:00~21:00').days.filter((x,i)=>i!==1)},at(12,0))),'[]'],
 ['오래된 데이터(오늘 없음) = 모름',J.hoursOn({days:H('11:00~21:00').days.map(x=>Object.assign({},x,{d:'1/'+x.d.split('/')[1]}))},at(12,0)),null],
 ['11:30 오픈, 11:40 점심 OK',J.mealOpen(H('11:30~21:00'),'lunch',at(11,40),'all').ok,true],
 ['12:30 오픈, 11:45 점심(45분 뒤) 아직',J.mealOpen(H('12:30~21:00'),'lunch',at(11,45),'all').ok,false],
 ['카페 아침 8시 → 점심 후 기준',J.mealOpen(H('12:00~20:00'),'lunch',at(8,0),'cafe').ok,true],
 ['술집 아침 9시 → 오늘 밤 기준',J.mealOpen(H('19:00~02:00'),'dinner',at(9,0),'bar').ok,true],
 ['술집 21시 영업 중',J.mealOpen(H('19:00~02:00'),'dinner',at(21,0),'bar').ok,true],
 ['점심 새벽 0:30 → 오늘 점심 기준',J.mealOpen(H('11:00~21:00'),'lunch',at(0,30),'all').tomorrow,false],
 ['영업시간 모름 → 판단 안 함',J.mealOpen(null,'lunch',at(12,0),'all'),null],
 ['저녁 22시 → 내일 저녁 기준',J.mealOpen(H('11:00~21:00'),'dinner',at(22,0),'all').tomorrow,true],
];
hc.forEach(([n,g,w])=>t('영업시간: '+n,JSON.stringify(g)===JSON.stringify(w),'결과 '+JSON.stringify(g)));

t('넓은 분류: 한식',J.isBroadCat({category_name:'음식점 > 한식'}));
t('넓은 분류 아님: 삼겹살',!J.isBroadCat({category_name:'음식점 > 한식 > 육류,고기 > 삼겹살'}));
t('넓은 분류 아님: 이자카야',!J.isBroadCat({category_name:'음식점 > 술집 > 일본식주점'}));
t('넓은 분류: 호프',J.isBroadCat({category_name:'음식점 > 술집 > 호프,요리주점'}));
t('넓은 분류 아님: 분식',!J.isBroadCat({category_name:'음식점 > 분식'}));
t('메뉴 이름은 가게 찾기 아님: 냉면',!J.isNamed({place_name:'냉면입니다 신제주점'},'냉면'));
t('메뉴 이름은 가게 찾기 아님: 김밥',!J.isNamed({place_name:'김밥천국 연동점'},'김밥'));
t('메뉴 이름은 가게 찾기 아님: 짬뽕',!J.isNamed({place_name:'짬뽕에취한날'},'짬뽕'));
t('가게 이름은 찾기: 우진해장국',J.isNamed({place_name:'우진해장국'},'우진해장국'));
t('저녁 1차 전체: 칼국수집 제외',!J.isDinnerMain({category_name:'음식점 > 한식 > 국수 > 칼국수',place_name:'웅이네보말칼국수',category_group_code:'FD6'}));
t('저녁 1차 전체: 국밥집은 포함',J.isDinnerMain({category_name:'음식점 > 한식 > 국밥',place_name:'옛날국밥',category_group_code:'FD6'}));
t('저녁 1차 전체: 구내식당 제외',!J.isDinnerMain({category_name:'음식점 > 구내식당',place_name:'차곡한끼',category_group_code:'FD6'}));
t('카페 19:40 → 내일 점심 후 기준',J.mealOpen(H('10:00~19:00'),'lunch',at(19,40),'cafe').tomorrow===true);
t('카페 19:40 내일 영업이면 OK',J.mealOpen(H('10:00~19:00'),'lunch',at(19,40),'cafe').ok===true);
t('카페 13:00 → 지금 기준',J.mealOpen(H('10:00~19:00'),'lunch',at(13,0),'cafe').now===true);
// 점수
const keepS={meal:st.meal,situation:st.situation,radius:st.radius,food:st.food};
const S=(o,x={})=>{const p=Object.assign({id:String(Math.random()),place_name:'가게',category_name:'음식점 > 한식 > 한정식',category_group_code:'FD6',distance:300,__rating:4.4,__ratingCount:300,__reviewCount:10,__hours:null},o);return J.scorePlace(p,'').score;};
Object.assign(st,{meal:'lunch',situation:'team',radius:670,food:'all'});
t('점수: 평가 800명 4.4 > 평가 3명 5.0',S({__rating:4.4,__ratingCount:800})>S({__rating:5.0,__ratingCount:3}));
t('점수: 프랜차이즈는 내려감',S({place_name:'스타벅스 제주점'})<S({place_name:'동네카페'}));
t('점수: 가까울수록 위',S({distance:200})>S({distance:900}));
t('점수: 블로그만 1000개 < 평점 4.5·300명',S({__rating:null,__ratingCount:0,__reviewCount:1000})<S({__rating:4.5,__ratingCount:300}));
Object.assign(st,{situation:'guest'});
t('손님: 한정식 4.4·500명 > 한정식 4.9·8명',S({__rating:4.4,__ratingCount:500})>S({__rating:4.9,__ratingCount:8}));
t('손님: 한정식 > 분식(같은 평점)',S({})>S({category_name:'음식점 > 분식'}));
Object.assign(st,{situation:'team',radius:3000});
const d15=S({distance:1005}),d45=S({distance:3015});t('3km: 먼 곳 감점 완화(30분 더 멀어도 -12점 안쪽)',d15-d45<12&&d15-d45>0,(d15-d45).toFixed(1));
Object.assign(st,{radius:670});
const off=H('',(i,k)=>i===0?{d:k,off:1}:{d:k,h:'06:00~23:00'});
const nowD=new Date();const offToday={days:[-1,0,1,2,3,4,5,6].map(i=>{const d=add(nowD,i);return i===0?{d:dk(d),off:1}:{d:dk(d),h:'00:00~24:00'}})};
const openAll={days:[-1,0,1,2,3,4,5,6].map(i=>{const d=add(nowD,i);return {d:dk(d),h:'00:00~24:00'}})};
const sOpen=S({__hours:openAll}), sOff=S({__hours:offToday});
t('휴무는 살짝만 감점(0~6점)',sOpen-sOff>=0&&sOpen-sOff<=6,(sOpen-sOff).toFixed(1));

const QS=(o)=>J.scorePlace(Object.assign({id:'q',place_name:'가게',category_name:'음식점 > 한식',category_group_code:'FD6',distance:300,__rating:4.5,__ratingCount:100,__reviewCount:10,__hours:null,__qHit:true},o),'냉면').score;
t('검색 순위: 냉면집(이름) > 대표 메뉴 냉면 > 곁들이 냉면',QS({__qText:true})>QS({__qMenu:true,__qMain:true})&&QS({__qMenu:true,__qMain:true})>QS({__qMenu:true,__qMain:false}));
Object.assign(st,keepS);
return R;};
