var textfield;
var submitbutton;
var outputfield;
var clearbutton;


// ---------- SCHEME TYPE DECLARATIONS AND SETUP ----------


// This solves all my problems with JS's prototypical inheritance :D
function Namespace(inheritedNamespace) { 
    function Namespace() {}; 
    Namespace.prototype = inheritedNamespace; 
    return new Namespace(); 
};

var globalNamespace = Namespace(null);


var Exp = function () {
};
var SpecialForm = function () {
    this.type = "SpecialForm";
};
var Type = function() {
    this.eval = function() { return this; } ;
};

var Num = function (value) { 
    this.type="Num";
    this.value=value; //JS floating point
    this.toString = function(){
        return ""+this.value;
    }
};
var Str = function (value) { 
    this.type="Str";
    this.value=value; //JS string
    this.toString = function(){
        return "\""+this.value+"\"";
    }
};
var Bool = function (value) { 
    this.type="Bool";
    this.value=value; //JS boolean, either true or false
    this.toString = function(){
        return (this.value? "#t" : "#f");
    }
};
var Sym = function (value) { 
    this.type="Sym";
    this.value=value; //JS string
    this.toString = function() {
        return "\'"+this.value;
    }
};
var Char = function (value) {
    this.type="Char";
    this.value=value; //JS string, length 1
    this.toString = function() {
        return "#\\"+this.value;
    }
    if (value ==="newline") {
        this.value = "\\n";
        this.toString = function () {
            return "\#\\newline";
        }
    }
};
var List = function () {
};
var Empty = function () {
    this.type="Empty";
    this.toString = function () { 
        return "empty"; 
    };
};
var Cell = function (left, right) {
    this.type="Cell";
    this.left = left;
    this.right = right;
    this.toString = function () {
        var rest = this.right.toString();
        if (rest.substring(0,6) ==="\(list " && rest.substring(rest.length-1) === "\)")
            rest = rest.substring(5,rest.length-1);
        else if (rest ==="empty")
            rest = "";
            
        return "\(list "+this.left.toString()+rest+"\)";
    }
}
var Lambda = function (ids, body, namespace) {
    // ids is an Array of Strings that is declared in the sub-namespace
    // body is the Exp that will involve members of ids
    
    this.type="Lambda";
    
    this.name = "lambda";
    this.minParamCount = ids.length;
    this.hasRestArgument = false;
    var restDot = ids.indexOf(".");
    if (restDot!== -1 && restDot + 2 === ids.length) {
        this.hasRestArgument = true;
        this.minParamCount = restDot;       
    }
    
    this.ids=ids;
    this.body = body;
    this.inheritedNamespace = namespace;
    
    this.eval = function (syntaxStrTreeArg, namespace) {
        var lambdaNamespace = Namespace(this.inheritedNamespace);
        if (syntaxStrTreeArg.length - 1 == this.minParamCount 
        || (syntaxStrTreeArg.length - 1 >= this.minParamCount && this.hasRestArgument)) {
            for (var i=0; i< this.minParamCount; ++i) {
                lambdaNamespace[ids[i]]=syntaxStrTreeArg[i+1];
            }
            if (this.hasRestArgument) {
                listMake = ["list"].concat(syntaxStrTreeArg.slice(this.minParamCount+1));
                lambdaNamespace[ids[this.minParamCount+1]] = parseExpTree(listMake,lambdaNamespace);
            }
            var result = parseExpTree(body, lambdaNamespace);
            if (result)
                return result;
            else {
                console.log("Lambda evaluation error.");
                return null;
            }
        } else {
            outputlog("Function parameter count mismatch.");
            return null;
        }
        
    };
}

SpecialForm.prototype = new Exp();
Type.prototype = new Exp();
Num.prototype = new Type();
Str.prototype = new Type();
Bool.prototype = new Type();
Sym.prototype = new Type();
Char.prototype = new Type();
Lambda.prototype = new Type();
List.prototype = new Type();
Empty.prototype = new List();
Cell.prototype = new List();



