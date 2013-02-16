/* Copyright (c) 2009 Jon Rohan (http://dinnermint.org)
 * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 * and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
 *
 * Version: 1.0.0
 * Written with jQuery 1.3.2
 */
(function($){
  $.fn.growing = function(options){
    var settings = $.extend({
       maxHeight: 400,
       minHeight: 40,
       lineHeight: 16,
	   buffer: 0,
	   dummy: null
    }, options);
    return this.each(function(){
      var textarea = $(this); //cache the textarea
      var minh = textarea.height()>settings.minHeight?textarea.height():settings.minHeight;
	  var w = parseInt(textarea.width()||textarea.css("width")); //get the width of the textarea
	  var div = settings.dummy || jQuery('<div></div>');
	  div.css({
									'width'      : w,
									'line-height': settings.lineHeight + 'px',
									'overflow-x' : 'hidden',
									'position'   : 'absolute',
									'top'        : 0,
									'left'		 : -9999
									}).appendTo('body');
      var resizeBox = function(e, forceRefresh){
		  var html = textarea.val().replace(/(<|>)/g, '').replace(/\n/g,"<br>|");
        if(forceRefresh || html!=div.html()) {
          div.width(textarea.width()).html(html);
		  var h = div.height();
          prevh = textarea.height();
		  var newh = (h+settings.buffer)<=minh?minh:(h>settings.maxHeight?settings.maxHeight:h+settings.buffer);
          if(newh>=settings.maxHeight) {
            textarea.css("overflow","auto");
          } else {
            textarea.css("overflow","hidden");
			}
		  textarea.css({"height":newh+"px"}).data("height", newh);
        }
      };
      textarea.keydown(resizeBox);
	  textarea.keyup(resizeBox);
	  textarea.data("growing", resizeBox);
      resizeBox();
    });
  };
})(jQuery);