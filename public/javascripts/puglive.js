// have to call require('pug') in order to use pug api
var pug = require('pug');

// need this, otherwise shift-tab will be broken
CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
CodeMirror.keyMap.default["Tab"] = "indentMore";

var editorOptions = {
	mode: {name: 'pug', alignCDATA: true},
	lineNumbers: true,

	// have to set tabSize & indentUnit, otherwise multi-line tab will be broken
	tabSize: 4,
	indentUnit: 4,
	indentWithTabs: true 
};

function compile () {
	var pug_source = pug_editor.getValue();
	var payload;
	try{
		payload = JSON.parse(json_editor.getValue());
	} catch(e){
		console.log(e.message);
	}

	var post_data = {code:pug_source};
	if (payload){
		post_data.payload = payload;
	}

	$.post('/pug/compile', post_data, 'json')
	.done(function(data, stat){
		console.log(stat);
		var html = data.compiled;
		html_editor.setValue(html);
		document.getElementById("rendered").srcdoc = html;

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

var pug_editor = CodeMirror.fromTextArea($('#pug-source').get(0), editorOptions);
pug_editor.setSize('100%', 100);


// html
var htmlOptions = {
	mode: {name: 'htmlmixed', alignCDATA: true},
	lineNumbers: true,
	//tabSize: 2,
	//lineWrapping: true,
	indentWithTabs: true,
	readOnly: true,
};
var html_editor = CodeMirror.fromTextArea($('#html-source').get(0), htmlOptions);
html_editor.setSize('100%', 100);

// json
var json_options = {
	mode: {name: 'application/json', alignCDATA: true},
	lineNumbers: true,
	//tabSize: 2,
	//lineWrapping: true,
	indentWithTabs: true,
};
var json_editor = CodeMirror.fromTextArea($('#json-source').get(0), json_options);
json_editor.setSize('100%', 100);

// js
var js_options = {
	mode: {name:"javascript", alignCDATA: true},
	lineNumbers: true,
	indentWithTabs: true,
};
var js_editor = CodeMirror.fromTextArea($('#js-source').get(0), js_options);
js_editor.setSize('100%', 100);


on_change();

pug_editor.on('changes', on_change);
json_editor.on('changes', on_change);
js_editor.on('changes', on_change);

const component_str = {
	// 
	Accordion:
`+accordion("sample")
	+accordion-item-primary("Title1","sample","true")
		|  This is first accordion content
	+accordion-item-default("Title2","sample")
		|  This is second accordion content
	+accordion-item-default("Title3","sample")
		|  This is third accordion content`,


	//
	Alerts: 
`+alert-info("This is an info alert")`,

	//
	Badges:
`+badge("1")`,

	//
	Buttons:
`+btn("Button")`,


	Carousel:
`+carousel("Carousel ID",[
	{image:"images/slide1.jpg",p:"Carousel Caption #1"},
	{image:"images/slide2.jpg",p:"Carousel Caption #2"},
	{image:"images/slide3.jpg",p:"Carousel Caption #3"},
	{image:"images/slide4.jpg",p:"Carousel Caption #4"}
])`,

	Dropdowns:
`+dropdown("My Dropdown Menu",[
	{text:"Bootstrap",url:"http://www.getbootstrap.com"},
	{text:"JADE",url:"http://www.jade-lang.com"},
	{text:"NodeJS",url:"http://www.nodejs.org"}
])`,

	Forms:
`TODO`,

	Glyphicons:
`+icon("search")`,


	Images:
`+img-responsive("images/slide1.jpg","Responsive Image")`,


	Labels:
`+label-default("Default")`,

	'List Groups':
`+list-group(["1","2","3","4"])`,

	Modals: 
`button.btn.btn-primary(data-toggle="modal",data-target="#myModal") Launch demo modal
+modal("Modal title","myModal")
	p This is modal content`,

	Navbar:
`+navbar("Project name","dropdown_menu")`,

	Navs:
`+nav-tabs([{text:"Home",href:"#"},{text:"Profile",href:"#"},{text:"Message",href:"#"}],0)`,

	Panels:
`+panel-primary("Primary Panel")
	p This is primary panel`,

	'Progress Bars':
`+progress-bar(50)`,

	Tables:
`+table(["#","First Name","Last Name","Username"],[["1","Mark","Otto","@mdo"],["2","Jacob","Thornton","@fat"],["3","Larry","the Bird","@twitter"]])`,

	Tabs:
`+tab-list(["Home","Profile","Messages","Settings"],0)
	+tab("Home","active")
		h1 Home
			p This is Home tab
	+tab("Profile")
		h1 Profile
			p This is Profile tab`,

	Toggle:
`+toggle-primary("Single toggle")`,

	Tooltips:
`+tooltip-left("This is a tooltip on the left")`,

	URL:
`a(href="#") URL`
};

const snipets_str = {
	// if else
	'if else':{
		snipet:
`- var condition = true
if condition
	p True
else
	p False`,
		no_new_line:false
	},

	// id
	id:{
		snipet:`(id="myId")`,
		no_new_line:true
	},

	// case
	'case':{
		snipet:
`- var case_var = 1
case case_var 
	when 0
		p= case_var
	when 1
		p= case_var
	default
		p= case_var`,
		no_new_line:false
	},

	// each list
	'each list':{
		snipet:
`each val in [1,2,3]
	p= val
else
	p Empty`,
		no_new_line:false
	},

	// each list
	'each obj':{
		snipet:
`each val, key in {a:'b'}
	p= key + ':' + val
else
	p Empty`,
		no_new_line:false
	},

	// js eval
	'js eval':{
		snipet:
`p #{0}`,
		no_new_line:true
	},

	// while
	'while':{
		snipet:
`- var n= 0
while n < 3
	cannot_be_empty_otherwise_infinite_loop= n++`
		,
		no_new_line:false
	}

};

function is_white (line) {
	return line.trim().length === 0;
}

function get_tabs (line) {
	let tabs = '';
	for(let i=0; i<line.length; i++){
		if (line[i]==' ' || line[i]=='\t') {
			tabs += '\t';
		} else {
			break;
		}
	}
	return tabs;
}

function add_tabs (str, tabs, first_line_tab) {
	let lines = str.split('\n');
	let new_lines = '';
	for(let i=0; i<lines.length; i++){
		if (i===0 && !first_line_tab)
			new_lines += lines[i];
		else
			new_lines += tabs + lines[i];
		if (i<lines.length-1){
			new_lines += '\n';
		}
	}
	return new_lines;
}

function insert_str (editor, add, no_new_line) {
	let c = editor.getCursor();
	let cur_line = editor.getLine(c.line);
	let white_line = is_white(cur_line);


	if (add) {
		let pos = {
			line: c.line,
			ch: cur_line.length
		};

		let tabs = no_new_line ? '' : get_tabs(cur_line);
		let first_line_tab = no_new_line||!white_line;
		let new_line = add_tabs(add, tabs, first_line_tab);
		let prepend = no_new_line ? '' : '\n';
		if (!white_line){
			new_line = prepend + new_line;
		} else {
			new_line += prepend + tabs;
		}
		editor.replaceRange(new_line, pos);
	}

}

$(document).ready(function () {
	$('.dropdown-toggle').dropdown();

	$('#pug-components .dropdown-menu li a').click(function(e){
		insert_str(pug_editor, component_str[e.target.text]);
	});

	$('#pug-grid .dropdown-menu li a').click(function(e){
		insert_str(pug_editor, '.' + e.target.text);
	});

	$('#pug-snipets .dropdown-menu li a').click(function(e){
		let s = snipets_str[e.target.text];
		if (s) {
			insert_str(pug_editor, s.snipet, s.no_new_line);
		}
	});

});