function populateSpecialForms() {
    var keywords = {};
    keywords["true"] = new Bool(true);
    keywords["false"] = new Bool(false);
    keywords["empty"] = new Empty();
    keywords["and"] = new SpecialForm();
    keywords["and"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "and"
        // in the form of :
        // (and exp exp ... exp) 
        var predicate = true;
        
        for (var i=1; i< syntaxStrTree.length && predicate; ++i) {
            var exp = parseExpTree(syntaxStrTree[i], namespace);
            if (exp.type === "Bool")
                predicate = predicate && exp.value;
            else {
                outputlog("and evaluation result not Bool.");
                return null;
            }
        }
        return new Bool(predicate);     
    };
    keywords["or"] = new SpecialForm();
    keywords["or"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "or"
        // in the form of :
        // (or exp exp ... exp) 
        var predicate = false;
        
        for (var i=1; i< syntaxStrTree.length && !predicate; ++i) {
            var exp = parseExpTree(syntaxStrTree[i], namespace);
            if (exp.type === "Bool")
                predicate = predicate || exp.value;
            else {
                outputlog("or evaluation result not Bool.");
                return null;
            }
        }
        return new Bool(predicate);  
    };
    keywords["define"] = new SpecialForm();
    keywords["define"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "define"
        // in the form of :
        // (define id exp) for objects
        // (define (function-name id id ... id) exp) for functions
        
        var result;
        var id;
        var body = syntaxStrTree[2];
        
        if (Array.isArray(syntaxStrTree[1])) { //function define 
            id = syntaxStrTree[1][0];
            var lambdaIds = syntaxStrTree[1].slice(1);
            result = new Lambda(lambdaIds, body, namespace);
        } else { // object define
            id = syntaxStrTree[1];
            result = parseExpTree(body,namespace);
        }
        
        if (result) {
            namespace[id] = result;
            return true; //for no errors
        } else {
            outputlog("define body evaluation failed.");
        }
    };
    keywords["local"] = new SpecialForm();
    keywords["local"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (local (exp exp ... exp) body)
        
        var localNamespace = Namespace(namespace);
        
        // make id's first
        syntaxStrTree[1].map(function(cur,i,arr) { localNamespace[(Array.isArray(cur[1])?cur[1][0]:cur[1])]=null; });
        // THEN bind
        var defEval = syntaxStrTree[1].map(function(cur,i,arr) { return parseExpTree(cur,localNamespace); });
        var defSuccess = defEval.reduce(function(prev,cur,i,arr) { return prev && cur; }, true);
        if (defSuccess) {
            var result = parseExpTree(syntaxStrTree[2],localNamespace);
            if (result) {
                return result;
            } else {
                outputlog("local body evaluation failed.");
                return null;
            } 
        } else {
            outputlog("local definition body evaluation failed.");
            return null;
        }
    }
    keywords["lambda"] = new SpecialForm();
    keywords["lambda"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "lambda"
        // in the form of :
        // (local (id id ... id) body)
        
        var ids = syntaxStrTree[1];
        var body = syntaxStrTree[2];
        
        return new Lambda(ids, body, namespace);
    }
    keywords["cond"] = new SpecialForm();
    keywords["cond"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "cond"
        // in the form of :
        // (cond (bool exp) (bool exp) ... (else exp))
        
        if (Array.isArray(syntaxStrTree)) {
            for (var i=1; i< syntaxStrTree.length; ++i) {
                if (syntaxStrTree[i][0] && syntaxStrTree[i][0] === "else") {
                    return parseExpTree(syntaxStrTree[i][1], namespace);
                }
                else {
                    var predicate = parseExpTree(syntaxStrTree[i][0], namespace);
                    if (predicate && predicate instanceof Bool && predicate.value) {
                        return parseExpTree(syntaxStrTree[i][1], namespace);
                    } //else {} //do nothing, go to next predicate
                } 
            }
            // Should have exited by now
            outputlog("No else condition was found.");
            return null;
        } else {
            outputlog("cond conditions are invalid.");
            return null;
        } 
    }
    keywords["if"] = new SpecialForm();
    keywords["if"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "if"
        // in the form of :
        // (if predicate? true-exp false-exp))
        
        if (Array.isArray(syntaxStrTree) && syntaxStrTree.length===4) {
            var predicate = parseExpTree(syntaxStrTree[1], namespace);
            if (predicate && predicate.type==="Bool") {
                if (predicate.value) {
                    return parseExpTree(syntaxStrTree[2], namespace);
                } else {
                    return parseExpTree(syntaxStrTree[3], namespace);
                }
            } else {
                outputlog("if predicate gave error or was not type Bool.")
                return null;
            }
        } else {
            outputlog("if is invalid or does not have 3 arguments.");
            return null;
        } 
    }
    return keywords;
};

var specialForms = populateSpecialForms();

