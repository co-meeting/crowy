$(function(){
	$('#loginItems a').click(function(event){
		if($('#remember-me input:checked').length > 0){
			$.cookie('__t', null);
		} else {
			$.cookie('__t', 1);
		}
	});
});