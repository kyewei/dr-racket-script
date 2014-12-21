var textfield;
var submitbutton;
var outputfield;
var clearbutton;


// ---------- SCHEME TYPE DECLARATIONS AND SETUP ----------


// This solves all my problems with JS's prototypical inheritance :D
function Namespace(inheritedNamespace) { 
    function Namespace() {}; 
    Namespace.prototype = inheritedNamespace; 
    var newNamespace = new Namespace();
    
    //should be obfuscated enough, since ids cannot have #'s anyways.
    //__proto__ is not implemented in every browser, so this will do for now
    newNamespace["#upperNamespace"] = inheritedNamespace; 
    return newNamespace; 
};
var libraryNamespace = Namespace(null);
var globalNamespace = Namespace(libraryNamespace);

var Racket = {};

Racket.Exp = function () {
};
Racket.SpecialForm = function () {
    this.type = "SpecialForm";
};
Racket.Type = function() {
    this.eval = function() { return this; } ;
};

Racket.Num = function (value) { 
    this.type="Num";
    this.value=value; //JS floating point
    this.toString = function(){
        return ""+this.value;
    }
};
Racket.Str = function (value) { 
    this.type="Str";
    this.value=value; //JS string
    this.toString = function(){
        return "\""+this.value+"\"";
    }
};
Racket.Bool = function (value) { 
    this.type="Bool";
    this.value=value; //JS boolean, either true or false
    this.toString = function(){
        return (this.value? "#t" : "#f");
    }
};
Racket.Sym = function (value) { 
    this.type="Sym";
    this.value=value; //JS string
    this.toString = function() {
        return "\'"+this.value;
    }
};
Racket.Char = function (value) {
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
Racket.List = function () {
};
Racket.Empty = function () {
    this.type="Empty";
    this.toString = function () { 
        return "empty"; 
    };
};
Racket.Cell = function (left, right) {
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
Racket.Struct = function () {
}
Racket.Lambda = function (ids, body, namespace) {
    // ids is an Array of Strings that is declared in the sub-namespace
    // body is the Exp that will involve members of ids
    
    this.type="Lambda";
    
    this.name = "lambda";
    if (Array.isArray(ids)) {
        this.minParamCount = ids.length;
        this.hasRestArgument = false;
        var restDot = ids.indexOf(".");
        if (restDot!== -1 && restDot + 2 === ids.length) {
            this.hasRestArgument = true;
            this.minParamCount = restDot;       
        }
        this.ids=ids;
        this.restArg = ids[this.minParamCount+1];
    } else { //only rest argument
        this.minParamCount = 0;
        this.hasRestArgument = true;
        this.ids = [];
        this.restArg = ids;
    }

    
    if (body.length> 1) {
        var tailBody = body[body.length-1];
        // since Lambda can accept multiple bodies, it is essentially a local/letrec type binding
        this.body = ["local",body.slice(0,body.length-1),tailBody];
    }
    else 
        this.body = body[0];
    this.inheritedNamespace = namespace;
    
    this.eval = function (syntaxStrTreeArg, namespace) {
        var lambdaNamespace = Namespace(this.inheritedNamespace);
        if (syntaxStrTreeArg.length - 1 == this.minParamCount 
        || (syntaxStrTreeArg.length - 1 >= this.minParamCount && this.hasRestArgument)) {
            for (var i=0; i< this.minParamCount; ++i) {
                lambdaNamespace[this.ids[i]]=syntaxStrTreeArg[i+1];
            }
            if (this.hasRestArgument) {
                var listMake = ["list"].concat(syntaxStrTreeArg.slice(this.minParamCount+1));
                lambdaNamespace[this.restArg] = parseExpTree(listMake,lambdaNamespace);
            }
            var result = parseExpTree(this.body, lambdaNamespace);
            if (result)
                return result;
            else {
                outputlog("Lambda evaluation error.");
                return null;
            }
        } else {
            outputlog("Function parameter count mismatch.");
            return null;
        }
        
    };
    this.toString = function() { return "\#\<procedure\>"; };
}

Racket.SpecialForm.prototype = new Racket.Exp();
Racket.Type.prototype = new Racket.Exp();
Racket.Num.prototype = new Racket.Type();
Racket.Str.prototype = new Racket.Type();
Racket.Bool.prototype = new Racket.Type();
Racket.Sym.prototype = new Racket.Type();
Racket.Char.prototype = new Racket.Type();
Racket.Lambda.prototype = new Racket.Type();
Racket.List.prototype = new Racket.Type();
Racket.Empty.prototype = new Racket.List();
Racket.Cell.prototype = new Racket.List();
Racket.Struct.prototype = new Racket.Type();


function populateSpecialForms() {
    var keywords = {};
    keywords["true"] = new Racket.Bool(true);
    keywords["false"] = new Racket.Bool(false);
    keywords["empty"] = new Racket.Empty();
    keywords["null"] = keywords["empty"];
    keywords["and"] = new Racket.SpecialForm();
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
        return new Racket.Bool(predicate);     
    };
    keywords["or"] = new Racket.SpecialForm();
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
        return new Racket.Bool(predicate);  
    };
    keywords["define"] = new Racket.SpecialForm();
    keywords["define"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "define"
        // in the form of :
        // (define id exp) for objects
        // (define (function-name id ...) ... final-exp) for functions
        
        var result;
        var id;
        var body;
            
        if (Array.isArray(syntaxStrTree[1])) { //function define 
            id = syntaxStrTree[1][0];
            var lambdaIds = syntaxStrTree[1].slice(1);
            body = syntaxStrTree.slice(2);
            result = new Racket.Lambda(lambdaIds, body, namespace);
        } else { // object define
            id = syntaxStrTree[1];
            if (syntaxStrTree.length === 3)
                body = syntaxStrTree[2];
            else {
                outputlog("define received multiple expressions after identifier.");
                return null;
            }
            result = parseExpTree(body,namespace);
        }
        
        if (result) {
            if (!(namespace.hasOwnProperty(id)) || namespace[id] === null) {
                namespace[id] = result;
                return true; //for no errors
            } else {
                console.log(namespace);
                outputlog("Namespace already contains bound id: "+id+".");
                return false;
            }
        } else {
            outputlog("define body evaluation failed.");
            return false;
        }
    };
    keywords["define-struct"] = new Racket.SpecialForm();
    keywords["define-struct"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "define-struct"
        // in the form of :
        // (define-struct type-id (property1 property2 ...)) 
        
        var typename = syntaxStrTree[1];
        var propertyCount = syntaxStrTree[2].length;
        var propertyNames = syntaxStrTree[2];
        
        // Make Racket type inherit Type()
        // i.e. if type is posn, call is (define-struct posn (x y))
        Racket[typename] = function (data) {
            this.type = typename; //should be String
            this.propertyCount = propertyCount;
            this.propertyNames = propertyNames;

            // assert data.length === propertyCount;
            for (var i=0; i<this.propertyCount; ++i) {
                this[propertyNames[i]] = parseExpTree(data[i],namespace);
            }
            
            this.toString = function () {
                var str = "\(make-"+this.type;
                for (var i=0; i<propertyCount; ++i) {
                    str +=" ";
                    str += this[propertyNames[i]].toString();
                }
                str +="\)";
                return str;
            };
        };
        Racket[typename].prototype = new Racket.Type();
        
        // Make type-checker method 
        // i.e. if type is posn, this is (posn? posn-arg)
        namespace[typename+"?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
        namespace[typename+"?"].eval = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !==syntaxStrTree[1]) {
                outputlog(typename+"?"+" requires 1 "+typename+" argument.");
                return null;
            }
            return new Racket.Bool(syntaxStrTreeArg[1].type === typename);
        };
        // Make constructor method
        // i.e. if type is posn, this is (make-posn arg1 arg2)
        namespace["make-"+typename] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace); //has propertyCount many arguments
        namespace["make-"+typename].eval = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length != propertyCount+1) {
                outputlog("make-"+typename+" requires "+propertyCount+" argument(s).");
                return null;
            }
            return new Racket[typename](syntaxStrTreeArg.slice(1));
        };
        // Make accessor methods
        // i.e. if type is posn, this makes (posn-x posn-arg), and (posn-y posn-arg)
        for (var i=0; i< propertyCount; ++i) {
            var id = propertyNames[i];
            namespace[typename+"-"+id] = new Racket.Lambda(["obj"], new Racket.Exp(), namespace);
            namespace[typename+"-"+id].id = propertyNames[i]; // needed to do this because this makes a deep copy
            namespace[typename+"-"+id].eval = function(syntaxStrTreeArg, namespace) {
                if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !==syntaxStrTree[1]) {
                    outputlog(typename+"-"+this.id+" requires 1 "+typename+" argument.");
                    return null;
                }
                var obj = syntaxStrTreeArg[1];
                return obj[this.id];
            }
        }
        return true; // for no errors
    };
    keywords["local"] = new Racket.SpecialForm();
    keywords["local"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (local [(define ...) ...)] body)

        var localNamespace = Namespace(namespace);
        // make id's first
        syntaxStrTree[1].map(function(cur,i,arr) { if (cur[0]==="define") {localNamespace[(Array.isArray(cur[1])?cur[1][0]:cur[1])]=null;} });
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
            outputlog("local definitions evaluation failed.");
            return null;
        }
    }
    keywords["letrec"] = new Racket.SpecialForm();
    keywords["letrec"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (letrec ([id exp] [id exp] ...) body)
        
        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && Array.isArray(cur) && cur.length ===2 ; }, true)) {
            outputlog("letrec definitions not all id expression pairs");
            return null;
        }        
        
        var localNamespace = Namespace(namespace);
        
        // make id's first
        syntaxStrTree[1].map(function(cur,i,arr) { localNamespace[cur[0]]=null; });
        // THEN bind
        syntaxStrTree[1].map(function(cur,i,arr) { keywords["define"].eval(["define", cur[0], cur[1]],localNamespace); }); 
        var defSuccess = syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && localNamespace[cur[0]] instanceof Racket.Type; }, true);
        if (defSuccess) {
            var result = parseExpTree(syntaxStrTree[2],localNamespace);
            if (result) {
                return result;
            } else {
                outputlog("letrec body evaluation failed.");
                return null;
            } 
        } else {
            outputlog("letrec definitions evaluation failed.");
            return null;
        }
    }
    keywords["let"] = new Racket.SpecialForm();
    keywords["let"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (let ([id exp] [id exp] ...) body)
        
        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && Array.isArray(cur) && cur.length ===2 ; }, true)) {
            outputlog("let definitions not all id expression pairs");
            return null;
        }        
        
        var localNamespace = Namespace(namespace);
        
        // evaluate all, then bind all
        var defSuccess = true;
        var exprs = new Array(syntaxStrTree[1].length);
        for (var i=0; i< syntaxStrTree[1].length; ++i) {
            exprs[i]= parseExpTree(syntaxStrTree[1][i][1], localNamespace);
        }
        for (var i=0; i< syntaxStrTree[1].length; ++i) {
            if (!(localNamespace.hasOwnProperty(syntaxStrTree[1][i][0])) || localNamespace[syntaxStrTree[1][i][0]] === null) {
                localNamespace[syntaxStrTree[1][i][0]] = exprs[i];
                defSuccess = defSuccess && localNamespace[syntaxStrTree[1][i][0]] instanceof Racket.Type;
            } else {
                outputlog("Namespace already contains bound id: "+syntaxStrTree[1][i][0]+".");
                return false;
            }
        }
        if (defSuccess) {
            var result = parseExpTree(syntaxStrTree[2],localNamespace);
            if (result) {
                return result;
            } else {
                outputlog("let body evaluation failed.");
                return null;
            } 
        } else {
            outputlog("let definitions evaluation failed.");
            return null;
        }
    }
    keywords["let*"] = new Racket.SpecialForm();
    keywords["let*"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (let* ([id exp] [id exp] ...) body)
        
        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && Array.isArray(cur) && cur.length ===2 ; }, true)) {
            outputlog("let* definitions not all id expression pairs");
            return null;
        }        
        
        var localNamespace = Namespace(namespace);
        
        // evaluate and bind as soon as each is available
        var defSuccess = true;
        for (var i=0; i< syntaxStrTree[1].length; ++i) {
            localNamespace[syntaxStrTree[1][i][0]]= parseExpTree(syntaxStrTree[1][i][1], localNamespace);
            defSuccess = defSuccess && localNamespace[syntaxStrTree[1][i][0]] instanceof Racket.Type;
        }
        if (defSuccess) {
            var result = parseExpTree(syntaxStrTree[2],localNamespace);
            if (result) {
                return result;
            } else {
                outputlog("let* body evaluation failed.");
                return null;
            } 
        } else {
            outputlog("let* definitions evaluation failed.");
            return null;
        }
    }
    keywords["lambda"] = new Racket.SpecialForm();
    keywords["lambda"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "lambda"
        // in the form of :
        // (lambda (id ...) ... final-exp)
        
        var ids = syntaxStrTree[1];
        var body = syntaxStrTree.slice(2);
        
        return new Racket.Lambda(ids, body, namespace);
    }
    keywords["λ"] = keywords["lambda"];
    keywords["set!"] = new Racket.SpecialForm();
    keywords["set!"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "set!"
        // in the form of :
        // (set! id exp)
        
        var id = syntaxStrTree[1];
        var body = syntaxStrTree[2];
        if (namespace[id] != null) { //if namespace has id, whether it is through inheritance or not
            var setNamespace = namespace;
            //while loop should be guaranteed to terminate since id exists somewhere
            while(!setNamespace.hasOwnProperty(id)) //in upper levels, i.e. through inheritance
                setNamespace = setNamespace["#upperNamespace"]; //go through inheritance;

            //reached proper level since it exited loop, so namespace.hasOwnProperty(id) ===true
            if (setNamespace["#upperNamespace"] ===null) {//reached library, disallow
                outputlog("set! cannot mutate library id: "+id+".");
                return null;
            } else {
                setNamespace[id] = parseExpTree(body, namespace);
                return true; //no errors
            }
        } else { //should not have called set! at all
            outputlog("id "+id+" not found, cannot be set!");
            return null;
        }
    }
    keywords["cond"] = new Racket.SpecialForm();
    keywords["cond"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "cond"
        // in the form of :
        // (cond (bool exp) (bool exp) ... (else exp))
        
        if (Array.isArray(syntaxStrTree)) {
            for (var i=1; i< syntaxStrTree.length; ++i) {
                if (i === syntaxStrTree.length -1 || (syntaxStrTree[i][0] && syntaxStrTree[i][0] === "else")) {
                    return parseExpTree((syntaxStrTree[i].length ===1? syntaxStrTree[i]: syntaxStrTree[i][1]), namespace);
                }
                else {
                    var predicate = parseExpTree(syntaxStrTree[i][0], namespace);
                    if (predicate && predicate instanceof Racket.Bool && predicate.value) {
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
    keywords["if"] = new Racket.SpecialForm();
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
    namespace["number?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["number?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Num") {
            outputlog("number? requires 1 Num argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Num");
    }
    namespace["boolean?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["boolean?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Bool") {
            outputlog("boolean? requires 1 Bool argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Bool");
    }
    namespace["false?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["false?"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Bool" && !syntaxStrTreeArg[1].value);
    }
    namespace["string?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["string?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Str") {
            outputlog("string? requires 1 Str argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Str");
    }
    namespace["char?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["char?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Char") {
            outputlog("char? requires 1 Char argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Char");
    }
    namespace["equal?"] = new Racket.Lambda(["x","y",".","rst"], new Racket.Exp(), namespace);
    namespace["equal?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("equal? requires 2 arguments.");
            return null;
        }
        // I'll do this for now until I can figure out something better
        equal = equal && (syntaxStrTreeArg[1] === syntaxStrTreeArg[2] // Structure are not equal? unless they are the same object, and they don't have value
                            || ((syntaxStrTreeArg[1].type === syntaxStrTreeArg[2].type) 
                                && ((syntaxStrTreeArg[1] instanceof Racket.List) && (syntaxStrTreeArg[1].toString() === syntaxStrTreeArg[2].toString()))
                                    || (!(syntaxStrTreeArg[1].value == null)
                                        && !(syntaxStrTreeArg[2].value == null)
                                        && (syntaxStrTreeArg[1].value === syntaxStrTreeArg[2].value))));
        return new Racket.Bool(equal);
    }
    namespace["expt"] = new Racket.Lambda(["x","y"], new Racket.Exp(), namespace);
    namespace["expt"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.pow(syntaxStrTreeArg[1], syntaxStrTreeArg[2]));
    }
    namespace["exp"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["exp"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.pow(Math.E, syntaxStrTreeArg[1].value));
    }
    namespace["log"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["log"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.log(syntaxStrTreeArg[1].value));
    }
    namespace["sin"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["sin"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.sin(syntaxStrTreeArg[1].value));
    }
    namespace["cos"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["cos"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.cos(syntaxStrTreeArg[1].value));
    }
    namespace["tan"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["tan"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.tan(syntaxStrTreeArg[1].value));
    }
    namespace["asin"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["asin"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.asin(syntaxStrTreeArg[1].value));
    }
    namespace["acos"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["acos"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.acos(syntaxStrTreeArg[1].value));
    }
    namespace["atan"] = new Racket.Lambda(["x","y"], new Racket.Exp(), namespace); // 1 or 2 arguments
    namespace["atan"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length ===2)
            return new Racket.Num(Math.atan(syntaxStrTreeArg[1].value));
        else // if(syntaxStrTreeArg.length ===3)
            return new Racket.Num(Math.atan2(syntaxStrTreeArg[1].value,syntaxStrTreeArg[2].value));
    }
    namespace["+"] = new Racket.Lambda([".","x"], new Racket.Exp(), namespace);
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
        return new Racket.Num(count);
    }
    namespace["-"] = new Racket.Lambda(["x",".","y"], new Racket.Exp(), namespace);
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
            
            return new Racket.Num(count);
        } else {
            outputlog("Not all arguments were Num Type");
            return null;
        }
    }
    namespace["*"] = new Racket.Lambda([".","x"], new Racket.Exp(), namespace);
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
        return new Racket.Num(count);
    }
    namespace["/"] = new Racket.Lambda(["x",".","y"], new Racket.Exp(), namespace);
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
                return new Racket.Num(count);
            /*else {
                console.log("Division error.");
                return null;
            }*/
        } else {
            outputlog("Not all arguments were Num Type");
            return null;
        }
    }
    namespace["="] = new Racket.Lambda(["x","y",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace["<"] = new Racket.Lambda(["x","y",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace["<="] = new Racket.Lambda(["x","y",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace[">"] = new Racket.Lambda(["x","y",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace[">="] = new Racket.Lambda(["x","y",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace["quotient"] = new Racket.Lambda(["num1","num2"], new Racket.Exp(), namespace);
    namespace["quotient"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("quotient requires exactly 2 arguments.");
            return null;
        }
        var result = syntaxStrTreeArg[1].value/syntaxStrTreeArg[2].value;
        return new Racket.Num(result>0? Math.floor(result): Math.ceil(result));
    }
    namespace["remainder"] = new Racket.Lambda(["num","mod"], new Racket.Exp(), namespace);
    namespace["remainder"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("remainder requires exactly 2 arguments.");
            return null;
        }
        return new Racket.Num(syntaxStrTreeArg[1].value % syntaxStrTreeArg[2].value);
    }
    namespace["modulo"] = new Racket.Lambda(["num","mod"], new Racket.Exp(), namespace);
    namespace["modulo"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("modulo requires exactly 2 arguments.");
            return null;
        }
        var remainder = syntaxStrTreeArg[1].value % syntaxStrTreeArg[2].value;
        if (syntaxStrTreeArg[1].value * syntaxStrTreeArg[2].value < 0) // if signs are opposite
            while(remainder* syntaxStrTreeArg[2].value < 0)
                remainder += syntaxStrTreeArg[2].value;
        return new Racket.Num(remainder);
    }
    namespace["abs"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["abs"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("abs requires exactly 1 argument.");
            return null;
        }
        return new Racket.Num(Math.abs(syntaxStrTreeArg[1].value));
    }
    namespace["floor"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["floor"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("floor requires exactly 1 argument.");
            return null;
        }
        return new Racket.Num(Math.floor(syntaxStrTreeArg[1].value));
    }
    namespace["ceiling"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["ceiling"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("ceiling requires exactly 1 argument.");
            return null;
        }
        return new Racket.Num(Math.ceil(syntaxStrTreeArg[1].value));
    }
    namespace["string=?"] = new Racket.Lambda(["str1","str2",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace["substring"] = new Racket.Lambda(["str","start",".","end"], new Racket.Exp(), namespace);
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
        return new Racket.Str(str.substring(start,end));
    }
    namespace["string-ref"] = new Racket.Lambda(["str","index"], new Racket.Exp(), namespace);
    namespace["string-ref"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length != 3 && syntaxStrTreeArg[1].type !== "Str" && syntaxStrTreeArg[2].type !== "Num") {
            outputlog("string-ref requires a Str and Num argument.");
            return null;
        }
        var chr = syntaxStrTreeArg[1].value.charAt(syntaxStrTreeArg[2].value);
        return new Racket.Char(chr);
    }
    namespace["string-length"] = new Racket.Lambda(["str"], new Racket.Exp(), namespace);
    namespace["string-length"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length <= 2 && syntaxStrTreeArg[1].type !== "Str") {
            outputlog("string-length requires at least 2 arguments.");
            return null;
        }
        return new Racket.Num(syntaxStrTreeArg[1].value.length);
    }
    namespace["string-append"] = new Racket.Lambda([".","rststr"], new Racket.Exp(), namespace);
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
        return new Racket.Str(str);
    }
    namespace["string"] = new Racket.Lambda([".","rstchar"], new Racket.Exp(), namespace);
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
        return new Racket.Str(str);
    }
    namespace["string->list"] = new Racket.Lambda(["str"], new Racket.Exp(), namespace);
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
                chrlist[i+1] = new Racket.Char(make);
                shift++;
                i++;
            } else {
                chrlist[i+1] = new Racket.Char(syntaxStrTreeArg[1].value.substring(i+shift,i+shift+1));
            }
        }
        return parseExpTree(chrlist.slice(0,chrlist.length-shift),namespace);
    }
    namespace["char=?"] = new Racket.Lambda(["chr1","chr2",".","rst"], new Racket.Exp(), namespace);
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
        return new Racket.Bool(equal);
    }
    namespace["not"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["not"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length == 2 && syntaxStrTreeArg[1].type === "Bool") {
            return new Racket.Bool(!syntaxStrTreeArg[1].value);
        } else {
            outputlog("not did not receive 1 Bool.");
            return null;
        }
    }
    namespace["cons"] = new Racket.Lambda(["x","y"], new Racket.Exp(), namespace);
    namespace["cons"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 3) {
            return new Racket.Cell(syntaxStrTreeArg[1], syntaxStrTreeArg[2]);  
        } else {
            outputlog("cons was not called with 2 parameters.");
            return null;
        }         
    }
    namespace["first"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["first"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.Cell) {
            return syntaxStrTreeArg[1].left;
        } else {
            outputlog("first was not called with 1 cons cell.");
            return null;
        }         
    }
    namespace["rest"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["rest"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.Cell) {
            return syntaxStrTreeArg[1].right;
        } else {
            outputlog("rest was not called with 1 cons cell.");
            return null;
        }         
    }
    namespace["empty?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["empty?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.List) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Empty");
        } else {
            outputlog("empty? was not called with 1 list.");
            return null;
        }         
    }
    namespace["cons?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["cons?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.List) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Cell");
        } else {
            outputlog("cons? was not called with 1 list.");
            return null;
        }         
    }
    namespace["list?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["list?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.Type) {
            if (syntaxStrTreeArg[1].type === "Empty") 
                return new Racket.Bool(true);
            else if (!(syntaxStrTreeArg[1] instanceof Racket.Cell))
                return new Racket.Bool(false);
            else 
                return this.eval(["list?", syntaxStrTreeArg[1].right], namespace);
        } else {
            outputlog("list? was not called with an expression.");
            return null;
        }         
    }
    namespace["list"] = new Racket.Lambda([".","lst"], new Racket.Exp(), namespace);
    namespace["list"].eval = function(syntaxStrTreeArg, namespace) {
        var cons = new Racket.Empty();
        for (var i=syntaxStrTreeArg.length-1; i >= 1; --i) {
            var cell = new Racket.Cell();
            cell.right = cons;
            cell.left = syntaxStrTreeArg[i];
            cons = cell;
        }
        return cons;
    }
    namespace["identity"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["identity"].eval = function(syntaxStrTreeArg, namespace) {
        return syntaxStrTreeArg[1];
    }
    namespace["apply"] = new Racket.Lambda(["fn","list-arg"], new Racket.Exp(), namespace);
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
populateStandardFunctions(libraryNamespace);
    
    





// ---------- INIT ----------

var libraryFilesCount = 2;
var libraryFilesLoaded = 0;
var readyForUser = false;
var libraryLoadMode = true;
prep();

function prep() {
    textfield = document.getElementById("code-field");
    outputfield = document.getElementById("code-output");
    submitbutton = document.getElementById("submit-button");
    checkbox = document.getElementById("auto-clear-checkbox");
    clearbutton = document.getElementById("clear-button");
    submitbutton.onclick=evaluate;
    textfield.onkeyup = automaticIndent;
    clearbutton.onclick = function () { outputfield.value = ""; };
    outputlog("Please wait until ("+libraryFilesCount+") libraries are loaded.");
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
                textfield.value = textfield.value.substring(0,caretSpot) + trim(textfield.value.substring(caretSpot));
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
        var httpReq = new XMLHttpRequest();
        httpReq.open("get", filePath, true);
        httpReq.onreadystatechange = function() {
            if (httpReq.readyState===4) {
                var response = httpReq.responseText;
                libraryLoadMode = true;
                importCode(response);
                libraryFilesLoaded++;
                var filename = filePath.split(/\//g)
                outputlog(filename[filename.length-1]+" library loaded!");
                if (libraryFilesLoaded === libraryFilesCount){
                    libraryLoadMode = false;
                    readyForUser = true;
                    outputlog("All libraries loaded!");
                }
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
    var temp3 = temp2.split(/[\s\n]+|\;.*/g); 
    return temp3.filter( function(str){return str!="";} );
};

function importCode(str){
    var temp = textfield.value;
    textfield.value = str;
    evaluate();
    textfield.value = temp;
};

function evaluate() {
    if (readyForUser || libraryLoadMode) {
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
        
        if (checkbox.checked && readyForUser)
            outputfield.value = "";
        
        var namespace;
        if (libraryLoadMode) {
            namespace = libraryNamespace;
        } else {
            globalNamespace = Namespace(libraryNamespace);
            namespace = globalNamespace;
        }
        
        stepExp = syntaxStrTreeBlocks; 
        while (stepExp.length > 0) {
            stepExp = parseStepExpBlocks(stepExp, namespace);
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



function parseStepExpBlocks (syntaxStrBlocks, namespace) {
    if (syntaxStrBlocks.length > 0) {
        var exp = parseExpTree(syntaxStrBlocks[0], namespace);
        
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
    if (expression instanceof Racket.Type)
        return expression;
    else if (expression[0]==="\"" && expression[expression.length-1]==="\"")
        return new Racket.Str(expression.substring(1,expression.length-1));
    else if (expression[0]==="\'" && expression.length>1)
        return new Racket.Sym(expression.substring(1));
    else if (expression.substring(0,2)==="\#\\" && expression.length>2)
        return new Racket.Char(expression.substring(2));
    else if (expression[0]==="\#" && expression.length==2)
        return new Racket.Bool(expression==="\#t");
    else if (!isNaN(Number(expression)))
        return new Racket.Num(Number(expression));
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
            } else if (lookupExp.type !== "Lambda") { // better be a function
                outputlog(syntaxStrTree[0]+" is not a function.");
                return null;
            }
            
            // evaluate the function call arguments first
            var evaluatedSyntaxStrTree = new Array(syntaxStrTree.length);
            evaluatedSyntaxStrTree[0] = syntaxStrTree[0];
            var argEvalSuccess = true;
            for (var i = 1; i< syntaxStrTree.length; ++i) {
                evaluatedSyntaxStrTree[i] = parseExpTree(syntaxStrTree[i],namespace);
                argEvalSuccess = argEvalSuccess && (evaluatedSyntaxStrTree[i] instanceof Racket.Type);
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