function populateStandardFunctions(namespace) {
    namespace["number?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["number?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Num") {
            outputlog("number? requires 1 Num argument.");
            return null;
        }
        return new Bool(syntaxStrTreeArg[1].type === "Num");
    }
    namespace["boolean?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["boolean?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Bool") {
            outputlog("boolean? requires 1 Bool argument.");
            return null;
        }
        return new Bool(syntaxStrTreeArg[1].type === "Bool");
    }
    namespace["false?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["false?"].eval = function(syntaxStrTreeArg, namespace) {
        return new Bool(syntaxStrTreeArg[1].type === "Bool" && !syntaxStrTreeArg[1].value);
    }
    namespace["string?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["string?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Str") {
            outputlog("string? requires 1 Str argument.");
            return null;
        }
        return new Bool(syntaxStrTreeArg[1].type === "Str");
    }
    namespace["char?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["char?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Char") {
            outputlog("char? requires 1 Char argument.");
            return null;
        }
        return new Bool(syntaxStrTreeArg[1].type === "Char");
    }
    namespace["expt"] = new Lambda(["x","y"], new Exp(), namespace);
    namespace["expt"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.pow(syntaxStrTreeArg[1], syntaxStrTreeArg[2]));
    }
    namespace["exp"] = new Lambda(["x"], new Exp(), namespace);
    namespace["exp"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.pow(Math.E, syntaxStrTreeArg[1].value));
    }
    namespace["log"] = new Lambda(["x"], new Exp(), namespace);
    namespace["log"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.log(syntaxStrTreeArg[1].value));
    }
    namespace["sin"] = new Lambda(["x"], new Exp(), namespace);
    namespace["sin"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.sin(syntaxStrTreeArg[1].value));
    }
    namespace["cos"] = new Lambda(["x"], new Exp(), namespace);
    namespace["cos"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.cos(syntaxStrTreeArg[1].value));
    }
    namespace["tan"] = new Lambda(["x"], new Exp(), namespace);
    namespace["tan"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.tan(syntaxStrTreeArg[1].value));
    }
    namespace["asin"] = new Lambda(["x"], new Exp(), namespace);
    namespace["asin"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.asin(syntaxStrTreeArg[1].value));
    }
    namespace["acos"] = new Lambda(["x"], new Exp(), namespace);
    namespace["acos"].eval = function(syntaxStrTreeArg, namespace) {
        return new Num(Math.acos(syntaxStrTreeArg[1].value));
    }
    namespace["atan"] = new Lambda(["x","y"], new Exp(), namespace); // 1 or 2 arguments
    namespace["atan"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length ===2)
            return new Num(Math.atan(syntaxStrTreeArg[1].value));
        else // if(syntaxStrTreeArg.length ===3)
            return new Num(Math.atan2(syntaxStrTreeArg[1].value,syntaxStrTreeArg[2].value));
    }
    namespace["+"] = new Lambda([".","x"], new Exp(), namespace);
    namespace["+"].eval = function(syntaxStrTreeArg, namespace) {
        var count = 0;
        for (var i=1; i< syntaxStrTreeArg.length; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                count += syntaxStrTreeArg[i].value;
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Num(count);
    }
    namespace["-"] = new Lambda(["x",".","y"], new Exp(), namespace);
    namespace["-"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length>=2 && syntaxStrTreeArg[1].type === "Num"){
            var count = syntaxStrTreeArg[1].value;
            for (var i=2; i< syntaxStrTreeArg.length; ++i) {
                if (syntaxStrTreeArg[i].type === "Num")
                    count -= syntaxStrTreeArg[i].value;
                else {
                    outputlog("Not all arguments were Num Type");
                    return null;
                }
            }
            if (syntaxStrTreeArg.length === 2)
                count *= -1;
            
            return new Num(count);
        } else {
            outputlog("Not all arguments were Num Type");
            return null;
        }
    }
    namespace["*"] = new Lambda([".","x"], new Exp(), namespace);
    namespace["*"].eval = function(syntaxStrTreeArg, namespace) {
        var count = 1;
        for (var i=1; i< syntaxStrTreeArg.length; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                count *= syntaxStrTreeArg[i].value;
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Num(count);
    }
    namespace["/"] = new Lambda(["x",".","y"], new Exp(), namespace);
    namespace["/"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length>=2 && syntaxStrTreeArg[1].type === "Num"){
            var count = syntaxStrTreeArg[1].value;
            for (var i=2; i< syntaxStrTreeArg.length; ++i) {
                if (syntaxStrTreeArg[i].type === "Num")
                    count /= syntaxStrTreeArg[i].value;
                else {
                    outputlog("Not all arguments were Num Type");
                    return null;
                }
            }
            if (syntaxStrTreeArg.length === 2)
                count = 1/count;
            //if (isFinite(count))
                return new Num(count);
            /*else {
                console.log("Division error.");
                return null;
            }*/
        } else {
            outputlog("Not all arguments were Num Type");
            return null;
        }
    }
    namespace["="] = new Lambda(["x","y",".","rst"], new Exp(), namespace);
    namespace["="].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("= requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                equal = equal && (syntaxStrTreeArg[i].value === syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace["<"] = new Lambda(["x","y",".","rst"], new Exp(), namespace);
    namespace["<"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("< requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                equal = equal && (syntaxStrTreeArg[i].value < syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace["<="] = new Lambda(["x","y",".","rst"], new Exp(), namespace);
    namespace["<="].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("<= requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                equal = equal && (syntaxStrTreeArg[i].value <= syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace[">"] = new Lambda(["x","y",".","rst"], new Exp(), namespace);
    namespace[">"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("> requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                equal = equal && (syntaxStrTreeArg[i].value > syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace[">="] = new Lambda(["x","y",".","rst"], new Exp(), namespace);
    namespace[">="].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog(">= requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                equal = equal && (syntaxStrTreeArg[i].value >= syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Num Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace["remainder"] = new Lambda(["num","mod"], new Exp(), namespace);
    namespace["remainder"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("remainder requires exactly 2 arguments.");
            return null;
        }
        return new Num(syntaxStrTreeArg[1].value % syntaxStrTreeArg[2].value);
    }
    namespace["modulo"] = new Lambda(["num","mod"], new Exp(), namespace);
    namespace["modulo"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("modulo requires exactly 2 arguments.");
            return null;
        }
        var remainder = syntaxStrTreeArg[1].value % syntaxStrTreeArg[2].value;
        if (syntaxStrTreeArg[1].value * syntaxStrTreeArg[2].value < 0) // if signs are opposite
            while(remainder* syntaxStrTreeArg[2].value < 0)
                remainder += syntaxStrTreeArg[2].value;
        return new Num(remainder);
    }
    namespace["abs"] = new Lambda(["x"], new Exp(), namespace);
    namespace["abs"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("abs requires exactly 1 argument.");
            return null;
        }
        return new Num(Math.abs(syntaxStrTreeArg[1].value));
    }
    namespace["floor"] = new Lambda(["x"], new Exp(), namespace);
    namespace["floor"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("floor requires exactly 1 argument.");
            return null;
        }
        return new Num(Math.floor(syntaxStrTreeArg[1].value));
    }
    namespace["ceiling"] = new Lambda(["x"], new Exp(), namespace);
    namespace["ceiling"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("ceiling requires exactly 1 argument.");
            return null;
        }
        return new Num(Math.ceil(syntaxStrTreeArg[1].value));
    }
    namespace["string=?"] = new Lambda(["str1","str2",".","rst"], new Exp(), namespace);
    namespace["string=?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("string=? requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Str")
                equal = equal && (syntaxStrTreeArg[i].value === syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Str Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace["substring"] = new Lambda(["str","start",".","end"], new Exp(), namespace);
    namespace["substring"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length <= 2 && syntaxStrTreeArg[1].type !== "Str") {
            outputlog("substring requires at least 2 arguments.");
            return null;
        }
        var str = syntaxStrTreeArg[1].value;
        var start = syntaxStrTreeArg[2].value;
        var end;
        if (syntaxStrTreeArg[3])
            end = syntaxStrTreeArg[3].value;
        else 
            end = str.length;
        return new Str(str.substring(start,end));
    }
    namespace["string-ref"] = new Lambda(["str","index"], new Exp(), namespace);
    namespace["string-ref"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length != 3 && syntaxStrTreeArg[1].type !== "Str" && syntaxStrTreeArg[2].type !== "Num") {
            outputlog("string-ref requires a Str and Num argument.");
            return null;
        }
        var chr = syntaxStrTreeArg[1].value.charAt(syntaxStrTreeArg[2].value);
        return new Char(chr);
    }
    namespace["string-length"] = new Lambda(["str"], new Exp(), namespace);
    namespace["string-length"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length <= 2 && syntaxStrTreeArg[1].type !== "Str") {
            outputlog("string-length requires at least 2 arguments.");
            return null;
        }
        return new Num(syntaxStrTreeArg[1].value.length);
    }
    namespace["string-append"] = new Lambda([".","rststr"], new Exp(), namespace);
    namespace["string-append"].eval = function(syntaxStrTreeArg, namespace) {
        var str = "";
        for (var i=1; i< syntaxStrTreeArg.length; ++i) {
            if (syntaxStrTreeArg[i].type === "Str")
                str += syntaxStrTreeArg[i].value;
            else {
                outputlog("Not all arguments were Str Type");
                return null;
            }
        }
        return new Str(str);
    }
    namespace["string"] = new Lambda([".","rstchar"], new Exp(), namespace);
    namespace["string"].eval = function(syntaxStrTreeArg, namespace) {
        var str = "";
        for (var i=1; i< syntaxStrTreeArg.length; ++i) {
            if (syntaxStrTreeArg[i].type === "Char")
                str += syntaxStrTreeArg[i].value;
            else {
                outputlog("Not all arguments were Char Type");
                return null;
            }
        }
        return new Str(str);
    }
    namespace["string->list"] = new Lambda(["str"], new Exp(), namespace);
    namespace["string->list"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2 && syntaxStrTreeArg[1].type !== "Str") {
            outputlog("string->list requires 1 Str argument.");
            return null;
        }
        var chrlist = new Array(syntaxStrTreeArg[1].value.length+1);
        chrlist[0] = "list";
        var shift=0;
        for (var i=0; i+ shift< syntaxStrTreeArg[1].value.length; ++i) {
            if (syntaxStrTreeArg[1].value.substring(i+shift,i+shift+1) ==="\\"){
                var special = syntaxStrTreeArg[1].value.substring(i+shift,i+shift+2);
                var make;
                if (special === "\\n")
                    make = "newline";
                chrlist[i+1] = new Char(make);
                shift++;
                i++;
            } else {
                chrlist[i+1] = new Char(syntaxStrTreeArg[1].value.substring(i+shift,i+shift+1));
            }
        }
        return parseExpTree(chrlist.slice(0,chrlist.length-shift),namespace);
    }
    namespace["char=?"] = new Lambda(["chr1","chr2",".","rst"], new Exp(), namespace);
    namespace["char=?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("char=? requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Char")
                equal = equal && (syntaxStrTreeArg[i].value === syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Char Type");
                return null;
            }
        }
        return new Bool(equal);
    }
    namespace["not"] = new Lambda(["x"], new Exp(), namespace);
    namespace["not"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length == 2 && syntaxStrTreeArg[1].type === "Bool") {
            return new Bool(!syntaxStrTreeArg[1].value);
        } else {
            outputlog("not did not receive 1 Bool.");
            return null;
        }
    }
    namespace["cons"] = new Lambda(["x","y"], new Exp(), namespace);
    namespace["cons"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 3) {
            return new Cell(syntaxStrTreeArg[1], syntaxStrTreeArg[2]);  
        } else {
            outputlog("cons was not called with 2 parameters.");
            return null;
        }         
    }
    namespace["first"] = new Lambda(["x"], new Exp(), namespace);
    namespace["first"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Cell) {
            return syntaxStrTreeArg[1].left;
        } else {
            outputlog("first was not called with 1 cons cell.");
            return null;
        }         
    }
    namespace["rest"] = new Lambda(["x"], new Exp(), namespace);
    namespace["rest"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Cell) {
            return syntaxStrTreeArg[1].right;
        } else {
            outputlog("rest was not called with 1 cons cell.");
            return null;
        }         
    }
    namespace["empty?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["empty?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof List) {
            return new Bool(syntaxStrTreeArg[1].type === "Empty");
        } else {
            outputlog("empty? was not called with 1 list.");
            return null;
        }         
    }
    namespace["cons?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["cons?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof List) {
            return new Bool(syntaxStrTreeArg[1].type === "Cell");
        } else {
            outputlog("cons? was not called with 1 list.");
            return null;
        }         
    }
    namespace["list?"] = new Lambda(["x"], new Exp(), namespace);
    namespace["list?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Type) {
            if (syntaxStrTreeArg[1].type === "Empty") 
                return new Bool(true);
            else if (!(syntaxStrTreeArg[1] instanceof Cell))
                return new Bool(false);
            else 
                return this.eval(["list?", syntaxStrTreeArg[1].right], namespace);
        } else {
            outputlog("list? was not called with an expression.");
            return null;
        }         
    }
    namespace["list"] = new Lambda([".","lst"], new Exp(), namespace);
    namespace["list"].eval = function(syntaxStrTreeArg, namespace) {
        var cons = new Empty();
        for (var i=syntaxStrTreeArg.length-1; i >= 1; --i) {
            var cell = new Cell();
            cell.right = cons;
            cell.left = syntaxStrTreeArg[i];
            cons = cell;
        }
        return cons;
    }
    namespace["identity"] = new Lambda(["x"], new Exp(), namespace);
    namespace["identity"].eval = function(syntaxStrTreeArg, namespace) {
        return syntaxStrTreeArg[1];
    }
    namespace["apply"] = new Lambda(["fn","list-arg"], new Exp(), namespace);
    namespace["apply"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 3 && parseExpTree(["list?", syntaxStrTreeArg[2]],namespace).value === true) {
            var arr;
            if (namespace["length"])
                arr = new Array(parseExpTree(["length", syntaxStrTreeArg[2]],namespace).value + 1);
            else 
                arr = [];
            arr[0]=syntaxStrTreeArg[1];
            var count = 1;
            var list = syntaxStrTreeArg[2];
            while(list.type !== "Empty") {
                arr[count]=list.left;
                list = list.right;
                count++;
            }
            return parseExpTree(arr, namespace);  
        } else {
            outputlog("apply was called incorrectly");
            return null;
        }
    }
}
populateStandardFunctions(globalNamespace);
    
    





