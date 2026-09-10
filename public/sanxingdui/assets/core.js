(function(){
  'use strict';
  var D=window.DIG, ids=D.objects.map(function(o){return o.id;}), chapters=D.chapters.map(function(c){return c.id;}), materials=D.materials.map(function(m){return m.id;});
  function unique(list,allowed){return Array.isArray(list)?list.filter(function(x,i,a){return allowed.indexOf(x)>=0&&a.indexOf(x)===i;}):[];}
  function sanitize(v){
    v=v&&typeof v==='object'?v:{};
    return {id:/^\d{5}$/.test(v.id)?v.id:String(Math.floor(10000+Math.random()*90000)),found:unique(v.found,ids),chapters:unique(v.chapters,chapters),lit:unique(v.lit,[3,4,5,6,7,8]),favorite:ids.indexOf(v.favorite)>=0?v.favorite:'',resume:chapters.indexOf(v.resume)>=0?v.resume:'1929',answers:D.quiz.map(function(q,i){return Array.isArray(v.answers)&&materials.indexOf(v.answers[i])>=0?v.answers[i]:null;})};
  }
  function create(storage){
    var state,available=true;
    try{state=sanitize(JSON.parse(storage.getItem('sxd-dig-v2')));}catch(e){state=sanitize(null);available=false;}
    function save(){try{storage.setItem('sxd-dig-v2',JSON.stringify(state));}catch(e){available=false;}}
    save();
    return {
      get:function(){return JSON.parse(JSON.stringify(state));},
      find:function(id){if(ids.indexOf(id)>=0&&state.found.indexOf(id)<0){state.found.push(id);save();}},
      finish:function(id){if(chapters.indexOf(id)>=0&&state.chapters.indexOf(id)<0){state.chapters.push(id);save();}},
      resume:function(id){if(chapters.indexOf(id)>=0){state.resume=id;save();}},
      light:function(id){if([3,4,5,6,7,8].indexOf(id)>=0&&state.lit.indexOf(id)<0){state.lit.push(id);save();}},
      favorite:function(id){if(ids.indexOf(id)>=0){state.favorite=id;save();}},
      answer:function(i,value){if(i<0||i>=5||Math.floor(i)!==i||materials.indexOf(value)<0||state.answers[i]!==null)return false;state.answers[i]=value;save();return true;},
      score:function(){return state.answers.filter(function(a,i){return a===D.quiz[i].correct;}).length;},
      quizDone:function(){return state.answers.every(function(a){return a!==null;});},
      restartQuiz:function(){state.answers=[null,null,null,null,null];save();},
      storageAvailable:function(){return available;},
      reset:function(){state=sanitize(null);save();}
    };
  }
  function coverage(cols,rows){
    var cells=new Array(cols*rows),count=0;
    return {mark:function(x,y,r){for(var row=0;row<rows;row++){for(var col=0;col<cols;col++){var dx=(col+.5)/cols-x,dy=(row+.5)/rows-y,index=row*cols+col;if(!cells[index]&&dx*dx+dy*dy<=r*r){cells[index]=true;count++;}}}},ratio:function(){return count/(cols*rows);}};
  }
  window.DigCore={create:create,coverage:coverage};
}());
