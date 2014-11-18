// Requires Jquery to be loaded
// haystack is a root level node, no tree traversal this iteration

var imageTagger = (function() { //set up scope wrapper for this plugin
	$(document).on("click","div.inlineChatImage span.bigX", function(event) {
		 $(this).parent().remove();
	});

	var closerString = "<span class='bigX'>X</span>";

	// export function outside scope wrapper
	return { 
		run: function($hayStack) {
			var hayString = $hayStack.text();
			var matches = hayString.match(/(http(s)?:\/\/.*\.(?:jpg|gif|png|jpeg))/ig);
			if (matches && matches.length > 0){
				for (match in matches) {
					taggedString = hayString.replace(matches[match], "<div class='inlineChatImage'><img src='" + matches[match] + "' /></div>");
				}	
				$hayStack.html(taggedString);
				$hayStack.find('img').before($(closerString));
			}
		}
	}
})()
