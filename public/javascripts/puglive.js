// have to call require('pug') in order to use pug api
var pug = require('pug');

var editorOptions = {
	mode: {name: 'pug', alignCDATA: true},
	lineNumbers: true,
	tabSize: 2,
	lineWrapping: true,
	indentWithTabs: false
};

function compile () {
	var pug_source = editor.getValue();
	$.post('/pug/compile', {code:pug_source}, 'json')
	.done(function(data, stat){
		console.log(stat);
		var html = data.compiled;
		html_editor.setValue(html);
		$('#rendered').html(html);

	})
	.fail(function(xhr){
		html_editor.setValue(xhr.responseText);
	});
}

function check_active (last_active) {
	return function(){
		if (last_active === active) {
			compile();
		}
	}
}

var active = 0;
function on_change() {
	++active;
	setTimeout(check_active(active),500);
}

var editor = CodeMirror.fromTextArea($('#pug-source').get(0), editorOptions);

// html
var htmlOptions = {
	mode: {name: 'htmlmixed', alignCDATA: true},
	lineNumbers: true,
	tabSize: 2,
	lineWrapping: true,
	indentWithTabs: false,
	readOnly: true,
};
var html_editor = CodeMirror.fromTextArea($('#html-source').get(0), htmlOptions);

on_change();

editor.on('changes', on_change);



