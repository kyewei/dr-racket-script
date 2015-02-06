var textfield;
var submitbutton;
var outputfield;
var clearbutton;
var fileupload;
var filesubmit;
var deletemenu;
var deletebutton;

// ---------- SCHEME TYPE DECLARATIONS AND SETUP ----------


// This solves all my problems with JS's prototypical inheritance :D
function Namespace(inheritedNamespace, isTopLevel) {
    function Namespace() {};
    Namespace.prototype = inheritedNamespace;
    var newNamespace = new Namespace();

    //should be obfuscated enough, since ids cannot have #'s anyways.
    //__proto__ is not implemented in every browser, so this will do for now
    newNamespace["#upperNamespace"] = inheritedNamespace;
    newNamespace["#isTopLevel"] = isTopLevel === true;
    // newNamespace["#moduleNamespaces"] is not defined here since it will overwrite, and I do not want overwrite
    // Rather, I want the prototypical nature of namespaces to provide lookup to parent namespace's ["#moduleNamespaces"]

    /*if (inheritedNamespace === libraryNamespace) {
        newNamespace["#moduleNamespaces"] = {};
        newNamespace["#moduleNamespaces"]["#moduleProvide"] = {};
    }*/

    // make the container #moduleProvide inside #moduleNamespaces
    newNamespace["#thisModuleProvide"] = {}; //list of module provided id's
    return newNamespace;
};
var libraryNamespace = Namespace(null);
libraryNamespace["#moduleNamespaces"] = {};
libraryNamespace["#moduleNamespaces"]["#moduleProvide"] = {};
var globalNamespace = Namespace(libraryNamespace,true);
globalNamespace["#moduleNamespaces"] = {}; // Make containers only in globalNamespace
globalNamespace["#moduleNamespaces"]["#moduleProvide"] = {};

var uploadedModulesRawText = {};
var uploadedModulesParsed = {};

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
    this.length = function() { return 0; };
};
Racket.Cell = function (left, right) {
    this.type="Cell";
    this.left = left;
    this.right = right;
    this.toString = function () {
        var returnStr = "\(list ";

        var currentCell = this;

        do {
            returnStr+=currentCell.left.toString();

            if (currentCell.right.type === "Cell"){
                returnStr+=" ";
                currentCell = currentCell.right;
                continue;
            } else if (currentCell.right.type === "Empty"){
                break;
            } else {
                returnStr+=" . " + currentCell.right.toString();
                break;
            }
        } while(true); // It will break if it reaches empty (base case) or non-cell

        return returnStr+")";
    };
    this.length = function() {
        var currentCell = this;
        var count = 0;
        while (currentCell.type === "Cell"){
            count++;
            currentCell = currentCell.right;
        }
        if (currentCell.type === "Empty"){ //proper list ending in Racket.Empty;
            return count;
        } else { // improper list huh.
            return null;
        }
    };
};
Racket.Struct = function () {
};
Racket.Function = function () { // Covers Lambda and Case-Lambda
    this.type="Lambda";
    this.toString = function() { return "\#\<procedure\>"; };
};
Racket.Lambda = function (ids, body, namespace) {
    // ids is an Array of Strings that is declared in the sub-namespace
    // body is the Exp that will involve members of ids

    this.name = "lambda";

    if (ids ==null || body ==null || namespace ==null)
        return null;

    if (Array.isArray(ids)) {
        this.minParamCount = ids.length;
        this.hasRestArgument = false;
        var restDot = ids.indexOf(".");
        if (restDot!== -1 && restDot + 2 === ids.length) {
            this.hasRestArgument = true;
            this.minParamCount = restDot;
            this.restArg = ids[this.minParamCount+1];
        }
        this.ids=ids;
    } else { //only rest argument
        this.minParamCount = 0;
        this.hasRestArgument = true;
        this.ids = [];
        this.restArg = ids;
    }

    if (body.length> 1) {
        var tailBody = body[body.length-1];
        // since Lambda can accept multiple bodies, it is essentially a local/letrec type binding
        //CORRECTION: it is an implicit begin keyword wrapping the body
        //this.body = ["local",body.slice(0,body.length-1),tailBody];
        this.body = ["begin"].concat(body);
    }
    else
        this.body = body[0];
    this.inheritedNamespace = namespace;
    this.eval = function (syntaxStrTreeArg, namespace) {
        var lambdaNamespace = Namespace(this.inheritedNamespace);
        var paramCount = syntaxStrTreeArg.length -1;
        if (paramCount == this.minParamCount
        || (paramCount >= this.minParamCount && this.hasRestArgument)) {
            for (var i=0; i< this.minParamCount; ++i) {
                lambdaNamespace[this.ids[i]]=syntaxStrTreeArg[i+1];
            }
            if (this.hasRestArgument) {
                var listMake = ["list"].concat(syntaxStrTreeArg.slice(this.minParamCount+1));
                lambdaNamespace[this.restArg] = new Racket.FunctionCall(listMake,lambdaNamespace).eval();
            }
            return new Racket.FunctionCall(this.body, lambdaNamespace);

        } else {
            outputlog("Function parameter count mismatch.");
            return null;
        }
    };
};
Racket.CaseLambda = function (body, namespace) {
    // body is an [[ids body], ...] where each element is a valid new Lambda(ids, body, namespace)

    this.name = "case-lambda";

    this.inheritedNamespace = namespace;
    this.caseBody = body;
    this.eval = function (syntaxStrTreeArg, namespace) {
        var paramCount = syntaxStrTreeArg.length -1;
        for (var i=0; i< this.caseBody.length; ++i) {
            var minParamCount;
            var hasRestArgument;
            var restArg;
            if (Array.isArray(this.caseBody[i][0])) { //list of ids
                var restDot = this.caseBody[i][0].indexOf(".");
                if (restDot!== -1 && restDot + 2 === this.caseBody[i][0].length) {
                    hasRestArgument = true;
                    minParamCount = restDot;
                    restArg = this.caseBody[i][0][minParamCount+1];
                } else {
                    minParamCount = this.caseBody[i][0].length;
                    hasRestArgument = false;
                }
            } else { // default to one rest-id
                minParamCount = 0;
                restArg = this.caseBody[i][0]
                hasRestArgument = true;
            }
            if (paramCount == minParamCount
            || (paramCount >= minParamCount && hasRestArgument)) { //if arguments allowed fits number of arguments given
                return (new Racket.Lambda(this.caseBody[i][0], this.caseBody[i].slice(1), this.inheritedNamespace)).eval(syntaxStrTreeArg, namespace);
            } else {}; //skip to next case
        }

        // Should not have gotten here if it was a well evaluated function
        outputlog("Function parameter count mismatch.");
        return null;
    };
};
Racket.Vector = function(valueArray, length) {
    //assert valueArray.length === length

    this.type="Vector";
    this.arr = valueArray;
    this.length = length;
    this.toString = function(){
        var str = "\(vector";
        for (var i=0; i< this.length; ++i){
            str += " "+this.arr[i].toString();
        }
        str+=")";
        return str;
    };
    this.ith = function(i){
        if (0 <= i && i<this.length)
            return this.arr[i];
        else
            return null;
    };
};
Racket.Void = function() {
    this.type="Void";
    this.toString = function() {
        return "\#\<void\>";
    }
};
Racket.FunctionCall = function(exp, namespace) { // This is a wrapper for FunctionCall as a Type.
    this.type="FunctionCall";
    this.exp = exp;
    this.namespace = namespace;
    this.eval = function(){
        return parseExpTree(exp, namespace);
    };
};

