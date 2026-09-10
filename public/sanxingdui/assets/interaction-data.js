(function(){
 'use strict';
 var D=window.DIG;
 // Visitor-friendly nicknames supplied by the project owner; formal names stay unchanged.
 var nicknames={sun:'方向盘 / 车轮胎 / 奔驰车标','gold-mask':'黄金面膜',kneeling:'马叔叔',grid:'烧烤架'};
 D.objects.forEach(function(o){
  if(nicknames[o.id])o.tag='常用昵称 · '+nicknames[o.id];
  if(o.id==='grid'){
   o.lead=o.lead.replace(/烤架/g,'烧烤架');
   o.guide=o.guide.replace(/烤架/g,'烧烤架');
  }
 });
 // Keep the existing storage ID so previous exploration is not discarded.
 D.chapters[0].year='1927';
 D.pits=[
  {n:3,date:'2021年3月8日',note:'观察象牙与青铜器在坑内的叠压分布。'},
  {n:4,date:'2021年2月26日',note:'观察深色堆积与其中可见的遗物。'},
  {n:5,date:'2021年1月18日',note:'观察散布的金色残片与细小遗物。'},
  {n:6,date:'2021年5月15日',note:'这张照片记录清理后的坑形，不代表该坑没有出土遗物。'},
  {n:7,date:'2021年9月8日',note:'观察象牙、器物与坑壁之间的位置关系。'},
  {n:8,date:'2021年9月4日',note:'观察层层叠置的象牙与青铜器。'}
 ];
 var museum=['tree','standing','mask','sun','gold-mask','staff','jade'];
 // Focal points are measured on each photograph, not on decorative background drawings.
 // [x%, y%, scale relative to contain-fit]. Source files are never repainted.
 var cameras={
  tree:[[45,15,6],[55,73,4.5],[50,89,6],[49,50,1.65]],
  standing:[[49.5,10,7],[49.5,23,6],[50,43,6]],
  mask:[[50,46,2.8],[75,41,3]],
  sun:[[50,50,2.8],[73,50,2.8]],
  'gold-mask':[[50,34,3],[49,70,2.8]],
  staff:[[14,74,3.8],[24,69,3.8],[34,64,3.8],[50,53,1.6]],
  jade:[[53,16,6],[51,41,6]],
  pot:[[50,26,2.5],[49,68,2.3]],
  he:[[52,32,2.4],[51,69,2.3]],
  ivory:[[49,48,2.5],[62,54,2.8]],
  bi:[[50,46,2.4],[58,68,2.5]],
  muscle:[[50,19,3.5],[55,44,3.2],[49,57,3.4]],
  kneeling:[[45,46,3.4],[63,49,3.4],[48,70,3]],
  pig:[[48,64,4],[51,56,3]],
  grid:[[46,33,2.8],[49,44,3]],
  'small-standing':[[23,55,3.6],[23,73,2.8]]
 };
 D.objects.forEach(function(o){
  var thumbs={tree:'tree.webp',standing:'standing.webp',staff:'staff.webp',jade:'jade.webp',muscle:'coach.webp'};
  if(thumbs[o.id])o.thumb='thumbs/'+thumbs[o.id];
  if(museum.indexOf(o.id)>=0){o.image='museum/'+o.id+'.webp';o.source='三星堆博物馆官网 · 馆藏文物 · 3430 × 1930 原始公开图';o.museum=true;}
  o.cameras=cameras[o.id];
  o.detailNotice=o.museum?'镜头只定位实物区域；背景线描属于官网原图排版，不作为实物细节。':'当前为实物原图局部观察；精细纹饰仍需更清晰的专门特写。';
  if(o.id==='muscle'){o.name='青铜着裙立人像';o.short='着裙立人像';o.image='official/coach.webp';o.meta='八号坑出土 · 竖披发青铜人像';o.source='上海博物馆 · 竖披发青铜人像 · 3333 × 5000 公开原图';o.lead='大家熟悉的“健身教练”，看发式、手势和裙装。';o.guide='上海博物馆将其称为竖披发青铜人像，高104厘米。头部竖发向后上翘，左手上举，右臂从肘部残缺，身穿束腰长裙，膝部微曲，赤足立于方座上。“健身教练”“肌肉男”是现代观众对其体态的昵称，不是古代身份。它与兽首冠青铜人像是不同文物。';o.spots=[['竖披发','观察向后上翘的分绺发式，不把头发误称为兽首冠。',50,19],['左手与双臂','左手上举，右臂从肘部残缺；具体持物和手势含义仍待研究。',55,44],['裙装与衣纹','观察束腰、衣缘与裙面纹饰，再比较上身和下肢的比例。',49,57]];o.detailNotice='采用3333 × 5000官方公开原图；镜头定位竖发、左手和裙装，不补画残缺的右臂。';}
  if(o.id==='staff')o.detailNotice='当前只能推近金杖端部；人像、鸟、鱼刻线尚不足以分别确认。专门微距照片待补，不将背景线描冒充实物。';
  if(o.id==='jade'){o.guide='本页采用三星堆博物馆官网发布的商玉璋照片。器身两面有线刻图案，博物馆讲解从人物、山形及牙璋等形象解释其祭山内涵。点击观察上部、下部纹饰区；细小刻线仍需专门微距照片辅助，不用背景线描替代实物。';o.spots=[['上部纹饰区','推近器身上部，观察人物与山形纹饰所在区域。更细的刻线需专业微距原图。',53,16],['下部纹饰区','推近器身中段的另一组纹饰，比较上下两组布局。',51,41]];}
  if(o.id==='bi')o.guide='本图为中国国家博物馆展览页面发布的有领玉璧，四川博物院藏。展品页面记其1931年出土；本工具采用1927年作为三星堆发现起点，两者不混同，不把此图标作首次发现当年的原件。';
 });
}());
