(function(){
  function fitVisibleHeight(){
    var viewport=window.visualViewport;
    if(viewport && Math.abs(viewport.scale-1)>.01)return;
    document.documentElement.style.setProperty('--visible-height',(viewport?viewport.height:window.innerHeight)+'px');
  }
  fitVisibleHeight();
  window.addEventListener('resize',fitVisibleHeight);
  window.addEventListener('pageshow',fitVisibleHeight);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',fitVisibleHeight);
})();
