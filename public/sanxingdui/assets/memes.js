(function(){
 'use strict';
 var positions={},focused=-1;
 var data=[
 ['pig','你是吗？',''],
 ['kneeling','别搞，别搞',''],
 ['','给您跪下了','尚未与本图鉴具体器物核对，暂不作对应。'],
 ['','累了，也还要坚持','组合器中的人像，尚未与本图鉴具体器物核对。'],
 ['mask','目光要放长远',''],
 ['','摸不清头脑','尚未与本图鉴具体器物核对，暂不作对应。'],
 ['','不想上班 +1','多件人头像的展陈趣图，并非同一件器物。'],
 ['','啊啊啊','尚未与本图鉴具体器物核对，暂不作对应。'],
 ['','我裂开了','金面具趣图，不等同于本图鉴的戴金面罩青铜人头像。'],
 ['','蜀到三','展厅文字趣图，不作为文物条目。'],
 ['grid','来整点烧烤','肉串为趣味合成，不能据此判断器物用途。'],
 ['muscle','游泳健身了解一下','杠铃为趣味合成，并非文物原貌。'],
 ['muscle','我的身材很曼妙',''],
 ['','挺秃然的','另一件戴金面罩人头像，暂不与本图鉴实物绑定。'],
 ['','来财，来财','趣图中的摇钱树不是本图鉴的一号青铜神树，年代与馆藏待核。'],
 ['','报告大王','尚未与本图鉴具体器物核对，暂不作对应。'],
 ['mask','眼光要放长远','','Choco'],
 ['sun','命运的齿轮开始转动','','Choco'],
 ['','我母啊！','尚未与本图鉴具体器物核对，暂不作对应。','Choco'],
 ['kneeling','使不得，使不得','','Choco']
 ];
 window.memeItems=function(id){return data.map(function(x,i){return {object:x[0],title:x[1],note:x[2],image:i+1,source:x[3]||'月儿～'};}).filter(function(x){return id==='all'||x.object===id;});};
 function button(label,action,value){return '<button type="button" class="secondary" data-action="'+action+'" data-value="'+value+'">'+label+'</button>';}
 window.memeSection=function(id){
  var items=window.memeItems(id);if(!items.length)return '';
  if(id==='all'&&focused>=0){
   var chosen=items[focused];
   return '<section class="meme-section meme-focus" aria-label="趣图大图"><button type="button" class="meme-close" data-action="meme-close">‹ 返回四图页</button><figure><img src="./assets/memes/'+chosen.image+'.webp" alt="趣味二创：'+chosen.title+'"><figcaption><h3>'+chosen.title+'</h3><p class="meme-credit">图片来源：小红书「'+chosen.source+'」</p></figcaption></figure></section>';
  }
  if(id==='all'){
   var page=positions.all||0,pageSize=4,pageCount=Math.ceil(items.length/pageSize),visible=items.slice(page*pageSize,page*pageSize+pageSize);
   return '<section class="meme-section meme-overview" aria-label="网友脑洞"><div class="meme-overview-head"><p class="kicker">另一种看法 / 趣味二创</p><h2 tabindex="-1">网友脑洞</h2><p>每页4张，点开可看大图；趣图不代表文物真实用途。</p></div><div class="meme-grid">'+visible.map(function(x){return '<button type="button" data-action="meme-open" data-value="'+(x.image-1)+'"><img src="./assets/memes/'+x.image+'.webp" alt="趣味二创：'+x.title+'"><span>'+x.title+'</span></button>';}).join('')+'</div><p class="meme-credit">图片来源：小红书「'+visible[0].source+'」</p><div class="meme-controls">'+(page>0?button('上一页','meme-page','all:'+(page-1)):'<button class="secondary" disabled>上一页</button>')+'<span aria-live="polite">'+(page+1)+' / '+pageCount+'</span>'+(page<pageCount-1?button('下一页','meme-page','all:'+(page+1)):'<button class="secondary" disabled>下一页</button>')+'</div></section>';
  }
  var index=positions[id]||0,item=items[index];
  return '<section class="meme-section" aria-label="网友脑洞"><p class="kicker">另一种看法 / 趣味二创</p><h2 tabindex="-1">网友脑洞</h2><p>趣图不是文物原貌，也不是用途结论。实物图片与讲解保留在上方。</p><figure><img src="./assets/memes/'+item.image+'.webp" alt="趣味二创：'+item.title+'"><figcaption><h3>'+item.title+'</h3>'+(item.note?'<p>'+item.note+'</p>':'')+'<p class="meme-credit">图片来源：小红书「'+item.source+'」</p></figcaption></figure><div class="meme-controls">'+(index>0?button('← 上一张','meme-page',id+':'+(index-1)):'<button class="secondary" disabled>← 上一张</button>')+'<span aria-live="polite">'+(index+1)+' / '+items.length+'</span>'+(index<items.length-1?button('下一张 →','meme-page',id+':'+(index+1)):'<button class="secondary" disabled>下一张 →</button>')+'</div>'+button('更多趣图 →','memes','')+'</section>';
 };
 document.addEventListener('click',function(e){
  var open=e.target.closest('[data-action="meme-open"]'),close=e.target.closest('[data-action="meme-close"]');
  if(open){focused=Number(open.dataset.value);var openHost=document.querySelector('.meme-section');openHost.outerHTML=window.memeSection('all');return;}
  if(close){focused=-1;var closeHost=document.querySelector('.meme-section');closeHost.outerHTML=window.memeSection('all');return;}
  var target=e.target.closest('[data-action="meme-page"]');if(!target)return;
  var parts=target.dataset.value.split(':'),index=Number(parts[1]),items=window.memeItems(parts[0]);
  if(index<0||index>=items.length)return;
  positions[parts[0]]=index;
  var host=document.querySelector('.meme-section');if(!host)return;
  host.outerHTML=window.memeSection(parts[0]);
  var heading=document.querySelector('.meme-section h2');heading.focus();heading.scrollIntoView({block:'start'});
 });
}());