Racket.SpecialForm.prototype = new Racket.Exp();
Racket.Type.prototype = new Racket.Exp();
Racket.Num.prototype = new Racket.Type();
Racket.Str.prototype = new Racket.Type();
Racket.Bool.prototype = new Racket.Type();
Racket.Sym.prototype = new Racket.Type();
Racket.Char.prototype = new Racket.Type();
Racket.Function.prototype = new Racket.Type();
Racket.Lambda.prototype = new Racket.Function();
Racket.CaseLambda.prototype = new Racket.Function();
Racket.List.prototype = new Racket.Type();
Racket.Empty.prototype = new Racket.List();
Racket.Cell.prototype = new Racket.List();
Racket.Struct.prototype = new Racket.Type();
Racket.Vector.prototype = new Racket.Type();
Racket.Void.prototype = new Racket.Type();

Racket.FunctionCall.prototype = new Racket.Exp();

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

        for (var i=1; i< syntaxStrTree.length; ++i) {
            var exp = new Racket.FunctionCall(syntaxStrTree[i],namespace).eval();
            if (exp && exp.type === "Bool" && !(exp.value)){ // not null and false boolean
                return new Racket.Bool(false);
            }
            if (i === syntaxStrTree.length-1) //return last exp if everything is truthy
                return exp;
        }
        return new Racket.Bool(false); // empty and is false;
    };
    keywords["or"] = new Racket.SpecialForm();
    keywords["or"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "or"
        // in the form of :
        // (or exp exp ... exp)

        for (var i=1; i< syntaxStrTree.length; ++i) {
            var exp = new Racket.FunctionCall(syntaxStrTree[i],namespace).eval();
            if (exp && exp.type === "Bool" && !(exp.value)){ // not null and false boolean
                continue;
            }
            else {
                return exp;
            }
        }
        return new Racket.Bool(false);
    };
    keywords["define"] = new Racket.SpecialForm();
    keywords["define"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "define"
        // in the form of :
        // (define id exp) for objects
        // (define (function-name id ...) ... final-exp) for functions
        // (define (((function-name a) b ) c) ... final exp) for curried functions

        var result;
        var id;
        var body;

        if (Array.isArray(syntaxStrTree[1])) { //function define
            // define has currying constructs in-place
            // We need to handle that

            // Streamlined currying support into main branch

            var argsArr = syntaxStrTree[1];

            var innerBody = syntaxStrTree.slice(2);

            while (Array.isArray(argsArr[0])) { // Currying, since nested brackets (arrays)
                var innerIds = argsArr.slice(1);
                innerBody = [["lambda", innerIds].concat(innerBody)];
                console.log(innerBody);
                argsArr = argsArr[0];
            }

            // No more nested brackets, so it has found deepest level
            id = argsArr[0];
            var lambdaIds = argsArr.slice(1);

            body = innerBody;
            result = new Racket.Lambda(lambdaIds, body, namespace);
        } else { // object define
            id = syntaxStrTree[1];
            if (syntaxStrTree.length === 3)
                body = syntaxStrTree[2];
            else {
                outputlog("define received multiple expressions after identifier.");
                return null;
            }
            result = new Racket.FunctionCall(body,namespace).eval();
        }

        if (result) {
            if (namespace["#upperNamespace"] === libraryNamespace && namespace["#moduleNamespaces"]["#moduleProvide"].hasOwnProperty(id)) {
                outputlog("Imported modules contain id: "+id+".");
                return false;
            } else if ((!(namespace.hasOwnProperty(id))) || namespace[id] === null) {
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
            this.definestruct = true;
            this.dict = {};
            // assert data.length === propertyCount;
            for (var i=0; i<this.propertyCount; ++i) {
                this.dict[propertyNames[i]] = new Racket.FunctionCall(data[i],namespace).eval();
            }

            this.toString = function () {
                var str = (this.definestruct?"\(make-":"\(")+this.type;
                for (var i=0; i<propertyCount; ++i) {
                    str +=" ";
                    str += this[propertyNames[i]].toString();
                }
                str +="\)";
                return str;
            };
        };
        Racket[typename].prototype = new Racket.Type();

        function checkNamespace(id,namespace){ // Made a general function instead to process namespace id-already-defined checks
            //has to allow null though since some things may make id before binding
            return (namespace.hasOwnProperty(id) && namespace[id] !== null)
                || (namespace["#moduleNamespaces"]["#moduleProvide"].hasOwnProperty(id) && namespace["#moduleNamespaces"]["#moduleProvide"][id] !== null);
        }

        // Make type-checker method
        // i.e. if type is posn, this is (posn? posn-arg)
        if (checkNamespace(typename+"?",namespace)){
            outputlog(typename+"?"+" already defined.");
            return null;
        }
        namespace[typename+"?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
        namespace[typename+"?"].eval = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length !=2) {
                outputlog(typename+"?"+" requires exactly 1 argument.");
                return null;
            }
            return new Racket.Bool(syntaxStrTreeArg[1].type === typename);
        };
        // Make constructor method
        // i.e. if type is posn, this is (make-posn arg1 arg2)
        if (checkNamespace("make-"+typename,namespace)){
            outputlog("make-"+typename+" already defined.");
            return null;
        }
        namespace["make-"+typename] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace); //has propertyCount many arguments
        namespace["make-"+typename].eval = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length != propertyCount+1) {
                outputlog("make-"+typename+" requires "+propertyCount+" argument(s).");
                return null;
            }
            return new Racket[typename](syntaxStrTreeArg.slice(1));
        };
        //Clone without make prefix
        if (checkNamespace(typename,namespace)){
            outputlog(typename+" already defined.");
            return null;
        }
        namespace[typename] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace); //has propertyCount many arguments
        namespace[typename].eval = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length != propertyCount+1) {
                outputlog(typename+" requires "+propertyCount+" argument(s).");
                return null;
            }
            var obj = new Racket[typename](syntaxStrTreeArg.slice(1));
            obj.definestruct = false; // so it prints (posn arg1 arg2) instead; implementation-wise, it is the same
            return obj;
        };
        // Make accessor methods
        // i.e. if type is posn, this makes (posn-x posn-arg), and (posn-y posn-arg)
        for (var i=0; i< propertyCount; ++i) {
            var id = propertyNames[i];
            if (checkNamespace(typename+"-"+id,namespace)){
                outputlog(typename+"-"+id+" already defined.");
                return null;
            }
            namespace[typename+"-"+id] = new Racket.Lambda(["obj"], new Racket.Exp(), namespace);
            namespace[typename+"-"+id].id = propertyNames[i]; // needed to do this because this makes a deep copy
            namespace[typename+"-"+id].eval = function(syntaxStrTreeArg, namespace) {
                if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !==syntaxStrTree[1]) {
                    outputlog(typename+"-"+this.id+" requires 1 "+typename+" argument.");
                    return null;
                }
                var obj = syntaxStrTreeArg[1];
                return obj.dict[this.id];
            }
        }
        return true; // for no errors
    };
    keywords["struct"] = new Racket.SpecialForm();
    keywords["struct"].eval = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "struct"
        // in the form of :
        // (struct type-id (property1 property2 ...))

        //This is an alternate to define-struct
        return keywords["define-struct"].eval(syntaxStrTree, namespace);
    }
    keywords["local"] = new Racket.SpecialForm();
    keywords["local"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (local [(define ...) ...)] ... body)

        var localNamespace = Namespace(namespace);
        // make id's first
        syntaxStrTree[1].map(function(cur,i,arr) { if (cur[0].substring(0,6)==="define") {localNamespace[(Array.isArray(cur[1])?cur[1][0]:cur[1])]=null;} });
        // THEN bind
        var defEval = syntaxStrTree[1].map(function(cur,i,arr) { return new Racket.FunctionCall(cur,localNamespace).eval(); });
        var defSuccess = defEval.reduce(function(prev,cur,i,arr) { return prev && cur; }, true);
        if (defSuccess) {
            var exp = syntaxStrTree.length>3?["begin"].concat(syntaxStrTree.slice(2)):syntaxStrTree[2];
            return new Racket.FunctionCall(exp,localNamespace);

        } else {
            outputlog("local definitions evaluation failed.");
            return null;
        }
    }
    keywords["letrec"] = new Racket.SpecialForm();
    keywords["letrec"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (letrec ([id exp] [id exp] ...) ... body)

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
            var exp = syntaxStrTree.length>3?["begin"].concat(syntaxStrTree.slice(2)):syntaxStrTree[2];
            return new Racket.FunctionCall(exp,localNamespace);

        } else {
            outputlog("letrec definitions evaluation failed.");
            return null;
        }
    }
    keywords["let"] = new Racket.SpecialForm();
    keywords["let"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (let ([id exp] [id exp] ...) ... body)

        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && Array.isArray(cur) && cur.length ===2 ; }, true)) {
            outputlog("let definitions not all id expression pairs");
            return null;
        }

        var localNamespace = Namespace(namespace);

        // evaluate all, then bind all
        var defSuccess = true;
        var exprs = new Array(syntaxStrTree[1].length);
        for (var i=0; i< syntaxStrTree[1].length; ++i) {
            exprs[i]= new Racket.FunctionCall(syntaxStrTree[1][i][1], localNamespace).eval();
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
            var exp = syntaxStrTree.length>3?["begin"].concat(syntaxStrTree.slice(2)):syntaxStrTree[2];
            return new Racket.FunctionCall(exp,localNamespace);

        } else {
            outputlog("let definitions evaluation failed.");
            return null;
        }
    }
    keywords["let*"] = new Racket.SpecialForm();
    keywords["let*"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (let* ([id exp] [id exp] ...) ... body)

        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && Array.isArray(cur) && cur.length ===2 ; }, true)) {
            outputlog("let* definitions not all id expression pairs");
            return null;
        }

        var localNamespace = Namespace(namespace);

        // evaluate and bind as soon as each is available
        var defSuccess = true;
        for (var i=0; i< syntaxStrTree[1].length; ++i) {
            localNamespace[syntaxStrTree[1][i][0]]= new Racket.FunctionCall(syntaxStrTree[1][i][1], localNamespace).eval();
            defSuccess = defSuccess && localNamespace[syntaxStrTree[1][i][0]] instanceof Racket.Type;
        }
        if (defSuccess) {
            var exp = syntaxStrTree.length>3?["begin"].concat(syntaxStrTree.slice(2)):syntaxStrTree[2];
            return new Racket.FunctionCall(exp,localNamespace);

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
    keywords["case-lambda"] = new Racket.SpecialForm();
    keywords["case-lambda"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "case-lambda"
        // in the form of :
        // (case-lambda [(id ...) ... final-exp)] ...)

        var caseBody = syntaxStrTree.slice(1);

        return new Racket.CaseLambda(caseBody, namespace);
    }
    keywords["set!"] = new Racket.SpecialForm();
    keywords["set!"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "set!"
        // in the form of :
        // (set! id exp)

        var id = syntaxStrTree[1];
        var body = syntaxStrTree[2];
        if (new Racket.FunctionCall(id,namespace).eval()) { //if namespace has id, whether it is through inheritance, modules or not
            var setNamespace = namespace;
            //while loop should be guaranteed to terminate since id exists somewhere
            while((!setNamespace.hasOwnProperty(id))){ //in upper levels, i.e. through inheritance
                if (!(setNamespace["#moduleNamespaces"]["#moduleProvide"].hasOwnProperty(id))){
                    setNamespace = setNamespace["#upperNamespace"]; //go through inheritance;
                } else { //found id in imported modules, do not edit
                    outputlog("Found id: "+ id+ " in imported modules, cannot mutate.");
                    return null;
                }
            }
            //reached proper level since it exited loop, so namespace.hasOwnProperty(id) ===true
            if (setNamespace["#upperNamespace"] ===null) {//reached library, disallow
                outputlog("set! cannot mutate library id: "+id+".");
                return null;
            } else {
                setNamespace[id] = new Racket.FunctionCall(body, namespace).eval();
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
                if (i === syntaxStrTree.length -1
                    && ((syntaxStrTree[i].length>=2 && syntaxStrTree[i][0] === "else")
                        || (syntaxStrTree[i].length===1))) { //handles when to add an implcit begin, but only when necessary
                    if (syntaxStrTree[i][0] === "else") {
                        if (syntaxStrTree[i].length ===2) {
                            return new Racket.FunctionCall(syntaxStrTree[i][1], namespace);
                        } else
                            return new Racket.FunctionCall(["begin"].concat(syntaxStrTree[i].slice(1)), Namespace(namespace,true)); //gotta make it a new namespace
                    } else {
                        if (syntaxStrTree[i].length ===1) {
                            return new Racket.FunctionCall(syntaxStrTree[i][0], namespace);
                        } else
                            return new Racket.FunctionCall(["begin"].concat(syntaxStrTree[i]), Namespace(namespace,true)); //gotta make it a new namespace
                    }
                } else {
                    if (syntaxStrTree[i].length >= 2){
                        var predicate = new Racket.FunctionCall(syntaxStrTree[i][0], namespace).eval();
                        if (predicate && !(predicate.type === "Bool" && !predicate.value)) { //if not null and not false Racket.Bool
                            if (syntaxStrTree[i].length>2)
                                return new Racket.FunctionCall(["begin"].concat(syntaxStrTree[i].slice(1)), Namespace(namespace,true)); //gotta make it a new namespace
                            else
                                return new Racket.FunctionCall(syntaxStrTree[i][1], namespace);
                        } //else {} //do nothing, go to next predicate
                    }
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
            var predicate = new Racket.FunctionCall(syntaxStrTree[1], namespace).eval();
            if (predicate) { // if not null
                if (!(predicate.type==="Bool" && !predicate.value)) { //if not false Racket.Bool
                    return new Racket.FunctionCall(syntaxStrTree[2], namespace);
                } else {
                    return new Racket.FunctionCall(syntaxStrTree[3], namespace);
                }
            } else {
                outputlog("if predicate evaluation gave error.")
                return null;
            }
        } else {
            outputlog("if is invalid or does not have 3 arguments.");
            return null;
        }
    }
    keywords["begin"] = new Racket.SpecialForm();
    keywords["begin"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "begin"
        // in the form of :
        // (begin exp ... final-exp)

        var beginNamespace = (namespace["#isTopLevel"]?namespace:Namespace(namespace, true));
        for (var i=1; i<syntaxStrTree.length; ++i) {
            if (i !== syntaxStrTree.length-1) {
                var exp = new Racket.FunctionCall(syntaxStrTree[i], beginNamespace).eval();

                // Expression is simplest form outputs are spliced to surrounding context
                //   meaning result is made output
                if (namespace["#isTopLevel"] && exp && exp !== true) {
                    outputlog(""+exp); //Print output to console
                }
            }
            else
                return new Racket.FunctionCall(syntaxStrTree[i], beginNamespace);
        }
    }
    keywords["require"] = new Racket.SpecialForm();
    keywords["require"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "require"
        // in the form of :
        // (require string ...)

        // This evaluates the listed modules (which should be imported)
        for (var i=1; i< syntaxStrTree.length; ++i){
            //parse into Racket.String, this guarantees that the var is a string
            var fileNameStr = new Racket.FunctionCall(syntaxStrTree[i], namespace).eval();
            var fileName = fileNameStr.value; //get String's value, which is actual fileName

            if (uploadedModulesParsed[fileName]){ //if above worked, this is not null

                //Make a separate namespace for each module, evaluate, and put this inside the
                //  give namespace under #moduleNamespaces
                var moduleNamespace = Namespace(libraryNamespace, true);

                // Make these containers every time new globalNamespace is made.
                // This is a module globalNamespace
                moduleNamespace["#moduleNamespaces"] = {};
                moduleNamespace["#moduleNamespaces"]["#moduleProvide"] = {};

                var stepExp = uploadedModulesParsed[fileName];
                while (stepExp.length > 0) {
                    stepExp = parseStepExpBlocks(stepExp, moduleNamespace);
                }

                //check provide to make sure all provided id's are actually defined
                var provideAll = true;
                for (var id in moduleNamespace["#thisModuleProvide"]) {
                    //since provides could be from current module or a required module, this checks down the dependency
                    provideAll = provideAll && new Racket.FunctionCall(id,moduleNamespace).eval();
                    if (!provideAll){
                        outputlog("Not all listed provided id's are provided.")
                        moduleNamespace = null;
                        break;
                    }
                }

                if (i === 1){ //first module to be imported

                    for (id in moduleNamespace["#thisModuleProvide"]){
                        namespace["#moduleNamespaces"]["#moduleProvide"][id] = {};
                        namespace["#moduleNamespaces"]["#moduleProvide"][id].has = true;
                        namespace["#moduleNamespaces"]["#moduleProvide"][id].sourceModule = fileName;
                    }
                } else { // not first, got to check if id is already in another imported module
                    var noDuplicateProvides = true;
                    for (id in moduleNamespace["#thisModuleProvide"]){
                        if (namespace["#moduleNamespaces"]["#moduleProvide"].hasOwnProperty(id)){
                            noDuplicateProvides = false;
                            break;
                        }
                    }
                    if (noDuplicateProvides){
                        for (id in moduleNamespace["#thisModuleProvide"]){
                            namespace["#moduleNamespaces"]["#moduleProvide"][id] = {};
                            namespace["#moduleNamespaces"]["#moduleProvide"][id].has = true;
                            namespace["#moduleNamespaces"]["#moduleProvide"][id].sourceModule = fileName;
                        }
                    } else {
                        outputlog("Imported modules with same provided id's.")
                    }
                }
                namespace["#moduleNamespaces"][fileName] = moduleNamespace;
            } else {
                if (fileName){
                    outputlog("Module "+ fileName +" not found.");
                    return null;
                } else {
                    outputlog("require received argument(s) that were not all type String.")
                    return null;
                }
            }
        }
        return true;
    }
    keywords["provide"] = new Racket.SpecialForm();
    keywords["provide"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "provide"
        // in the form of :
        // (provide id ...)

        for (var i=1; i< syntaxStrTree.length; ++i){
            if (typeof syntaxStrTree[i] == 'string' || syntaxStrTree[i] instanceof String){ //is id then
                namespace["#thisModuleProvide"][syntaxStrTree[i]] = true;
            } else {
                outputlog("provide received argument(s) that were not id's.")
                return null;
            }
        }
        return true; //so it was successful
    }
    return keywords;
};

var specialForms = populateSpecialForms();

function populateStandardFunctions(namespace) {
    namespace["void"] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace);
    namespace["void"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Void();
    }
    namespace["void?"] = new Racket.Lambda(["v"], new Racket.Exp(), namespace);
    namespace["void?"].eval = function(syntaxStrTreeArg, namespace) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Void");
    }
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
    namespace["string<=?"] = new Racket.Lambda(["str1","str2",".","rst"], new Racket.Exp(), namespace);
    namespace["string<=?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("string<=? requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Str")
                equal = equal && (syntaxStrTreeArg[i].value <= syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Str Type");
                return null;
            }
        }
        return new Racket.Bool(equal);
    }
    namespace["string<?"] = new Racket.Lambda(["str1","str2",".","rst"], new Racket.Exp(), namespace);
    namespace["string<?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("string<? requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Str")
                equal = equal && (syntaxStrTreeArg[i].value < syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Str Type");
                return null;
            }
        }
        return new Racket.Bool(equal);
    }
    namespace["string>?"] = new Racket.Lambda(["str1","str2",".","rst"], new Racket.Exp(), namespace);
    namespace["string>?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("string>? requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Str")
                equal = equal && (syntaxStrTreeArg[i].value > syntaxStrTreeArg[i+1].value);
            else {
                outputlog("Not all arguments were Str Type");
                return null;
            }
        }
        return new Racket.Bool(equal);
    }
    namespace["string>=?"] = new Racket.Lambda(["str1","str2",".","rst"], new Racket.Exp(), namespace);
    namespace["string>=?"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length <= 2) {
            outputlog("string>=? requires at least 2 arguments.");
            return null;
        }
        for (var i=1; equal && i< syntaxStrTreeArg.length-1; ++i) {
            if (syntaxStrTreeArg[i].type === "Str")
                equal = equal && (syntaxStrTreeArg[i].value >= syntaxStrTreeArg[i+1].value);
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
        if (syntaxStrTreeArg.length != 3 || syntaxStrTreeArg[1].type !== "Str" || syntaxStrTreeArg[2].type !== "Num") {
            outputlog("string-ref requires a Str and Num argument.");
            return null;
        }
        var chr = syntaxStrTreeArg[1].value.charAt(syntaxStrTreeArg[2].value);
        return new Racket.Char(chr);
    }
    namespace["string-length"] = new Racket.Lambda(["str"], new Racket.Exp(), namespace);
    namespace["string-length"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length <= 2 || syntaxStrTreeArg[1].type !== "Str") {
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
        if (syntaxStrTreeArg.length !== 2 || syntaxStrTreeArg[1].type !== "Str") {
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
        return new Racket.FunctionCall(chrlist.slice(0,chrlist.length-shift),namespace);
    }
    namespace["print"] = new Racket.Lambda(["obj"], new Racket.Exp(), namespace);
    namespace["print"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2 || !syntaxStrTreeArg[1].type instanceof Racket.Type) {
            outputlog("print requires 1 argument.");
            return null;
        }
        outputfield.value+=syntaxStrTreeArg[1].toString();
        return true;
    }
    namespace["write"] = namespace["print"]; // For now until I actually write lists as '() ...
    namespace["display"] = namespace["print"];
    namespace["fprintf"] = new Racket.Lambda(["out","form","v",".","rst"], new Racket.Exp(), namespace);
    namespace["fprintf"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length < 4 || syntaxStrTreeArg[2].type != "Str") {
            outputlog("fprintf did not receive the right arguments.");
            return null;
        }
        var currentObject = 3;
        var formatStr = syntaxStrTreeArg[2].value;

        // defaults to console box for #<output-port>
        var out = outputfield;
        var error = false;
        for (var i = 0; i< formatStr.length && currentObject < syntaxStrTreeArg.length; ++i) {
            if (formatStr.charAt(i) === "\~") {
                ++i;
                //console.log(formatStr.charAt(i), error,currentObject);

                switch (formatStr.charAt(i)) {
                    case "n":
                    case "\%":
                        out.value +="\n";
                        break;
                    case "a": //use (display)
                    case "A":
                        error = ! (new Racket.FunctionCall(["display",syntaxStrTreeArg[currentObject]],namespace).eval());
                        ++currentObject;
                        break;
                    case "s": //use (write)
                    case "S":
                        error = ! (new Racket.FunctionCall(["write",syntaxStrTreeArg[currentObject]],namespace).eval());
                        ++currentObject;
                        break;
                    case "v": //use (print)
                    case "V":
                        error = ! (new Racket.FunctionCall(["print",syntaxStrTreeArg[currentObject]],namespace).eval());
                        ++currentObject;
                        break;
                    // ~. ~e ~E ~c ~C ~b ~B ~o ~0 ~x ~X ~<whitespace> are not supported
                    case "\~":
                        out.value +="\~";
                        break;
                    default:
                        error = true;
                        break;
                }
                if (error) {
                    break;
                }
            } else if (formatStr.charAt(i) === "\\") { //escapes
                ++i;

                switch (formatStr.charAt(i)) {
                    case "n":
                        out.value+= "\n";
                        break;
                    case "t":
                        out.value+= "\t";
                        break;
                    case "\\":
                        out.value+= "\\";
                        break;
                    case "\'":
                        out.value+= "\'";
                        break;
                    case "\"":
                        out.value+= "\"";
                        break;
                    default:
                        break;
                }
            } else {
                out.value+=""+formatStr.charAt(i);
            }
        }
        if (error) {
            outputlog("fprintf has received an unsupported \~ operator");
            return null;
        } else {
            return true; //no errors
        }
    }
    namespace["printf"] = new Racket.Lambda(["form","v",".","rst"], new Racket.Exp(), namespace);
    namespace["printf"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length < 3) {
            outputlog("printf did not receive the right arguments.");
            return null;
        }
        // Empty is a placeholder for when i implement #<output-port>
        return new Racket.FunctionCall(["fprintf",new Racket.Empty(),syntaxStrTreeArg[1]].concat(syntaxStrTreeArg.slice(2)),namespace);
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
    namespace["char->integer"] = new Racket.Lambda(["chr1"], new Racket.Exp(), namespace);
    namespace["char->integer"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type==="Char") {
            return new Racket.Num(syntaxStrTreeArg[1].value.charCodeAt(0));

        } else {
            outputlog("char->integer requires 1 Char argument.");
            return null;
        }
    }
    namespace["integer->char"] = new Racket.Lambda(["int"], new Racket.Exp(), namespace);
    namespace["integer->char"].eval = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type==="Num") {
            return new Racket.Char(String.fromCharCode(syntaxStrTreeArg[1].value));
        } else {
            outputlog("integer->char requires 1 Num argument.");
            return null;
        }
    }
    namespace["not"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["not"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length == 2) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Bool" && !syntaxStrTreeArg[1].value);
        } else {
            outputlog("not did not receive 1 argument.");
            return null;
        }
    }
    namespace["random"] = new Racket.Lambda(["max"], new Racket.Exp(), namespace);
    namespace["random"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length == 2 && syntaxStrTreeArg[1].type === "Num") {
            var max = Math.floor(syntaxStrTreeArg[1].value); //for clarity
            var min = 0;
            return new Racket.Num(Math.floor(Math.random() * (max - min)) + min);
        } else {
            outputlog("random did not receive 1 argument.");
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
        if (syntaxStrTreeArg.length === 2) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Empty");
        } else {
            outputlog("empty? was not called with 1 argument.");
            return null;
        }
    }
    namespace["cons?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["cons?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Cell");
        } else {
            outputlog("cons? was not called with 1 argument.");
            return null;
        }
    }
    namespace["pair?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["pair?"].eval = function(syntaxStrTreeArg, namespace) {
      if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.List) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Cell");
      } else {
        outputlog("pair? was not called with 1 list.");
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
    namespace["length"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["length"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.List) {
            var len = syntaxStrTreeArg[1].length();
            if (len !== null)
                return new Racket.Num(len);
            else {
                outputlog("length received an invalid list.");
                return null;
            }
        } else {
            outputlog("length did not receive 1 list.");
            return null;
        }
    }
    namespace["identity"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["identity"].eval = function(syntaxStrTreeArg, namespace) {
        return syntaxStrTreeArg[1];
    }
    namespace["apply"] = new Racket.Lambda(["fn","list-arg"], new Racket.Exp(), namespace);
    namespace["apply"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 3 && new Racket.FunctionCall(["list?", syntaxStrTreeArg[2]],namespace).eval().value === true) {
            var arr;
            var len;
            if (syntaxStrTreeArg[2] instanceof Racket.List) {
                len = syntaxStrTreeArg[2].length();
                if (len !== null)
                    arr = new Array(len + 1); // gets length of cons list using function length;
                else {
                    outputlog("apply received an invalid list.");
                    return null;
                }
            } else
                arr = [];
            arr[0]=syntaxStrTreeArg[1];
            var count = 1;
            var list = syntaxStrTreeArg[2];
            while(list.type !== "Empty") {
                arr[count]=list.left;
                list = list.right;
                count++;
            }
            return new Racket.FunctionCall(arr, namespace);
        } else {
            outputlog("apply was not called with 2 arguments.");
            return null;
        }
    }
    namespace["vector?"] = new Racket.Lambda(["vec"], new Racket.Exp(), namespace);
    namespace["vector?"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2){
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Vector");
        } else {
            return null;
        }
    }
    namespace["vector"] = new Racket.Lambda([".","list-arg"], new Racket.Exp(), namespace);
    namespace["vector"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length >= 1){
            return new Racket.Vector(syntaxStrTreeArg.slice(1), syntaxStrTreeArg.length-1);
        } else {
            return null;
        }
    }
    namespace["make-vector"] = new Racket.Lambda(["size",".","init"], new Racket.Exp(), namespace);
    namespace["make-vector"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length >= 2 && syntaxStrTreeArg.length <= 3 && syntaxStrTreeArg[1].type==="Num"){
            if (syntaxStrTreeArg[1].value <0){
                outputlog("make-vector was called with size less than 0.");
                return null;
            }
            var val = syntaxStrTreeArg[2] || new Racket.Num(0);
            var array = [];
            for (var i = 0; i < syntaxStrTreeArg[1].value; i++) {
                array[i] = val;
            }
            return new Racket.Vector(array, syntaxStrTreeArg[1].value);
        } else {
            return null;
        }
    }
    namespace["vector-length"] = new Racket.Lambda(["vec"], new Racket.Exp(), namespace);
    namespace["vector-length"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type === "Vector"){
            return new Racket.Num(syntaxStrTreeArg[1].length);
        } else {
            outputlog("vector-length was not called with 1 Vector.");
            return null;
        }
    }
    namespace["vector-ref"] = new Racket.Lambda(["vec","pos"], new Racket.Exp(), namespace);
    namespace["vector-ref"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 3 && syntaxStrTreeArg[1].type === "Vector" && syntaxStrTreeArg[2].type === "Num"){
            var index = syntaxStrTreeArg[2].value;
            if (0<= index && index<syntaxStrTreeArg[1].length)
                return syntaxStrTreeArg[1].ith(syntaxStrTreeArg[2].value);
            else {
                outputlog("vector-ref was called with index out of bounds.");
            }
        } else {
            outputlog("vector-ref was not called with 1 Vector and 1 Num.");
            return null;
        }
    }
    namespace["vector->list"] = new Racket.Lambda(["vec"], new Racket.Exp(), namespace);
    namespace["vector->list"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type === "Vector"){
            var vec = syntaxStrTreeArg[1];

            return new Racket.FunctionCall(["list"].concat(vec.arr),namespace);
        } else {
            outputlog("vector->list was not called with 1 Vector.");
            return null;
        }
    }
    namespace["vector-set!"] = new Racket.Lambda(["vec","idx","val"], new Racket.Exp(), namespace);
    namespace["vector-set!"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 4 && syntaxStrTreeArg[1].type === "Vector" && syntaxStrTreeArg[2].type === "Num" && syntaxStrTreeArg[3] instanceof Racket.Type){
            var vec = syntaxStrTreeArg[1];
            var idx = syntaxStrTreeArg[2].value;
            if (0<=idx && idx < vec.length) {
                vec.arr[idx] = syntaxStrTreeArg[3];
            }
            return true;
        } else {
            outputlog("vector-set! was not called with a Vector, Num, and a Value.");
            return null;
        }
    }
    namespace["list->vector"] = new Racket.Lambda(["lst"], new Racket.Exp(), namespace);
    namespace["list->vector"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.List){
            var arr = ["vector"];
            var cell = syntaxStrTreeArg[1];
            while(cell.type === "Cell"){
                arr.push(cell.left);
                cell = cell.right;
            }
            if (cell.type != "Empty"){
                outputlog("vector-list was called with an improper List.")
                return null;
            }

            return new Racket.FunctionCall(arr,namespace);
        } else {
            outputlog("vector->list was not called with 1 List.");
            return null;
        }
    }
    namespace["vector-append"] = new Racket.Lambda(["vec",".","rst"], new Racket.Exp(), namespace);
    namespace["vector-append"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length >= 2){
            var isAllVec = true;
            for (var i=1; i<syntaxStrTreeArg.length; ++i){
                isAllVec = isAllVec && syntaxStrTreeArg[i].type === "Vector";
            }
            if (isAllVec){
                var arr = ["vector"];
                for (var i=1; i<syntaxStrTreeArg.length; ++i){
                    arr = arr.concat(syntaxStrTreeArg[i].arr);
                }
                return new Racket.FunctionCall(arr,namespace);
            } else {
                outputlog("vector-append was not called with all Vector arguments.");
                return null;
            }

        } else {
            outputlog("vector-append was not called with at least 1 Vector.");
            return null;
        }
    }
    namespace["vector-map"] = new Racket.Lambda(["proc","vec",".","rst"], new Racket.Exp(), namespace);
    namespace["vector-map"].eval = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length >= 3){
            var isAllVecAndSameLength = true;
            var arrlen = syntaxStrTreeArg[2].length;
            for (var i=2; i<syntaxStrTreeArg.length; ++i){
                isAllVecAndSameLength = isAllVecAndSameLength && syntaxStrTreeArg[i].type === "Vector" && syntaxStrTreeArg[i].length === arrlen;
            }
            if (isAllVecAndSameLength){

                var arr = ["vector"];

                for (var i=0; i<arrlen; ++i){
                    var exp = [syntaxStrTreeArg[1]];
                    for (var k=2; k < syntaxStrTreeArg.length; ++k){
                        exp.push(syntaxStrTreeArg[k].arr[i]);
                    }
                    arr.push(new Racket.FunctionCall(exp,namespace).eval());
                }

                return new Racket.FunctionCall(arr,namespace);
            } else {
                outputlog("vector-map was not called with all Vector arguments, or ones that are the same length.");
                return null;
            }

        } else {
            outputlog("vector-map was not called with at least 1 Vector.");
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
    fileupload = document.getElementById("file-upload");
    filesubmit = document.getElementById("file-upload-submit");
    deletemenu = document.getElementById("delete-module-menu");
    deletebutton = document.getElementById("delete-button");
    deletebutton.onclick = function() {
        var filename = deletemenu.value;
        if (uploadedModulesParsed[filename])
            delete uploadedModulesParsed[filename];
        if (uploadedModulesRawText[filename])
            delete uploadedModulesRawText[filename];
        deletemenu.remove(deletemenu.selectedIndex);
    }
    filesubmit.onclick = function(){};
    submitbutton.onclick=evaluate;
    textfield.onkeyup = automaticIndent;
    clearbutton.onclick = function () { outputfield.value = ""; };
    // Setup upload functionality
    setupModuleLoading();

    outputlog("Please wait until ("+libraryFilesCount+") libraries are loaded.");
    loadCode();
};

