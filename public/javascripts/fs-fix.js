if (typeof window !== 'undefined') {   
    /**
     *  client based path.js 
     * 
     */
    require.register("path.js", function(module, exports, require){
        var list = [];
        module.exports = {
            dirname : function(path) {
                path = path || ""; 
                var arr = path.split("/");
                arr.pop();

                return arr.join("/");    
            },
            basename : function(path) {
                path = path || "";             
                var arr = path.split("/");
                return arr.pop();
            },
            join : function() {
                var list = [];
                for(var i = 0, len = arguments.length; i < len; i++) { 
                    list.push(arguments[i]);
                }

                return  list.join("/");
            }
        }
    })

    /**
     * client based fs.js 
     * 
     */
    require.register("fs.js", function(module, exports, require){
        module.exports = {
            readFileSync : function (filename, encoding) { 
                var xhr = new XMLHttpRequest();
                xhr.open('GET', filename, false);
                xhr.send(null);

                return xhr.responseText;           
            }   
        }
    })  
}