// ---------- INIT ----------


var ready = false;
prep();

function prep() {
    textfield = document.getElementById("code-field");
    outputfield = document.getElementById("code-output");
    submitbutton = document.getElementById("submit-button");
    clearbutton = document.getElementById("clear-button");
    submitbutton.onclick=evaluate;
    textfield.onkeyup = automaticIndent;
    clearbutton.onclick = function () { outputfield.value = ""; };
    outputlog("Please wait until (2) libraries are loaded.");
    loadCode();
};

function outputlog(str) {
    outputfield.value += str+"\n";
};

function automaticIndent(e) {
    
    // Cross-browser caret position code source: 
    // http://stackoverflow.com/questions/512528/set-cursor-position-in-html-textbox
    function doGetCaretPosition (ctrl) {
        var CaretPos = 0;
        // IE Support
        if (document.selection) {
            ctrl.focus ();
            var Sel = document.selection.createRange ();
            Sel.moveStart ('character', -ctrl.value.length);
            CaretPos = Sel.text.length;
        }
        // Firefox support
        else if (ctrl.selectionStart || ctrl.selectionStart == '0')
            CaretPos = ctrl.selectionStart;
        return (CaretPos);
    }
    function setCaretPosition(ctrl, pos)
    {
        if(ctrl.setSelectionRange)
        {
            ctrl.focus();
            ctrl.setSelectionRange(pos,pos);
        }
        else if (ctrl.createTextRange) {
            var range = ctrl.createTextRange();
            range.collapse(true);
            range.moveEnd('character', pos);
            range.moveStart('character', pos);
            range.select();
        }
    }
    function trim(str) {// trim that removes whitespace but not newlines;
        return str.replace(/^[^\S\n]+|\s+$/g,'');
    }
    if (e.keyCode === 13) {
        var caretSpot = doGetCaretPosition(textfield);
        //console.log(caretSpot);
        
        var tokenizeInput = tokenize(textfield.value);
        var tokenizeInputIndexes = new Array(tokenizeInput.length);
        var tokenIndex = 0;
        var nearestLineBreak =0;
        var caretFound = false;
        var caretToToken;
        for (var i=0; i< textfield.value.length && tokenIndex < tokenizeInputIndexes.length; ++i) {
            if (textfield.value.charAt(i-1) ==="\n")
                nearestLineBreak = i;
            if (!caretToToken && i >= caretSpot) {
                caretToToken=tokenIndex-1;
                caretFound=true;
            }
            if (tokenizeInput[tokenIndex] === textfield.value.substring(i, i+ tokenizeInput[tokenIndex].length)) {
                tokenizeInputIndexes[tokenIndex] = i - nearestLineBreak;
                i = i+tokenizeInput[tokenIndex].length-1;
                tokenIndex++;               
            }
        }
        if (!caretFound)
            caretToToken = tokenizeInput.length-1;
        
        //console.log("caretToToken: "+caretToToken);
        //console.log(tokenizeInput);
        //console.log(tokenizeInputIndexes);     
        
        if (tokenizeInput[caretToToken] ==="(" || tokenizeInput[caretToToken] ==="[") {
            textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[caretToToken]+2).join(" ") + trim(textfield.value.substring(caretSpot));
            setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[caretToToken]+1);
        } else{
            var hasBracket = false;
            var bracketIndex =0;
            var diff = 0;
            for (var i=caretToToken; i>=0; --i) {
                if (tokenizeInput[i] === ")" || tokenizeInput[i] === "]")
                    diff++;
                else if (tokenizeInput[i] === "(" || tokenizeInput[i] === "[")
                    diff--;
                if (diff<0) {
                    bracketIndex=i;
                    hasBracket = true;
                    i=-1; //exit loop
                }
            }
            if (hasBracket) {
                var keyword = tokenizeInput[bracketIndex+1];
                var inLineArguments = !(bracketIndex+1 +1 == tokenizeInput.length);
                //console.log("bracketIndex+1:" +(bracketIndex+1));
                //console.log("tokenizeInput.length:"+ tokenizeInput.length);
                //console.log("inLineArguments:"+inLineArguments);
                
                function searchBackwards() {
                    if (tokenizeInput[caretToToken] === ")" || tokenizeInput[caretToToken] === "]") {
                        var bracketIndex =0;
                        var diff = 0;
                        for (var i=caretToToken-1; i>=0; --i) {
                            if (tokenizeInput[i] === ")" || tokenizeInput[i] === "]")
                                diff++;
                            else if (tokenizeInput[i] === "(" || tokenizeInput[i] === "[")
                                diff--;
                            if (diff<0) {
                                bracketIndex=i;
                                i=-1; //exit loop
                            }
                        }
                        return bracketIndex;
                    } else {
                        return caretToToken;
                    }
                };
                
                if (keyword === "(" || keyword === "[") { //lambda
                    textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+1).join(" ") + trim(textfield.value.substring(caretSpot));
                    setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+0);
                } else if (["define", "local"].indexOf(keyword)!=-1) {
                    textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+2).join(" ") + trim(textfield.value.substring(caretSpot));
                    setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+1);
                } else if (["lambda", "let", "let*", "letrec"].indexOf(keyword)!=-1) {
                    if (inLineArguments) {
                        textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+2).join(" ") + trim(textfield.value.substring(caretSpot));
                        setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+1);
                    } else {
                        textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+4).join(" ") + trim(textfield.value.substring(caretSpot));
                        setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+3);
                    }
                } else if (["cond"].indexOf(keyword)!=-1) {
                    if (inLineArguments) {
                        textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[searchBackwards()]+1).join(" ") + trim(textfield.value.substring(caretSpot));
                        setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[searchBackwards()]+0);
                    } else {
                        textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+2).join(" ") + trim(textfield.value.substring(caretSpot));
                        setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+1);
                    }
                } else { //regular function
                    textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[searchBackwards()]+1).join(" ") + trim(textfield.value.substring(caretSpot));
                    setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[searchBackwards()]);
                }
            } else {
                textfield.value = textfield.value.substring(0,caretSpot) + textfield.value.substring(caretSpot).trim();
                setCaretPosition(textfield, caretSpot);
            }
        }
    }
};