function outputlog(str) {
    outputfield.value += str+"\n";
    //console.log("Logged: "+str);
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

    //Indent types
    var cond_like = ["cond", "case-lambda", "begin"];
    var lambda_like = ["lambda", "let", "let*", "letrec"];
    var define_like = ["define", "local", "define-struct","λ"];


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
                } else if (define_like.indexOf(keyword)!=-1) {
                    textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+2).join(" ") + trim(textfield.value.substring(caretSpot));
                    setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+1);
                } else if (lambda_like.indexOf(keyword)!=-1) {
                    if (inLineArguments) {
                        textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+2).join(" ") + trim(textfield.value.substring(caretSpot));
                        setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+1);
                    } else {
                        textfield.value = textfield.value.substring(0,caretSpot) + Array(tokenizeInputIndexes[bracketIndex+1]+4).join(" ") + trim(textfield.value.substring(caretSpot));
                        setCaretPosition(textfield, caretSpot + tokenizeInputIndexes[bracketIndex+1]+3);
                    }
                } else if (cond_like.indexOf(keyword)!=-1) {
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
        };
        httpReq.send();
    }
    requestFile("libraries/list-functions.rkt");
    requestFile("libraries/other-functions.rkt");
}


function setupModuleLoading(){ //HTML API for reading files into a string
    filesubmit.onclick = function() {
        if (fileupload.files && fileupload.files[0]){//exists when file is selected
            var file = fileupload.files[0];
            var reader = new FileReader();
            reader.readAsText(file, "UTF-8");
            reader.onload = function (e) {
                uploadedModulesRawText[fileupload.files[0].name] = e.target.result;

                //so only have to tokenize, parse once
                var tokenized = tokenize(uploadedModulesRawText[fileupload.files[0].name]);
                var parsedBlocks = parseStr(tokenized);

                if (tokenized && parsedBlocks){
                    uploadedModulesParsed[fileupload.files[0].name] = parsedBlocks;

                    //But also make sure no duplicate names exist
                    for (var i = 0; i< deletemenu.options.length; ++i){
                        if (deletemenu.options[0].text === fileupload.files[0].name) {
                            deletemenu.remove(i);
                        }
                    }

                    //Add option to delete to html drop-down list
                    deletemenu.options.add(new Option(fileupload.files[0].name,fileupload.files[0].name));

                    alert(fileupload.files[0].name+" uploaded and parsed successfully.");
                } else
                    alert(fileupload.files[0].name+" uploaded successfully, but could not be parsed.");
            };
        }
    }
}


