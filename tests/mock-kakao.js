(function(){
const C0=[33.48892,126.49836];const P=[];
const cats=['음식점 > 한식 > 육류,고기','음식점 > 한식 > 육류,고기 > 삼겹살','음식점 > 한식 > 국밥','음식점 > 한식 > 국수','음식점 > 한식 > 해장국','음식점 > 한식 > 해물,생선 > 회','음식점 > 한식 > 찌개,전골','음식점 > 일식','음식점 > 중식 > 중국요리','음식점 > 한식','음식점 > 치킨','음식점 > 양식 > 피자','음식점 > 분식','음식점 > 술집 > 호프,요리주점','음식점 > 카페','음식점 > 간식 > 제과,베이커리','음식점 > 한식 > 육류,고기 > 족발,보쌈','음식점 > 한식 > 감자탕'];
for(let i=0;i<500;i++){const a=i*2.4,r=0.03*Math.sqrt(i/500);const c=cats[i%cats.length];P.push({id:String(30000+i),place_name:(i===7?'맛집, 본점':'가게')+i,category_name:c,category_group_code:/카페|간식/.test(c)?'CE7':'FD6',x:String(C0[1]+r*Math.cos(a)*1.2),y:String(C0[0]+r*Math.sin(a)),address_name:'제주특별자치도 제주시 '+(i%2?'구좌읍 김녕리':'연동')+' '+i,road_address_name:'제주특별자치도 제주시 연동로 '+i});}
(window.__BARS||[]).forEach(b=>P.push({id:b.id,place_name:b.place_name,category_name:b.category_name,category_group_code:b.category_group_code,x:b.x,y:b.y,address_name:b.address_name,road_address_name:b.road_address_name}));
P.push({id:'99001',place_name:'경기도청',category_name:'사회,공공기관 > 행정기관',category_group_code:'PO3',x:'127.0286',y:'37.2891',address_name:'경기 수원시'});
P.push({id:'99002',place_name:'제주특별자치도청',category_name:'사회,공공기관 > 행정기관',category_group_code:'PO3',x:'126.49836',y:'33.48892',address_name:'제주특별자치도 제주시 연동'});
function hv(la1,ln1,la2,ln2){const R=6371000,t=Math.PI/180;const h=Math.sin((la2-la1)*t/2)**2+Math.cos(la1*t)*Math.cos(la2*t)*Math.sin((ln2-ln1)*t/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function LatLng(a,b){this.a=a;this.b=b}LatLng.prototype.getLat=function(){return this.a};LatLng.prototype.getLng=function(){return this.b};
const noop=()=>{};window.__mapClick=null;
const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
const food=P.filter(p=>p.category_group_code!=='PO3');
const pg=(opts,cb,q)=>{if(/xyz/.test(q||''))return setTimeout(()=>cb([],'ZERO_RESULT'),30);const L=opts.location;const k=hash(q||'cat');
 let r=food.filter((p,i)=>q==null||((i+k)%3===0)||p.place_name.includes(q)||p.category_name.includes(q)).map(p=>Object.assign({},p,{distance:String(Math.round(hv(L.a,L.b,+p.y,+p.x)))})).filter(p=>+p.distance<=(opts.radius||20000));
 r=opts.sort==='accuracy'?r.sort((a,b)=>hash(a.id+q)%100-hash(b.id+q)%100):r.sort((a,b)=>a.distance-b.distance);r=r.slice(0,45);
 if(!r.length)return setTimeout(()=>cb([],'ZERO_RESULT'),60);let cur=1;const pgn={get hasNextPage(){return cur*15<r.length},get current(){return cur},nextPage(){cur++;send()}};
 const send=()=>setTimeout(()=>cb(r.slice((cur-1)*15,cur*15),'OK',pgn),40+Math.random()*80);send();};
window.kakao={maps:{load:f=>f(),LatLng,Map:function(){this.setCenter=noop;this.setBounds=noop;this.getLevel=()=>5;this.setLevel=noop;this.panTo=noop},Marker:function(){this.setMap=noop},CustomOverlay:function(){this.setMap=noop},LatLngBounds:function(){this.extend=noop},
 event:{addListener:(t,ev,fn)=>{if(ev==='click'&&t&&t.setCenter)window.__mapClick=fn;}},
 services:{Status:{OK:'OK',ZERO_RESULT:'ZERO_RESULT',ERROR:'ERROR'},SortBy:{DISTANCE:'distance',ACCURACY:'accuracy'},
  Places:function(){this.keywordSearch=(q,cb,o)=>{
     if(!o||!o.location){ // 위치 없는 검색: 위치 찾기·지역 이름 검색
       if(/도청/.test(q))return setTimeout(()=>cb(P.filter(p=>/도청/.test(p.place_name)),'OK'),30);
       if(/구좌읍/.test(q))return setTimeout(()=>cb(food.filter(p=>p.address_name.includes('구좌읍')).slice(0,15),'OK'),30);
       const f=food.filter(p=>p.place_name.includes(q));return setTimeout(()=>cb(f.slice(0,15),f.length?'OK':'ZERO_RESULT'),30);}
     if(/도청/.test(q))return setTimeout(()=>cb(P.filter(p=>/도청/.test(p.place_name)).map(p=>Object.assign({},p,{distance:String(Math.round(hv(o.location.a,o.location.b,+p.y,+p.x)))})),'OK'),30);
     pg(o,cb,q)};this.categorySearch=(c,cb,o)=>pg(o,cb,null)},
  Geocoder:function(){this.addressSearch=(a,cb)=>a.includes('구좌읍')?cb([{address_name:'제주특별자치도 제주시 구좌읍',address_type:'REGION',x:'126.50',y:'33.49'}],'OK'):cb([],'ZERO_RESULT')}}}};})();
