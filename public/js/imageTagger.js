// Requires Jquery to be loaded
// haystack is a root level node, no tree traversal this iteration

var imageTagger = (function() { //set up scope wrapper for this plugin
	function addExit() {
	}

	// export function outside scope wrapper
	return { 
		run: function($hayStack) {
			var hayString = $hayStack.text();
			var matches = hayString.match(/(http(s)?:\/\/.*\.(?:jpg|gif|png))/ig);
			if (matches && matches.length > 0){
				for (match in matches) {
					taggedString = hayString.replace(matches[match], "<img class='inlineChatImage' src='" + matches[match] + "' />");
				}	
				$hayStack.html(taggedString);
			}
		}
	}
})()