function loadCode(){
    // Apparently needed for compatibility with older browsers
    if (typeof XMLHttpRequest === "undefined") {
        XMLHttpRequest = function () {
            try { return new ActiveXObject("Msxml2.XMLHTTP.6.0"); }
            catch (e) {}
            try { return new ActiveXObject("Msxml2.XMLHTTP.3.0"); }
            catch (e) {}
            try { return new ActiveXObject("Microsoft.XMLHTTP"); }
            catch (e) {}
            throw new Error("This browser does not support XMLHttpRequest.");
        };
    }
    function requestFile(filePath) {
        ready = false;
        var httpReq = new XMLHttpRequest();
        httpReq.open("get", filePath, true);
        httpReq.onreadystatechange = function() {
            if (httpReq.readyState===4) {
                var response = httpReq.responseText;
                ready = true;
                importCode(response);
                var filename = filePath.split(/\//g)
                outputlog(filename[filename.length-1]+" library loaded!");
                
            }
        }
        httpReq.send();
    }
    requestFile("libraries/list-functions.rkt");
    requestFile("libraries/other-functions.rkt");
}

function tokenize(input) {
    var temp = input.replace(/[\(\)\[\]]/g, function(a){return " "+a+" ";})
    //|(?=[\(\)\[\]])|(?<=[\(\)\[\]])
    // Why does JS not support positive look-behind? :(
    //console.log(temp);
    var temp2 = "";
    var quoteEnabled = false;
    for (var i=0; i< temp.length; ++i) {
        if (temp.charAt(i) === "\"")
            quoteEnabled = true;
        
        if (quoteEnabled) {
            var quoteEnd = i;
            for (var j=i+1; j< temp.length; ++j) {
                if (temp.charAt(j) === "\"") {
                    quoteEnd = j;
                    j = temp.length;
                }
            }
            if (quoteEnd === i) {
                console.log("Mismatching quotes when tokenizing.");
                return null;
            }
            var quoted = temp.substring(i, quoteEnd+1);
            var unquoted = quoted.replace(/ [\(\)\[\]] /g, function(a){return a.charAt(1);});
            
            temp2 += unquoted;
            i = quoteEnd;
            quoteEnabled = false;
        }
        else 
            temp2 +=temp.charAt(i);
    }
    // Semicolon to account for comments
    var temp3 = temp2.split(/[\s\n]+|\;.*\n/g); 
    return temp3.filter( function(str){return str!="";} );
};

function importCode(str){
    var temp = textfield.value;
    textfield.value = str;
    evaluate();
    textfield.value = temp;
};

function evaluate() {
    if (ready) {
        var rawCode = textfield.value;
        var tokenizedInput = tokenize(rawCode);
        
        console.log(tokenizedInput);

        var syntaxStrTreeBlocks = parseStr(tokenizedInput);
        if (!syntaxStrTreeBlocks) {
            //error occurred
            outputlog("Error occurred parsing or tokenizing code.");
            return null;
        }
        //var output = syntaxStrTreeBlocks.map(printCode).reduce(function(prev,cur,i,arr) { return prev+(i>0?"\n":"")+cur; },"");
        //console.log("\n"+output);
        
        stepExp = syntaxStrTreeBlocks; 
        stepExp = parseStepExpBlocks(stepExp);
        while (stepExp.length > 0) {
            stepExp = parseStepExpBlocks(stepExp);
        }
    }
};

function printCode(syntaxStrTreeBlocks) {
    if (Array.isArray(syntaxStrTreeBlocks)) {
        var code = "(";
            for (var i=0; i< syntaxStrTreeBlocks.length; ++i)
            {
                code += printCode(syntaxStrTreeBlocks[i]);
                if (i < syntaxStrTreeBlocks.length-1)
                code +=" ";
            }
        
        code +=")"
        return code;
    } else 
        return ""+ syntaxStrTreeBlocks;
};


function parseStr(strArr) {
    
    //This is a preliminary check for correct bracket pairing and count
    var bracketStack = [];
    var quoteEnabled = false;
    for (var i=0; i< strArr.length; ++i) {
        if (strArr[i]==="\"") 
            quoteEnabled = !quoteEnabled;
        
        if (quoteEnabled) {} 
        else if (strArr[i]==="(" || strArr[i] === "[")
            bracketStack.push(strArr[i]);
        else if (strArr[i]===")" || strArr[i] === "]") {
            var lastBracket = bracketStack.pop();
            if (!lastBracket) {
                console.log("Extra brackets!");
                return null;
            } else if (!((lastBracket === "[" && strArr[i] === "]") ||
            (lastBracket === "(" && strArr[i] === ")"))) {
                console.log("Brackets paired incorrectly!");
                return null;
            }
            //Otherwise, brackets fine
        }   
    }
    if (quoteEnabled) {
        console.log("Missing quotation marks");
        return null;
    }
    if (bracketStack.length>0) {
        console.log("Missing brackets!");
        return null;
    }
    
    quoteEnabled = false;
    //Check passed: now normalize brackets
    for (var i=0; i< strArr.length; ++i) {
        if (strArr[i]==="\"") 
            quoteEnabled = !quoteEnabled;
            
        if (quoteEnabled) {} 
        else if (strArr[i] === "[")
            strArr[i] = "(";
        else if (strArr[i] === "]")
            strArr[i] = ")";
    }
    
    //Recognize first level code blocks;
    var strCodeBlocks = recognizeBlock(strArr);
    
    //console.log("Parsed String Code Blocks:" );
    //console.log(strCodeBlocks);
    
    //Recursively generate tree of code syntax
    var parsedStrCodeTree = new Array (strCodeBlocks.length);
    for (var i=0; i< strCodeBlocks.length; ++i) {
        if (Array.isArray(strCodeBlocks[i]))
            parsedStrCodeTree[i] = recursivelyBuildCodeTree(strCodeBlocks[i]);
        else
            parsedStrCodeTree[i] = strCodeBlocks[i];
    }
    
    console.log("Parsed String Tree:" );
    console.log(parsedStrCodeTree);
    
    return parsedStrCodeTree;
};


function recognizeBlock(unparsedBlocks) {
    if (unparsedBlocks.length ===1)
        return unparsedBlocks;
    block = [];
    // unparsedBlocks gets shorter as it is consumed
    // experimented with scheme-style recursion where recursing element is used up
    while (unparsedBlocks.length > 0){
        if (unparsedBlocks[0]==="(") {
            var bracketcount = 1;
            for (var i=1; i<unparsedBlocks.length; ++i) {
                if (unparsedBlocks[i]==="(")
                    bracketcount++;
                else if (unparsedBlocks[i]===")") {
                    bracketcount--;
                    if (bracketcount === 0) {
                        var splicedblock = unparsedBlocks.slice(0,i+1);
                        block.push(splicedblock);
                        unparsedBlocks = unparsedBlocks.slice(i+1,unparsedBlocks.length);
                        i = unparsedBlocks.length;
                    }
                }
            }
        } else if (unparsedBlocks[0]===")"){
            console.log("Extra brackets");
            return null;
        } else {
            block.push (unparsedBlocks[0])
            unparsedBlocks = unparsedBlocks.slice(1);
        }
    }
    return block;
};

// strBlock is Array of (String)
// returns Array of (String or (Array of (String)))
function recursivelyBuildCodeTree(strBlock) {
    //console.log("recursivelyBuildCodeTree called with: ");
    //console.log(strBlock);
    if (strBlock.length>0) {
        var subBlocks = [];
        var startIndex = 0;
        var bracketCount = 0;
        
        //initial brackets
        if (strBlock[0] ==="(" && strBlock[strBlock.length-1] ===")") {
            startIndex = 1;
            bracketCount++;
            
            //tracking expressions
            //this time tried traditional for-loop with indexes for applying recursion to strBlock 
            for (var i=1; i< strBlock.length-1; ++i) {
                //subexpression
                if (strBlock[i] ==="(") {
                    
                    //console.log("Subexpression!");
                    bracketCount++;
                    
                    var closedBracketCount = bracketCount-1;
                    
                    //searches for closing bracket, then slices and recurses
                    for (var j=i+1; j< strBlock.length; ++j) {
                        //console.log("i:"+ i + ", j:" +j);
                        if (strBlock[j] ==="(")
                            bracketCount++;
                        else if (strBlock[j] ===")"){
                            bracketCount--;
                            if (closedBracketCount == bracketCount) {
                                //console.log("Found closing bracket!");
                                var subExpression = recursivelyBuildCodeTree(strBlock.slice(startIndex,j+1));
                                subBlocks.push(subExpression);
                                startIndex =j+1;
                                i=j; //i++ is done everytime
                                j = strBlock.length; //exit inner loop
                            }
                        }
                    }
                    if (closedBracketCount < bracketCount) {
                        console.log("Missing brackets");
                        return null;
                    }
                }
                else if (strBlock[j] ===")"){
                    bracketCount--;
                }
                //singleton, directly add to exp tree
                else {
                    var singleton = strBlock.slice(startIndex,i+1)[0];
                    //console.log("Singleton: ");
                    //console.log(singleton);
                    subBlocks.push(singleton);
                    startIndex=i+1;
                }
            }
            
            // decrement for closing brackets here        
            bracketCount--;
        }
        else {
            console.log("Bracket-less array code block!");
            return null;
        }
        if (bracketCount !== 0)
            console.log("Bracket count failed, produced :" + bracketCount + " instead of expected value 0");
        return subBlocks;
    }
    else if (strBlock.length == 0)
        //should not be brackets
        return strBlock[0];
    else 
        console.log("Null element!!!");
        return null;
    
};



function parseStepExpBlocks (syntaxStrBlocks) {
    if (syntaxStrBlocks.length > 0) {
        var exp = parseExpTree(syntaxStrBlocks[0], globalNamespace);
        
        /*if (Array.isArray(exp)) {
            syntaxStrBlocks[0] = exp;
            return syntaxStrBlocks; //don't need since original object is modified
        }*/
        if (exp) { // Expression is simplest form 
            if (exp !== true)
                outputlog(""+exp); //Print output to console
            return syntaxStrBlocks.slice(1); //return rest of blocks to parse
        }
    }
}

function parseLookupType(expression,namespace) {
    //console.log("Tried parsing: "+ expression);
    if (expression instanceof Type)
        return expression;
    else if (expression[0]==="\"" && expression[expression.length-1]==="\"")
        return new Str(expression.substring(1,expression.length-1));
    else if (expression[0]==="\'" && expression.length>1)
        return new Sym(expression.substring(1));
    else if (expression.substring(0,2)==="\#\\" && expression.length>2)
        return new Char(expression.substring(2));
    else if (expression[0]==="\#" && expression.length==2)
        return new Bool(expression==="\#t");
    else if (!isNaN(Number(expression)))
        return new Num(Number(expression));
    else if (specialForms[expression]) {
        //console.log("Looked up special form: "+  expression);
        return specialForms[expression];
    } else if (namespace[expression]) {
        //console.log("Looked up: "+ expression +" in namespace: " + namespace);
        return namespace[expression];
    } else {
        outputlog("Unknown type: "+expression);
        return null;
    }
}

function parseExpTree (syntaxStrTree, namespace) {
    if (Array.isArray(syntaxStrTree)) { 
        
        var lookupExp; // Expression to call, whether it is special form or function
        lookupExp = parseExpTree(syntaxStrTree[0],namespace); 
        
        //evaluate function if lookup was successful
        if (lookupExp) { 
            if (lookupExp.type === "SpecialForm") {//if special form, do not evaluate arguments, instead, branch off
                return lookupExp.eval(syntaxStrTree, namespace);
            }
            
            // evaluate the function call arguments first
            var evaluatedSyntaxStrTree = new Array(syntaxStrTree.length);
            evaluatedSyntaxStrTree[0] = syntaxStrTree[0];
            var argEvalSuccess = true;
            for (var i = 1; i< syntaxStrTree.length; ++i) {
                evaluatedSyntaxStrTree[i] = parseExpTree(syntaxStrTree[i],namespace);
                argEvalSuccess = argEvalSuccess && (evaluatedSyntaxStrTree[i] instanceof Type);
            }
            // check if it was successful in producing Types
            if (argEvalSuccess) {
                var result = lookupExp.eval(evaluatedSyntaxStrTree,namespace);
                if (result) {
                    return result;
                } else {
                    outputlog("Function "+syntaxStrTree[0]+" evaluation returned error");
                    return null;
                }
            } else {
                outputlog(""+ syntaxStrTree[0]+ " function call arguments were not all Typed");
                return null;
            }
        } else {
            outputlog("Descriptor not found: "+syntaxStrTree[0]);
            return null;
        }
    } else {
        return parseLookupType(syntaxStrTree, namespace);
    }
}