function tokenize(input) {
    var temp = input.replace(/['\(\)\[\]]/g, function(a){return " "+a+" ";})
    //|(?=[\(\)\[\]])|(?<=[\(\)\[\]])
    // Why does JS not support positive look-behind? :(
    //console.log(temp);
    var temp2 = "";
    var quoteEnabled = false;
    var multilineCommentEnabled = false;
    for (var i=0; i< temp.length; ++i) {
        if (temp.charAt(i) === "\"")
            quoteEnabled = true;
        else if (temp.substring(i,i+2) === "\#\|")
            multilineCommentEnabled = true;

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
            var unquoted = quoted.replace(/ ['\(\)\[\]] /g, function(a){return a.charAt(1);});

            temp2 += unquoted;
            i = quoteEnd;
            quoteEnabled = false;
        } else if (multilineCommentEnabled) {
            var commentEnd = i;
            var nestedComments = 1;
            for (var j=i+1; j< temp.length; ++j) {
                if (temp.substring(j,j+2) === "\#\|") {
                    nestedComments++;
                } else if (temp.substring(j,j+2) === "\|\#") {
                    nestedComments--;
                }
                if (nestedComments === 0){
                    commentEnd = j;
                    j = temp.length
                }
            }
            if (commentEnd === i || nestedComments >0) {
              console.log("Mismatching nested comments when tokenizing.");
              return null;
            }
            i = commentEnd+2;
            multilineCommentEnabled = false;
        } else
            temp2 +=temp.charAt(i);
    }
    //console.log(temp2);
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

        if (checkbox.checked && readyForUser)
            outputfield.value = "";

        var namespace;
        if (libraryLoadMode) {
            namespace = libraryNamespace;
        } else {
            globalNamespace = Namespace(libraryNamespace, true);
            globalNamespace["#moduleNamespaces"] = {}; // Make containers only in globalNamespace
            globalNamespace["#moduleNamespaces"]["#moduleProvide"] = {};
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

    console.log("Parsed String Code Blocks:" );
    console.log(strCodeBlocks);

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
        if (unparsedBlocks[0]==="'") {
            var firstNotSymbol;
            for (var i=1; i<unparsedBlocks.length; ++i) {
                if (unparsedBlocks[i] !== "'") {
                    firstNotSymbol = i;
                    i = unparsedBlocks.length; //exit loop
                }
            }
            if (firstNotSymbol) {
                if (unparsedBlocks[firstNotSymbol] === "(") {
                    var bracketcount = 1;
                    for (var i=firstNotSymbol+1; i<unparsedBlocks.length; ++i) {
                        if (unparsedBlocks[i]==="(")
                            bracketcount++;
                        else if (unparsedBlocks[i]===")") {
                            bracketcount--;
                            if (bracketcount === 0) {
                                var splicedblock = unparsedBlocks.slice(0,i+1);
                                block.push(splicedblock);
                                unparsedBlocks = unparsedBlocks.slice(i+1,unparsedBlocks.length);
                                i = unparsedBlocks.length; //found end of block, exit loop
                            }
                        }
                    }
                } else {//singleton, not list
                    var splicedblock = unparsedBlocks.slice(0,firstNotSymbol+1);
                    block.push(splicedblock);
                    unparsedBlocks = unparsedBlocks.slice(firstNotSymbol+1,unparsedBlocks.length);
                }
            } else { //should never be reached, since this means ' ends code
                outputlog("Unfinished \'.");
            }
        }
        else if (unparsedBlocks[0]==="(") {
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
            block.push (unparsedBlocks[0]);
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

        var exp = new Racket.FunctionCall(syntaxStrBlocks[0], namespace).eval();
        if (exp) { // Expression is simplest form
            if (exp !== true && exp.type !== "Void")
                outputlog(""+exp); //Print output to console
            return syntaxStrBlocks.slice(1); //return rest of blocks to parse
        } else {
            //#lang racket ignore
            if (syntaxStrBlocks.length >= 2 && syntaxStrBlocks[0] === "#lang" && syntaxStrBlocks[1] === "racket")
                return syntaxStrBlocks.slice(2);
        }
    }
}

function parseLookupType(expression,namespace) {
    //console.log("Tried parsing: "+ expression);
    //console.log(namespace);
    if (expression instanceof Racket.Type || expression === null)
        //replaced (expression instanceof Racket.Type || expression instanceof Racket.FunctionCall) for now
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
    } else if (namespace["#moduleNamespaces"]["#moduleProvide"] && namespace["#moduleNamespaces"]["#moduleProvide"].hasOwnProperty(expression)) {
        var moduleName = namespace["#moduleNamespaces"]["#moduleProvide"][expression].sourceModule;
        return parseLookupType(expression,namespace["#moduleNamespaces"][moduleName]);
    } else if (expression === "#lang") { //#lang racket
        return false;
    } else {
        outputlog("Unknown type: "+expression);
        return null;
    }
}
var aggressiveOptimization = true;
function parseExpTree (syntaxStrTree, namespace) {
    do {
        // This will not loop forever, it exits when null is encountered
        // The loop is to facilitate tail-optimization with FunctionCall Objects
        // As such, it continues when evaluation encounters one.

        if (Array.isArray(syntaxStrTree)) {

            var lookupExp; // Expression to call, whether it is special form or function
            lookupExp = parseExpTree(syntaxStrTree[0],namespace);

            //evaluate function if lookup was successful
            if (lookupExp) {
                var result;
                var evalExp;
                var evalNamespace;
                if (lookupExp.type === "SpecialForm") {//if special form, do not evaluate arguments
                    // Do nothing
                    //result =  lookupExp.eval(syntaxStrTree, namespace);
                    evalExp = syntaxStrTree;
                    evalNamespace = namespace;
                } else if (lookupExp.type === "Lambda"){
                    // For functions:
                    // evaluate the function call arguments first
                    var evaluatedSyntaxStrTree = new Array(syntaxStrTree.length);
                    evaluatedSyntaxStrTree[0] = syntaxStrTree[0];
                    var argEvalSuccess = true;
                    for (var i = 1; i< syntaxStrTree.length; ++i) {
                        evaluatedSyntaxStrTree[i] = parseExpTree(syntaxStrTree[i],namespace);
                        argEvalSuccess = argEvalSuccess && (evaluatedSyntaxStrTree[i] instanceof Racket.Type);
                    }
                    if (!argEvalSuccess){ // Check if it was successful in producing Racket.Types for the arguments
                        outputlog(""+ syntaxStrTree[0]+ " function call arguments were not all Typed");
                        //console.log(evaluatedSyntaxStrTree);
                        return null;
                    } else {
                        evalExp = evaluatedSyntaxStrTree;
                        evalNamespace = namespace;
                        //result = lookupExp.eval(evaluatedSyntaxStrTree,namespace);
                    }
                } else if (lookupExp.type !== "Lambda") { // Should have been a function
                    outputlog(syntaxStrTree[0]+" is not a function.");
                    return null;
                }

                //Aggressive tail-call namespace optimization that I'm not certain is safe but will try anyways.
                // This is on by default.
                // This would help reduce nesting of namespaces by forcefully going to a parent namespace
                var fnName = syntaxStrTree[0];
                // If the function is accessed by id, (presumably meaning it is not a temporary lambda), then
                // fnName would be a string (id) and tail recursion would occur
                // Also, it cannot be a special form, so this checks for that too
                if (aggressiveOptimization && (typeof fnName == 'string' || fnName instanceof String) && !specialForms[fnName] /*&& !evalNamespace.hasOwnProperty(fnName)*/){
                    //console.log(fnName);

                    // Then proceeds to find the deepest namespace that has this as defined function that is identical
                    // Also makes sure deepest namespace reached is not the library of functions namespace
                    var searchNamespace = evalNamespace;

                    var parentNamespace = searchNamespace["#upperNamespace"];
                    while (parentNamespace[fnName] === lookupExp && parentNamespace !== libraryNamespace){
                        searchNamespace = parentNamespace;
                        parentNamespace = searchNamespace["#upperNamespace"];
                    }
                    evalNamespace = searchNamespace;
                }

                // Evaluate function/special form call
                result =  lookupExp.eval(evalExp, evalNamespace);

                if (result) {
                    if (result.type === "FunctionCall"){
                        var exps = result.exp;
                        var nmsp = result.namespace;

                        syntaxStrTree = exps;
                        namespace = nmsp;
                        continue;
                    }
                    else {
                        // Not FunctionCall (tail-recursion) object? Must mean regular Racket.Type is the result
                        return result;
                    }
                } else {
                    var type = (lookupExp.type === "SpecialForm"? "Special form: " : "Function or Lambda: ");
                    outputlog(type+syntaxStrTree[0]+" evaluation returned error");
                    return null;
                }
            } else {
                outputlog("Descriptor not found: "+syntaxStrTree[0]);
                return null;
            }
        } else {
            return parseLookupType(syntaxStrTree, namespace);
        }

    } while(true);
}
