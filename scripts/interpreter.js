var textfield;
var submitbutton;
var reindentbutton;
var outputfield;
var clearbutton;
var fileupload;
var filesubmit;
var filename;
var deletemenu;
var deletebutton;
var listAbbrev;

// ---------- SCHEME TYPE DECLARATIONS AND SETUP ----------

/*Array.prototype.isArray =  function (o){
    //return o.constructor === Array;
    //return Object.prototype.toString.call(this) == '[object Array]';
};*/

// This solves all my problems with JS's prototypical inheritance :D
function Namespace(inheritedNamespace, isTopLevel) {
    var newNamespace = Object.create(inheritedNamespace);

    //should be obfuscated enough, since ids cannot have #'s anyways.
    //__proto__ is not implemented in every browser, so this will do for now
    newNamespace["#upperNamespace"] = inheritedNamespace;
    newNamespace["#isTopLevel"] = isTopLevel === true;
    // newNamespace["#moduleNamespaces"] is not defined here since it will overwrite, and I do not want overwrite
    // Rather, I want the prototypical nature of namespaces to provide lookup to parent namespace's ["#moduleNamespaces"]

    // make the container #moduleProvide inside #moduleNamespaces
    //newNamespace["#thisModuleProvide"] = {}; //list of module provided id's
    return newNamespace;
};

var Racket = {};

Racket.Namespace = {};


var libraryNamespace = Namespace(Racket.Namespace);
libraryNamespace["#thisModuleProvide"] = {};
libraryNamespace["#moduleNamespaces"] = {};
libraryNamespace["#moduleNamespaces"]["#moduleProvide"] = {};
var globalNamespace = Namespace(libraryNamespace,true);
globalNamespace["#moduleNamespaces"] = {}; // Make containers only in globalNamespace
globalNamespace["#moduleNamespaces"]["#moduleProvide"] = {};

var uploadedModulesRawText = {};
var uploadedModulesParsed = {};

var aggressiveOptimization = false;


// ---------- RACKET TYPES BELOW ----------


Racket.Exp = function () {
};


Racket.Type = function() {
};
Racket.Type.prototype = new Racket.Exp();
Racket.Type.prototype.isRacketType = true;
Racket.Type.prototype.eval = function() { return this; };
//Racket.Type.verboseToString = function() { return this.toString(); };


// ---------- ATOMIC TYPES ----------
Racket.Num = function (value) {
    this.value=value; //JS floating point
};
Racket.Num.prototype = new Racket.Type();
Racket.Num.prototype.type="Num";
Racket.Num.prototype.toString = function(){
    return ""+this.value;
};
// -----
Racket.Str = function (value) {
    this.value=value; //JS string
};
Racket.Str.prototype = new Racket.Type();
Racket.Str.prototype.type="Str";
Racket.Str.prototype.toString = function(){
    return "\""+this.value+"\"";
};
// ----
Racket.Bool = function (value) {
    this.value=value; //JS boolean, either true or false
};
Racket.Bool.prototype = new Racket.Type();
Racket.Bool.prototype.type="Bool";
Racket.Bool.prototype.toString = function(){
    return (this.value? "#t" : "#f");
};
// -----
Racket.Sym = function (value) {
    this.value=value; //JS string
};
Racket.Sym.prototype = new Racket.Type();
Racket.Sym.prototype.type="Sym";
Racket.Sym.prototype.toString = function() {
    var hasSpace = false;
    var allNum = true;
    for (var i=0; i< this.value.length; ++i) {
        var c = this.value.charAt(i);
        if (c === " ") {
            hasSpace=true;
            break;
        }
        if (!(c.charCodeAt(0) >= 48 && c.charCodeAt(0) <= 57)) {
            allNum = false;
            break;
        }
    }
    var addAbs = hasSpace || allNum;
    return "\'"+ (addAbs? "\|":"") + this.value + (addAbs? "\|":"");
};
// -----
Racket.Char = function (value) {
    this.value=value; //JS string, length 1
    if (value ==="newline") {
        this.value = "\\n";
    }
};
Racket.Char.prototype = new Racket.Type();
Racket.Char.prototype.type = "Char";
Racket.Char.prototype.toString = function() {
    return this.value=== "\\n" ? "\#\\newline" : "#\\"+this.value;
};

// ---------- LIST TYPES ----------
Racket.List = function () {
};
Racket.List.prototype = new Racket.Type();
Racket.List.prototype.isRacketList = true;
// -----
Racket.Empty = function () {
};
Racket.Empty.prototype = new Racket.List();
Racket.Empty.prototype.type = "Empty";
Racket.Empty.prototype.toString = function () {
    return listAbbrev.checked? "\'\(\)" : "empty";
};
Racket.Empty.prototype.length = function() { return 0; };
// -----
Racket.Cell = function (left, right) {
    this.left = left;
    this.right = right;
};
Racket.Cell.prototype = new Racket.List();
Racket.Cell.prototype.type="Cell";
Racket.Cell.prototype.length = function() {
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
Racket.Cell.prototype.toString = function () { // Prints shorthand literal notation '(...) instead of full-blown (list ...)
    if (!listAbbrev.checked) {
        return this.verboseToString();
    }

    var returnStr = "\'";
    var ending;
    var currentCell = this;

    if (currentCell.left.type === "Sym" && currentCell.left.value === "quote" && currentCell.right.right.type === "Empty") {
        ending = "";
        returnStr+="\'";
        currentCell = currentCell.right;
    } else {
        ending = "\)";
        returnStr+="\("
    }

    do {
        var add = "";
        if (currentCell.left.type === "Sym") {
            if (currentCell.left.value === "quote" && currentCell.right.right.type === "Empty") {
                add +="\'";
            } else {
                add += currentCell.left.value;
            }
        } else if (currentCell.left.isRacketList) {
            add += currentCell.left.toString().substring(1);
        } else {
            add += currentCell.left.toString();
        }
        returnStr+=add;

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


    return returnStr+ending;
};
Racket.Cell.prototype.verboseToString = function () {
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




// ---------- STRUCTURE ----------
Racket.Struct = function () {
};
Racket.Struct.prototype = new Racket.Type();

// ---------- VECTOR ----------
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
Racket.Vector.prototype = new Racket.Type();


// ---------- VOID ----------
Racket.Void = function() {
};
Racket.Void.prototype = new Racket.Type();
Racket.Void.prototype.type="Void";
Racket.Void.prototype.toString=function() {
    return "\#\<void\>";
};


// ---------- FUNCTIONS AND THINGS THAT CAN BE CALLED LIKE A FUNCTION ----------
Racket.Function = function () { // Covers Lambda and Case-Lambda
};
Racket.Function.prototype = new Racket.Type();
Racket.Function.prototype.type = "Lambda";
Racket.Function.prototype.toString = function() { return "\#\<procedure\>"; };
// -----
Racket.SpecialForm = function () {
};
Racket.SpecialForm.prototype = new Racket.Function();
Racket.SpecialForm.prototype.type = "SpecialForm";
Racket.SpecialForm.prototype.toString = function() { return "\#\<macro\>"; };
Racket.SpecialForm.prototype.eval = function (syntaxStrTreeArg, namespace, continuation) {
    var result = this.evalBody(syntaxStrTreeArg,namespace, continuation);
    return result;
};
// -----
Racket.Lambda = function (ids, body, namespace) {
    // ids is an Array of Strings that is declared in the sub-namespace
    // body is the Exp that will involve members of ids

    this.name = "lambda";

    if (ids ==null || body ==null || namespace ==null)
        return null;

    if (ids.constructor === Array) {
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
        // implicit begin keyword wrapping the body
        this.body = ["begin"].concat(body);
    } else 
        this.body = body[0];
    this.inheritedNamespace = namespace;
};
Racket.Lambda.prototype = new Racket.Function();
Racket.Lambda.prototype.eval = function (syntaxStrTreeArg, namespace, continuation) {
    var result = this.evalBody(syntaxStrTreeArg,namespace,continuation); // usually the third parameter is not used
    return result;
};
Racket.Lambda.libraryEval = function (syntaxStrTreeArg, namespace, continuation) { // other uses
    var result = this.evalBody(syntaxStrTreeArg,namespace,continuation);
    return continuation.eval([continuation, result], namespace, continuation);
};
Racket.Lambda.prototype.evalBody = function (syntaxStrTreeArg, namespace, continuation) {
    var lambdaNamespace = Namespace(this.inheritedNamespace);
    var paramCount = syntaxStrTreeArg.length -1;
    if (paramCount == this.minParamCount
    || (paramCount >= this.minParamCount && this.hasRestArgument)) {
        for (var i=0; i< this.minParamCount; ++i) {
            lambdaNamespace[this.ids[i]]=syntaxStrTreeArg[i+1];
        }
        if (this.hasRestArgument) {
            var listMake = ["list"].concat(syntaxStrTreeArg.slice(this.minParamCount+1));
            var identity = new Racket.Continuation(namespace);
            identity.continuation = Racket.Continuation.continuation.identity;
            lambdaNamespace[this.restArg] = new Racket.SExp(listMake,lambdaNamespace,identity).evalFinal();
        }
        return new Racket.SExp(this.body, lambdaNamespace, continuation);
    } else {
        outputlog("Function parameter count mismatch.");
        return null;
    }
};
// -----
Racket.CaseLambda = function (body, namespace) {
    // body is an [[ids body], ...] where each element is a valid new Lambda(ids, body, namespace)

    this.name = "case-lambda";
    this.inheritedNamespace = namespace;
    this.caseBody = body;
};
Racket.CaseLambda.prototype = new Racket.Function();
Racket.CaseLambda.prototype.eval = Racket.Lambda.prototype.eval;
Racket.CaseLambda.prototype.evalBody = function (syntaxStrTreeArg, namespace, continuation) {
    var paramCount = syntaxStrTreeArg.length -1;
    for (var i=0; i< this.caseBody.length; ++i) {
        var minParamCount;
        var hasRestArgument;
        var restArg;
        if (this.caseBody[i][0].constructor === Array) { //list of ids
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
            var newBody = [new Racket.Lambda(this.caseBody[i][0], 
                                            this.caseBody[i].slice(1), 
                                            this.inheritedNamespace)].concat(syntaxStrTreeArg.slice(1));
            return new Racket.SExp(newBody, namespace, continuation);
        } else {}; //skip to next case
    }

    // Should not have gotten here if it was a well evaluated function
    outputlog("Function parameter count mismatch.");
    return null;
};
// -----
Racket.Continuation = function (namespace,continuation) {
    this.namespace = namespace;
    this.continuation = continuation;
};
Racket.Continuation.prototype = new Racket.Function();
Racket.Continuation.prototype.type = "Continuation";
Racket.Continuation.prototype.toString = function() {
    return "\#\<continuation\>";
};
Racket.Continuation.continuation = {};
Racket.Continuation.continuation.identity = function(r) { return r; };
Racket.Continuation.prototype.eval = function (exp,namespace,continuation) {
    // Called like (cc result)
    // var continuation is never used
    // var namespace is never used
    
    /*if (continuation != this) {
        console.log("Swapping contexts for call ",exp," from ",continuation," to ",this);
    }*/
    return this.continuation(exp[1],this.namespace);
};



// ---------- S-EXPRESSIONS ----------
Racket.SExp = function(exp, namespace, continuation) { // This is a wrapper for SExp as a Type.
    this.exp = exp;
    this.expState = 0;
    this.namespace = namespace;
    this.continuation = continuation;
    this.callName=null;
};
Racket.SExp.prototype = new Racket.Exp();
Racket.SExp.prototype.type = "SExp";
Racket.SExp.prototype.evalFinal = function() {
    var sexp = this;

    /*var toString = Array.prototype.toString;
    Array.prototype.toString = function() {
        return '\(' + this.join(' ') + '\)';
    };*/

    do {
        if (sexp.exp.constructor === Array) {
            //console.log(sexp.exp.toString());
        }
        sexp = sexp.eval();

    } while (sexp.type === "SExp");

    //Array.prototype.toString = toString;

    return sexp;
};
Racket.SExp.prototype.eval = function(){
    if (this.exp.constructor !== Array) {
        var lookupResult = parseLookupType(this.exp, this.namespace);
        return this.continuation.eval([this.continuation, lookupResult],this.namespace,this.continuation);
    } 

    if (this.expState >= this.exp.length) {
        if (this.callName !=null){
            // Search up namespace
            // returns new SExp with transplanted namespace
            // callName is blanked

            // Aggressive tail-call namespace optimization that I'm not certain is safe but will try anyways.
            // This is on by default.
            // This would help reduce nesting of namespaces by forcefully going to a parent namespace
            // If the function is accessed by id, (presumably meaning it is not a temporary lambda), then
            // fnName would be a string (id) and tail recursion would occur
            // Also, it cannot be a special form, so this checks for that too
            if (aggressiveOptimization){

                // Then proceeds to find the deepest namespace that has this as defined function that is identical
                // Also makes sure deepest namespace reached is not the library of functions namespace
                var searchNamespace = this.namespace;
                var fnName = this.callName;
                var lookupExp = this.exp[0];
                var parentNamespace = searchNamespace["#upperNamespace"];
                while (parentNamespace[fnName] === lookupExp && parentNamespace !== libraryNamespace){
                    searchNamespace = parentNamespace;
                    parentNamespace = searchNamespace["#upperNamespace"];
                }
                this.namespace = searchNamespace;
            }
        }
        var result = this.exp[0].eval(this.exp,this.namespace,this.continuation);
        if (!result) {
            outputlog((this.callName + " "|| "")+"Function evaluation error.")
        }
        return result;

    } else { //if (expState < exp.length){}
        if (this.expState === 0) {
            var fnName = this.exp[0];
            if (typeof fnName == 'string' || fnName instanceof String) {
                this.callName=fnName;
            }
        } else if (this.expState === 1){
            if (this.exp[0].type === "SpecialForm"){
                // leave
                return this.exp[0].eval(this.exp,this.namespace,this.continuation);
            } else if (!(this.exp[0] instanceof Racket.Function)) {
                //error
                return this.continuation.eval([this.continuation, null],this.namespace,this.continuation);
            }
        }
        // Skip making sub SExp if already Racket type
        var nextExp = this.exp[this.expState];
        if (nextExp && nextExp.isRacketType) {
            var funcCall = new Racket.SExp(this.exp,this.namespace,this.continuation);
            funcCall.expState = this.expState+1;
            funcCall.callName = this.callName;
            return funcCall;
        }

        var innerCC = new Racket.Continuation(this.namespace,true);
        innerCC.origSExp = this;
        innerCC.continuation = Racket.SExp.continuation;

        var next = new Racket.SExp(this.exp[this.expState],this.namespace,innerCC);
        return next;

    }
    // function evaluation will return continuation.eval(), which produces a FunctionCall obj

};
Racket.SExp.continuation = function(r,n) {
    var origSExp = this.origSExp;
    var cExp = [];
    var expState = origSExp.expState;
    for (var i=0; i<origSExp.exp.length; ++i) {
        if (i != expState){
            cExp[i]=origSExp.exp[i];
        } else {
            cExp[i]=r;
        }
    }
    var funcCall = new Racket.SExp(cExp,origSExp.namespace,origSExp.continuation);
    funcCall.expState = expState+1;
    funcCall.callName = origSExp.callName;
    return funcCall;
};

/*
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

Racket.SExp.prototype = new Racket.Exp();
Racket.SpecialForm.prototype = new Racket.Function();
Racket.Continuation.prototype = new Racket.Function();
*/

function populateSpecialForms() {
    var keywords = {};
    var SpecialForms = {};
    SpecialForms.inherit = {};
    SpecialForms.inherit.endingCallback = function (self) {
        var result = self.resultCallback(self);
        return self.continuation.eval([self.continuation, result],self.namespace,self.continuation);
    };
    SpecialForms.inherit.eval = function(){
        //Assume this.exp is Array, otherwise, this wouldn't be called in the first place
        if (this.expState >= this.exp.length) {
            var result = this.endingCallback(this);
            return result;
        } 

        //if (this.expState < this.exp.length) {}
        /*if (this.expState>0){
            this.postEachEvalCallback(this,this.expState-1);
        }*/
        //this.preEachEvalCallback && this.preEachEvalCallback(this);

        // Skip making sub SExp if already Racket type
        var nextExp = this.exp[this.expState];
        if (nextExp && nextExp.isRacketType) {
            var funcCall = new Racket.SExp(this.exp,this.namespace,this.continuation);
            funcCall.eval = this.eval;
            funcCall.expState = this.expState+1;
            funcCall.callName = this.callName;
            funcCall.expData = this.expData;
            funcCall.endingCallback = this.endingCallback;
            funcCall.resultCallback = this.resultCallback;
            //funcCall.preEachEvalCallback = origSExp.preEachEvalCallback;
            funcCall.postEachEvalCallback = this.postEachEvalCallback;

            funcCall = funcCall.postEachEvalCallback(funcCall,this.expState) || funcCall;
            return funcCall;
        }

        var innerCC = new Racket.Continuation(this.namespace,true);
        innerCC.origSExp = this;
        innerCC.continuation = SpecialForms.inherit.continuation; // see below

        var curExp = new Racket.SExp(this.exp[this.expState], this.namespace, innerCC);
        return curExp;
        
    };
    SpecialForms.inherit.continuation = function(r,n) {
        var origSExp = this.origSExp;
        var cExp = [];
        var expState = origSExp.expState;
        for (var i=0; i< origSExp.exp.length; ++i) {
            if (i != expState){
                cExp[i]=origSExp.exp[i];
            } else {
                cExp[i]=r;
            }
        }
        var funcCall = new Racket.SExp(cExp,origSExp.namespace,origSExp.continuation);
        funcCall.eval = origSExp.eval;
        funcCall.expState = expState+1;
        funcCall.callName = origSExp.callName;
        funcCall.expData = origSExp.expData;
        funcCall.endingCallback = origSExp.endingCallback;
        funcCall.resultCallback = origSExp.resultCallback;
        //funcCall.preEachEvalCallback = origSExp.preEachEvalCallback;
        funcCall.postEachEvalCallback = origSExp.postEachEvalCallback;

        funcCall = funcCall.postEachEvalCallback(funcCall,origSExp.expState) || funcCall;

        return funcCall;
    };
    // Common callbacks that are cached
    SpecialForms.resultCallback = {};
    SpecialForms.resultCallback.returnVoid = function(self){ 
        return libraryNamespace["void"].obj;
    };
    SpecialForms.resultCallback.returnLastExp = function(self){
        return self.exp[self.exp.length-1];
    };
    SpecialForms.endingCallback = {};
    SpecialForms.endingCallback.conditionalBeginBody = function(self) {
        var body = self.expData.exp.slice(2);
        if (body.length===0) 
            return self.continuation.eval([self.continuation, libraryNamespace["void"].obj],self.namespace,self.continuation);
        var bodyexp = body.length>1?["begin"].concat(body):body[0];
        return new Racket.SExp(bodyexp,Namespace(self.namespace),self.continuation);
    };
    SpecialForms.postEachEvalCallback = {};
    SpecialForms.postEachEvalCallback.returnSelf = function(self,i) {
        return self;
    };
    SpecialForms.postEachEvalCallback.returnSelfOrFail = function(self,i){
        if (!self.exp[i]){
            outputlog(self.callName+" definitions evaluation failed.");
            self.exp = [null];
        }
        return self;
    };
    SpecialForms.postEachEvalCallback.returnSelfBegin = function(self,i) {
        if (i+1<self.exp.length && self.exp[i+1][0].substring(0,6) === "define") {
            var id = self.exp[i+1][1].constructor === Array? self.exp[i+1][1][1] : self.exp[i+1][1];
            self.namespace[id] = null;
        }
        return self;
    };
    keywords["true"] = new Racket.Bool(true);
    keywords["false"] = new Racket.Bool(false);
    keywords["empty"] = new Racket.Empty();
    keywords["null"] = keywords["empty"];
    keywords["quote"] = new Racket.SpecialForm();
    keywords["quote"].evalBody = function(syntaxStrTree, namespace, continuation) {
        var literal = syntaxStrTree[1];
        var result = keywords["quote"].process(literal);
        return continuation.eval([continuation, result],namespace,continuation);
    };
    keywords["quote"].process = function(literal) {
        // For reasoning, see function convertQuote(syntaxStrBlocks); down down down ... below

        if (literal.constructor === Array) {
            var processed = literal.map(keywords["quote"].process);
            var identity = new Racket.Continuation(globalNamespace);
            identity.continuation = Racket.Continuation.continuation.identity;
            var list = new Racket.SExp(["list"].concat(processed),globalNamespace,identity).evalFinal();
            return list;
        } else {
            var result = keywords["quote"].processAtom(literal);
            return result;
        }
    };
    keywords["quote"].processAtom = function(literal) {
        if (literal.isRacketType) {
            result = literal; // For now. I don't think this will ever be reached
        } else if (!isNaN(Number(literal))) {
            result = new Racket.Num(Number(literal));
        } else if (literal.charAt(0)==="\"" && literal.charAt(literal.length-1)==="\"") {
            result =  new Racket.Str(literal.substring(1,literal.length-1));
        } else if (literal.substring(0,2)==="\#\\" && literal.length>2) {
            result = new Racket.Char(literal.substring(2));
        } else if (literal.charAt(0)==="\#" && literal.length==2) {
            result = new Racket.Bool(literal==="\#t");
        } else if (literal.charAt(0) === "\|" && literal.charAt(literal.length-1) === "\|") {
            result = new Racket.Sym(literal.substring(1,literal.length-1));
        } else {
            result = new Racket.Sym(literal);
        }
        return result;
    };
    keywords["and"] = new Racket.SpecialForm();
    keywords["and"].evalBody = function(syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "and"
        // in the form of :
        // (and exp exp ... exp)

        var andSExp = new Racket.SExp(syntaxStrTree.slice(1),namespace,continuation);
        andSExp.expState = 0;
        andSExp.callName = "and";
        andSExp.eval = SpecialForms.inherit.eval; // defined above for optimization
        andSExp.resultCallback = SpecialForms.resultCallback.returnLastExp;
        andSExp.endingCallback = SpecialForms.inherit.endingCallback;
        andSExp.postEachEvalCallback = keywords["and"].postEachEvalCallback;
        return andSExp;
    };
    keywords["and"].postEachEvalCallback = function(self,i){
        if (self.exp[i] && self.exp[i].type === "Bool" && !(self.exp[i].value)){ // not null and false boolean
            return self.continuation.eval([self.continuation, new Racket.Bool(false)],self.namespace,self.continuation);
        }
        return self;
    };
    keywords["or"] = new Racket.SpecialForm();
    keywords["or"].evalBody = function(syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "or"
        // in the form of :
        // (or exp exp ... exp)

        var orSExp = new Racket.SExp(syntaxStrTree.slice(1),namespace,continuation);
        orSExp.expState = 0;
        orSExp.callName = "or";
        orSExp.eval = SpecialForms.inherit.eval; // defined above for optimization
        orSExp.resultCallback = SpecialForms.resultCallback.returnLastExp;
        orSExp.endingCallback = SpecialForms.inherit.endingCallback;
        orSExp.postEachEvalCallback = keywords["or"].postEachEvalCallback;
        return orSExp;
    };
    keywords["or"].postEachEvalCallback = function(self,i){
        if (self.exp[i] && self.exp[i].type === "Bool" && !(self.exp[i].value)){ // not null and false boolean
        } else { //true! short curcuit
            return self.continuation.eval([self.continuation, self.exp[i]],self.namespace,self.continuation);
        }
        return self;
    };
    keywords["define"] = new Racket.SpecialForm();
    keywords["define"].evalBody = function(syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "define"
        // in the form of :
        // (define id exp) for objects
        // (define (function-name id ...) ... final-exp) for functions
        // (define (((function-name a) b ) c) ... final exp) for curried functions

        var id;
        var body;

        if (syntaxStrTree[1].constructor === Array) { //function define
            // define has currying constructs in-place
            // We need to handle that
            // Streamlined currying support

            var argsArr = syntaxStrTree[1];
            var innerBody = syntaxStrTree.slice(2);

            while (argsArr[0].constructor === Array) { // Currying, since nested brackets (arrays)
                var innerIds = argsArr.slice(1);
                innerBody = [["lambda", innerIds].concat(innerBody)];
                argsArr = argsArr[0];
            }
            // No more nested brackets, so it has found deepest level
            id = argsArr[0];
            var lambdaIds = argsArr.slice(1);
            body = ["lambda", lambdaIds].concat(innerBody);
        } else { // object define
            id = syntaxStrTree[1];
            if (syntaxStrTree.length === 3)
                body = syntaxStrTree[2];
            else {
                outputlog("define received multiple expressions after identifier.");
                return null;
            }
        }

        var defineSExp = new Racket.SExp([body],namespace,continuation);
        defineSExp.expState = 0;
        defineSExp.callName = "define";
        defineSExp.expData = {};
        defineSExp.expData.id = id;
        defineSExp.eval = SpecialForms.inherit.eval; // defined above for optimization
        defineSExp.resultCallback = keywords["define"].resultCallback;
        defineSExp.endingCallback = SpecialForms.inherit.endingCallback;
        defineSExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelf;
        return defineSExp;
    };
    keywords["define"].resultCallback = function(self) {
        var result;
        var id = self.expData.id;
        if (self.exp[0]) {
            if (self.namespace["#upperNamespace"] === libraryNamespace && self.namespace["#moduleNamespaces"]["#moduleProvide"].hasOwnProperty(id)) {
                outputlog("Imported modules contain id: "+id+".");
                result = false;
            } else if ((!(self.namespace.hasOwnProperty(id))) || self.namespace[id] === null) {
                self.namespace[id] = self.exp[0];
                result = libraryNamespace["void"].obj; //for no errors
            } else {
                outputlog("Namespace already contains bound id: "+id+".");
                result = false;
            }
        } else {
            outputlog("define body evaluation failed.");
            result = false;
        }
        return result;
    };
    keywords["define-struct"] = new Racket.SpecialForm();
    keywords["define-struct"].evalBody = function(syntaxStrTree, namespace, continuation) {
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
                this.dict[propertyNames[i]] = data[i]; // directly attach since values must be evaluated already
            }

            this.toString = function () {
                var str = (this.definestruct?"\(make-":"\(")+this.type;
                for (var i=0; i<propertyCount; ++i) {
                    str +=" ";
                    str += this.dict[propertyNames[i]].toString();
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
        /*f (checkNamespace(typename+"?",namespace)){
            outputlog(typename+"?"+" already defined.");
            return null;
        }*/
        namespace[typename+"?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
        namespace[typename+"?"].eval = Racket.Lambda.libraryEval;
        namespace[typename+"?"].evalBody = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length !=2) {
                outputlog(typename+"?"+" requires exactly 1 argument.");
                return null;
            }
            return new Racket.Bool(syntaxStrTreeArg[1].type === typename);
        };
        // Make constructor method
        // i.e. if type is posn, this is (make-posn arg1 arg2)
        /*if (checkNamespace("make-"+typename,namespace)){
            outputlog("make-"+typename+" already defined.");
            return null;
        }*/
        namespace["make-"+typename] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace); //has propertyCount many arguments
        namespace["make-"+typename].eval = Racket.Lambda.libraryEval;
        namespace["make-"+typename].evalBody = function(syntaxStrTreeArg, namespace) {
            if (syntaxStrTreeArg.length != propertyCount+1) {
                outputlog("make-"+typename+" requires "+propertyCount+" argument(s).");
                return null;
            }
            return new Racket[typename](syntaxStrTreeArg.slice(1));
        };
        //Clone without make prefix
        /*if (checkNamespace(typename,namespace)){
            outputlog(typename+" already defined.");
            return null;
        }*/
        namespace[typename] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace); //has propertyCount many arguments
        namespace[typename].eval = Racket.Lambda.libraryEval;
        namespace[typename].evalBody = function(syntaxStrTreeArg, namespace) {
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
            /*if (checkNamespace(typename+"-"+id,namespace)){
                outputlog(typename+"-"+id+" already defined.");
                return null;
            }*/
            namespace[typename+"-"+id] = new Racket.Lambda(["obj"], new Racket.Exp(), namespace);
            namespace[typename+"-"+id].eval = Racket.Lambda.libraryEval;
            namespace[typename+"-"+id].id = propertyNames[i]; // needed to do this because this makes a deep copy
            namespace[typename+"-"+id].evalBody = function(syntaxStrTreeArg, namespace) {
                if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !==syntaxStrTree[1]) {
                    outputlog(typename+"-"+this.id+" requires 1 "+typename+" argument.");
                    return null;
                }
                var obj = syntaxStrTreeArg[1];
                return obj.dict[this.id];
            }
        }
        return continuation.eval([continuation, libraryNamespace["void"].obj], namespace, continuation); // for no errors
    };
    keywords["struct"] = new Racket.SpecialForm();
    keywords["struct"].evalBody = function(syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "struct"
        // in the form of :
        // (struct type-id (property1 property2 ...))

        //This is an alternate to define-struct
        return keywords["define-struct"].evalBody(syntaxStrTree, namespace, continuation);
    }
    keywords["local"] = new Racket.SpecialForm();
    keywords["local"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (local [(define ...) ...)] ... body)

        var localNamespace = Namespace(namespace);
        // make id's first
        for (var i=0; i< syntaxStrTree[1].length; ++i){
            var cur = syntaxStrTree[1][i];
            if (cur[0].substring(0,6)==="define") {
                localNamespace[(cur[1].constructor === Array?cur[1][0]:cur[1])]=null;
            }
        }

        // THEN bind
        var localSExp = new Racket.SExp(syntaxStrTree[1],localNamespace,continuation);
        localSExp.expState = 0;
        localSExp.callName = "local";
        localSExp.expData = {};
        localSExp.expData.exp = syntaxStrTree;
        localSExp.eval = SpecialForms.inherit.eval; // defined above for optimization
        // As the way I've written this, endingCallback will only be called at the end of definitions' evaluation
        localSExp.endingCallback = SpecialForms.endingCallback.conditionalBeginBody;
        // postEachEvalCallback is going to be called to evaluate all the defines
        localSExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelfOrFail;
        return localSExp;
    }
    keywords["letrec"] = new Racket.SpecialForm();
    keywords["letrec"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (letrec ([id exp] [id exp] ...) ... body)

        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && cur.constructor === Array && cur.length ===2 ; }, true)) {
            outputlog("letrec definitions not all id expression pairs");
            return null;
        }

        var letrecNamespace = Namespace(namespace);

        // make id's first
        for (var i=0; i< syntaxStrTree[1].length; ++i){
            var cur = syntaxStrTree[1][i];
            letrecNamespace[cur[0]]=null;
        }
        // THEN bind
        // see local special form for explanation

        var transformDefines = syntaxStrTree[1].map(function(cur,i,arr) { return ["define", cur[0], cur[1]] });
        var letrecSExp = new Racket.SExp(transformDefines,letrecNamespace,continuation);
        letrecSExp.expState = 0;
        letrecSExp.callName = "letrec";
        letrecSExp.expData = {};
        letrecSExp.expData.exp = syntaxStrTree;
        letrecSExp.eval = SpecialForms.inherit.eval;
        letrecSExp.endingCallback = SpecialForms.endingCallback.conditionalBeginBody;
        letrecSExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelfOrFail;
        return letrecSExp;
    }
    keywords["let"] = new Racket.SpecialForm();
    keywords["let"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (let ([id exp] [id exp] ...) ... body)


        // Named let -> morph into letrec
        if (!(syntaxStrTree[1].constructor === Array)) {
            var name = syntaxStrTree[1];
            var idArr = [];
            var initArr = [];
            for (var i=0; i< syntaxStrTree[2].length; ++i) {
                idArr.push(syntaxStrTree[2][i][0]);
                initArr.push(syntaxStrTree[2][i][1]);
            }

            var body = syntaxStrTree[3];
            var morphedLetrec = ["letrec",[[name, ["lambda", idArr, body]]], [name].concat(initArr)];
            return keywords["letrec"].evalBody(morphedLetrec,namespace, continuation);
        }

        // Regular let
        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && cur.constructor === Array && cur.length ===2 ; }, true)) {
            outputlog("let definitions not all id expression pairs");
            return null;
        }

        // evaluate all
        var justExps = syntaxStrTree[1].map(function(cur,i,arr) { return cur[1] });
        var letSExp = new Racket.SExp(justExps,namespace,continuation);
        letSExp.expState = 0;
        letSExp.callName = "let";
        letSExp.expData = {};
        letSExp.expData.ids = syntaxStrTree[1].map(function(cur,i,arr) { return cur[0] });
        letSExp.expData.exp = syntaxStrTree;
        letSExp.eval = SpecialForms.inherit.eval;
        letSExp.endingCallback = function(self) {
            // then bind all
            var letNamespace = Namespace(self.namespace);
            for (var i=0; i< self.exp.length; ++i) {
                letNamespace[self.expData.ids[i]] = self.exp[i];
            } 
            var body = self.expData.exp.slice(2);
            if (body.length===0) 
                return self.continuation.eval([self.continuation, libraryNamespace["void"].obj],self.namespace,self.continuation);
        
            var bodyexp = body.length>1?["begin"].concat(body):body[0];
            return new Racket.SExp(bodyexp,letNamespace,self.continuation);
        };
        letSExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelfOrFail;
        return letSExp;
    }
    keywords["let*"] = new Racket.SpecialForm();
    keywords["let*"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (let* ([id exp] [id exp] ...) ... body)

        if (!syntaxStrTree[1].reduce(function(prev,cur,i,arr) { return prev && cur.constructor === Array && cur.length ===2 ; }, true)) {
            outputlog("let* definitions not all id expression pairs");
            return null;
        }

        var let_Namespace = Namespace(namespace);

        var justExps = syntaxStrTree[1].map(function(cur,i,arr) { return cur[1] });
        var let_SExp = new Racket.SExp(justExps,let_Namespace,continuation);
        let_SExp.expState = 0;
        let_SExp.callName = "let*";
        let_SExp.expData = {};
        let_SExp.expData.exp = syntaxStrTree;
        let_SExp.eval = SpecialForms.inherit.eval;
        let_SExp.endingCallback = SpecialForms.endingCallback.conditionalBeginBody;
        let_SExp.postEachEvalCallback = function(self,i){
            if (!self.exp[i]){
                outputlog("let* definitions evaluation failed.");
                self.exp = [null];
            }
            // evaluate and bind as soon as each is available
            self.namespace[self.expData.exp[1][i][0]] = self.exp[i];
            // later bindings shadow earlier bindings
            self.namespace = Namespace(self.namespace);
            return self;
        };
        return let_SExp;
    }
    keywords["lambda"] = new Racket.SpecialForm();
    keywords["lambda"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "lambda"
        // in the form of :
        // (lambda (id ...) ... final-exp)

        var ids = syntaxStrTree[1];
        var body = syntaxStrTree.slice(2);
        var lambda = new Racket.Lambda(ids, body, namespace);
        return continuation.eval([continuation, lambda], namespace, continuation); 
    }
    keywords["λ"] = keywords["lambda"];
    keywords["case-lambda"] = new Racket.SpecialForm();
    keywords["case-lambda"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "case-lambda"
        // in the form of :
        // (case-lambda [(id ...) ... final-exp)] ...)

        var caseBody = syntaxStrTree.slice(1);
        var lambda = new Racket.CaseLambda(caseBody, namespace);
        return continuation.eval([continuation, lambda], namespace, continuation); 
    }
    keywords["set!"] = new Racket.SpecialForm();
    keywords["set!"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "set!"
        // in the form of :
        // (set! id exp)

        var id = syntaxStrTree[1];
        var body = syntaxStrTree[2];
        if (parseLookupType(id,namespace)) { //if namespace has id, whether it is through inheritance, modules or not
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

                var setSExp = new Racket.SExp([body],namespace,continuation);
                setSExp.expState = 0;
                setSExp.callName = "set!";
                setSExp.expData = {};
                setSExp.expData.id = id;
                setSExp.expData.setNamespace = setNamespace;
                setSExp.eval = SpecialForms.inherit.eval;
                setSExp.endingCallback = SpecialForms.inherit.endingCallback;
                setSExp.resultCallback = function(self){
                    this.expData.setNamespace[this.expData.id] = this.exp[0];
                    return libraryNamespace["void"].obj; //no errors
                }
                setSExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelf;
                return setSExp;
            }
        } else { //should not have called set! at all
            outputlog("id "+id+" not found, cannot be set!");
            return null;
        }
    }
    keywords["cond"] = new Racket.SpecialForm();
    keywords["cond"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "cond"
        // in the form of :
        // (cond (bool exp) (bool exp) ... (else exp))

        if (syntaxStrTree.constructor !== Array) {
            outputlog("cond conditions are invalid.");
            return null;
        }

        var predicateExps = [];
        for (var i=1; i < syntaxStrTree.length; ++i) {
            predicateExps[i-1] = syntaxStrTree[i][0];
            if (predicateExps[i-1] === "else") {
                predicateExps[i-1] = new Racket.Bool(true);
            }
        }

        var condSExp = new Racket.SExp(predicateExps,namespace,continuation);
        condSExp.expState = 0;
        condSExp.callName = "cond";
        condSExp.expData = {};
        condSExp.expData.exp = syntaxStrTree;
        condSExp.eval = SpecialForms.inherit.eval;
        condSExp.endingCallback = SpecialForms.inherit.endingCallback;
        condSExp.resultCallback = SpecialForms.resultCallback.returnVoid;
        condSExp.postEachEvalCallback = keywords["cond"].postEachEvalCallback;
        return condSExp;
    }
    keywords["cond"].postEachEvalCallback = function(self,i){
        var predicate = self.exp[i];
        if (predicate && !(predicate.type === "Bool" && !predicate.value)) { //if not null and not false Racket.Bool
            var branch = self.expData.exp[1+i].slice(1);
            var nmsp = self.namespace;
            if (branch.length ===0) {
                branch = libraryNamespace["void"].obj;
            } else if (branch.length ===1) {
                branch = branch[0];
            } else { //handles when to add an implcit begin, but only when necessary
                branch = ["begin"].concat(branch);
                nmsp = Namespace(nmsp,true); //gotta make it a new namespace
            }
            return new Racket.SExp(branch,nmsp,self.continuation);
        } //else {} //do nothing, go to next predicate
        return self;
    };
    keywords["if"] = new Racket.SpecialForm();
    keywords["if"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "if"
        // in the form of :
        // (if predicate? true-exp false-exp))
    
        if (syntaxStrTree.constructor !== Array || syntaxStrTree.length !==4) {
            outputlog("if is invalid or does not have 3 arguments.");
            return null;
        }

        var ifSExp = new Racket.SExp([syntaxStrTree[1]],namespace,continuation);
        ifSExp.expState = 0;
        ifSExp.callName = "if";
        ifSExp.expData = {};
        ifSExp.expData.exp = syntaxStrTree;
        ifSExp.eval = SpecialForms.inherit.eval;
        ifSExp.endingCallback = SpecialForms.inherit.endingCallback;
        ifSExp.resultCallback = SpecialForms.resultCallback.returnVoid;
        ifSExp.postEachEvalCallback = keywords["if"].postEachEvalCallback;
        return ifSExp;
    }
    keywords["if"].postEachEvalCallback = function(self,i){
        var predicate = self.exp[0];
        if (!predicate) {
            outputlog("if predicate evaluation gave error.")
            return null;
        }
        var ifExp = self.expData.exp;
        if (!(predicate.type==="Bool" && !predicate.value)) { //if not null and not false Racket.Bool
            return new Racket.SExp(ifExp[2],self.namespace,self.continuation);
        } else {
            return new Racket.SExp(ifExp[3],self.namespace,self.continuation);
        } 
        return self;
    };
    keywords["when"] = new Racket.SpecialForm();
    keywords["when"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "when"
        // in the form of :
        // (when predicate? ... true-final-exp))

        if (syntaxStrTree.constructor !== Array || syntaxStrTree.length < 3) {
            outputlog("when is invalid or does not have at least 3 arguments.");
            return null;
        }

        var whenSExp = new Racket.SExp([syntaxStrTree[1]],namespace,continuation);
        whenSExp.expState = 0;
        whenSExp.callName = "when";
        whenSExp.expData = {};
        whenSExp.expData.exp = syntaxStrTree;
        whenSExp.eval = SpecialForms.inherit.eval;
        whenSExp.endingCallback = SpecialForms.endingCallback.conditionalBeginBody;
        whenSExp.postEachEvalCallback = function(self,i){
            var predicate = self.exp[0];
            if (!predicate) {
                outputlog("when predicate evaluation gave error.");
                return null;
            }
            if (predicate.type==="Bool" && !predicate.value) {
                return self.continuation.eval([self.continuation, libraryNamespace["void"].obj],self.namespace,self.continuation);
            }
            return self;
        };
        return whenSExp;

    }
    keywords["unless"] = new Racket.SpecialForm();
    keywords["unless"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "unless"
        // in the form of :
        // (unless predicate? ... false-final-exp))
        
        if (syntaxStrTree.constructor !== Array || syntaxStrTree.length < 3) {
            outputlog("unless is invalid or does not have at least 3 arguments.");
            return null;
        }

        var unlessSExp = new Racket.SExp([syntaxStrTree[1]],namespace,continuation);
        unlessSExp.expState = 0;
        unlessSExp.callName = "unless";
        unlessSExp.expData = {};
        unlessSExp.expData.exp = syntaxStrTree;
        unlessSExp.eval = SpecialForms.inherit.eval;
        unlessSExp.endingCallback = SpecialForms.endingCallback.conditionalBeginBody;
        unlessSExp.postEachEvalCallback = function(self,i){
            var predicate = self.exp[0];
            if (!predicate) {
                outputlog("when predicate evaluation gave error.")
                return null;
            }
            if (!(predicate.type==="Bool" && !predicate.value)) {
                return self.continuation.eval([self.continuation, libraryNamespace["void"].obj],self.namespace,self.continuation);
            }
            return self;
        };
        return unlessSExp;
    }
    keywords["begin"] = new Racket.SpecialForm();
    keywords["begin"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "begin"
        // in the form of :
        // (begin exp ... final-exp)

        var beginNamespace = (namespace["#isTopLevel"]?namespace:Namespace(namespace, true));
        var exp = [];
        for (var i=1; i<syntaxStrTree.length; ++i) {
            exp[i-1] = syntaxStrTree[i];
        }
        var beginSExp = new Racket.SExp(exp,beginNamespace,continuation);
        beginSExp.expState = 0;
        beginSExp.callName = "begin";
        beginSExp.eval = SpecialForms.inherit.eval;
        beginSExp.resultCallback = SpecialForms.resultCallback.returnLastExp;
        beginSExp.endingCallback = SpecialForms.inherit.endingCallback;
        beginSExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelfBegin;
        return beginSExp;
    }
    keywords["begin0"] = new Racket.SpecialForm();
    keywords["begin0"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "begin"
        // in the form of :
        // (begin first-exp ... exp)

        var begin0Namespace = (namespace["#isTopLevel"]?namespace:Namespace(namespace, true));
        var exp = [];
        for (var i=1; i<syntaxStrTree.length; ++i) {
            exp[i-1] = syntaxStrTree[i];
        }
        var begin0SExp = new Racket.SExp(exp,begin0Namespace,continuation);
        begin0SExp.expState = 0;
        begin0SExp.callName = "begin";
        begin0SExp.eval = SpecialForms.inherit.eval;
        begin0SExp.resultCallback = function(self){
            return self.exp[0];
        };
        begin0SExp.endingCallback = SpecialForms.inherit.endingCallback;
        begin0SExp.postEachEvalCallback = SpecialForms.postEachEvalCallback.returnSelf;
        return begin0SExp;
    }
    keywords["require"] = new Racket.SpecialForm();
    keywords["require"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "require"
        // in the form of :
        // (require string ...)

        var requireSExp = new Racket.SExp(syntaxStrTree.slice(1),namespace,continuation);
        requireSExp.expState = 0;
        requireSExp.callName = "require";
        requireSExp.eval = SpecialForms.inherit.eval;
        requireSExp.resultCallback = SpecialForms.resultCallback.returnVoid;
        requireSExp.endingCallback = SpecialForms.inherit.endingCallback;

        // This evaluates the listed modules (which should be imported)
        requireSExp.postEachEvalCallback = function(self,i){
            var fileNameStr = self.exp[i];
            //parse into Racket.String, this guarantees that the var is a string
            if (!fileNameStr) {
                outputlog("require received argument(s) that were not all type String.");
                return null;
            }
            var fileName = fileNameStr.value; //get String's value, which is actual fileName

            if (!uploadedModulesParsed[fileName]) {
                outputlog("Module "+ fileName +" not found.");
                return null;
            }


            //if above worked, this is not null

            //Make a separate namespace for each module, evaluate, and put this inside the
            //  give namespace under #moduleNamespaces
            var moduleNamespace = Namespace(libraryNamespace, true);

            if (!moduleNamespace["#thisModuleProvide"]) {
                moduleNamespace["#thisModuleProvide"] = {};
            }

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
                provideAll = provideAll && parseLookupType(id,moduleNamespace);
                if (!provideAll){
                    outputlog("Not all listed provided id's are provided.")
                    moduleNamespace = null;
                    break;
                }
            }
            var namespace = self.namespace;
            if (i === 0){ //first module to be imported

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

            return self;
        };
        return requireSExp;
    }
    keywords["provide"] = new Racket.SpecialForm();
    keywords["provide"].evalBody = function (syntaxStrTree, namespace, continuation) {
        //assert syntaxStrTree[0] === "provide"
        // in the form of :
        // (provide id ...)
        if (!namespace["#thisModuleProvide"]) {
            namespace["#thisModuleProvide"] = {};
        }

        for (var i=1; i< syntaxStrTree.length; ++i){
            if (typeof syntaxStrTree[i] == 'string' || syntaxStrTree[i] instanceof String){ //is id then
                namespace["#thisModuleProvide"][syntaxStrTree[i]] = true;
            } else {
                outputlog("provide received argument(s) that were not id's.")
                return null;
            }
        }
        return continuation.eval([continuation, libraryNamespace["void"].obj], namespace, continuation); //so it was successful
    }
    return keywords;
};

var specialForms = populateSpecialForms();

function populateStandardFunctions(namespace) {
    // All functions' eval calls' namespace variable is a variable that is usually not used.
    //   However, do not depend on that.
    //   This is because most functions here do not call on other functions as a result
    //   It is there so that function calls look the same as special form/keyword calls

    // However, since some functions like (apply) need a context in which function application works,
    //   namespace is used to maintain environment
    namespace["consolelog"] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace);
    namespace["consolelog"].evalBody = function(syntaxStrTreeArg, namespace) {
        console.log.apply(console,syntaxStrTreeArg);
        console.log.apply(console,namespace);
        return namespace["void"].obj;
    }
    namespace["make-base-namespace"] = new Racket.Lambda([], new Racket.Exp(), namespace);
    namespace["make-base-namespace"].evalBody = function(syntaxStrTreeArg, namespace) {
        var nmsp = Namespace(libraryNamespace,true);
        nmsp["#moduleNamespaces"] = {}; // Make containers only in globalNamespace
        nmsp["#moduleNamespaces"]["#moduleProvide"] = {};
        return nmsp;
    }
    namespace["eval"] = new Racket.Lambda(["x",".","nmsp"], new Racket.Exp(), namespace);
    namespace["eval"].evalBody = function(syntaxStrTreeArg, namespace) {
        var literal = syntaxStrTreeArg[1];
        var nmsp = syntaxStrTreeArg[2] || namespace; // Racket.Namespace has nothing.
        // Namespace should be provided by make-base-namespace, otherwise default to current namespace
        // Can be dangerous!

        var temp = listAbbrev.checked;
        listAbbrev.checked=true;
        var str = literal.toString();
        listAbbrev.checked = temp;

        var rawCode = str.substring(1); // removes ' in front
        var tokenizedInput = tokenize(rawCode);
        var syntaxStrTreeBlocks = parseStr(tokenizedInput);
        if (!syntaxStrTreeBlocks) {
            //error occurred
            outputlog("Error occurred parsing or tokenizing code.");
            return null;
        }
        syntaxStrTreeBlocks = convertQuote(syntaxStrTreeBlocks);
        if (syntaxStrTreeBlocks[0] === "#lang") {
            syntaxStrTreeBlocks = syntaxStrTreeBlocks.slice(2);
        }
        var exp = syntaxStrTreeBlocks[0];

        var identity = new Racket.Continuation(globalNamespace);
        identity.continuation = Racket.Continuation.continuation.identity;

        var result = new Racket.SExp(exp,nmsp,identity).evalFinal();
        return result;

    }
    namespace["void"] = new Racket.Lambda([".","rst"], new Racket.Exp(), namespace);
    namespace["void"].obj = new Racket.Void();
    namespace["void"].evalBody = function(syntaxStrTreeArg, namespace) {
        return namespace["void"].obj;
    }
    namespace["void?"] = new Racket.Lambda(["v"], new Racket.Exp(), namespace);
    namespace["void?"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Void");
    }
    namespace["symbol?"] = new Racket.Lambda(["v"], new Racket.Exp(), namespace);
    namespace["symbol?"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Sym");
    }
    namespace["string->symbol"] = new Racket.Lambda(["v"], new Racket.Exp(), namespace);
    namespace["string->symbol"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Str") {
            outputlog("string->symbol requires 1 Str argument.");
            return null;
        }
        return new Racket.Sym(syntaxStrTreeArg[1].value);
    }
    namespace["symbol->string"] = new Racket.Lambda(["v"], new Racket.Exp(), namespace);
    namespace["symbol->string"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Sym") {
            outputlog("symbol->string requires 1 Sym argument.");
            return null;
        }
        return new Racket.Str(syntaxStrTreeArg[1].value);
    }
    namespace["number?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["number?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Num") {
            outputlog("number? requires 1 Num argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Num");
    }
    namespace["boolean?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["boolean?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Bool") {
            outputlog("boolean? requires 1 Bool argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Bool");
    }
    namespace["false?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["false?"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Bool" && !syntaxStrTreeArg[1].value);
    }
    namespace["string?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["string?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Str") {
            outputlog("string? requires 1 Str argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Str");
    }
    namespace["char?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["char?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=2 || syntaxStrTreeArg[1].type !="Char") {
            outputlog("char? requires 1 Char argument.");
            return null;
        }
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Char");
    }
    namespace["eqv?"] = new Racket.Lambda(["a","b"], new Racket.Exp(), namespace);
    namespace["eqv?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=3) {
            outputlog("eqv? requires 2 arguments.");
            return null;
        }

        if (syntaxStrTreeArg[1].type !== syntaxStrTreeArg[2].type) 
            return new Racket.Bool(false);
        else if (syntaxStrTreeArg[1] === syntaxStrTreeArg[2])
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].value && syntaxStrTreeArg[1].value === syntaxStrTreeArg[2].value)
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Num" && syntaxStrTreeArg[1].value === syntaxStrTreeArg[1].value) 
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Str" && syntaxStrTreeArg[1].value === syntaxStrTreeArg[1].value) 
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Sym" && syntaxStrTreeArg[1].value === syntaxStrTreeArg[1].value) 
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Bool" && syntaxStrTreeArg[1].value === syntaxStrTreeArg[1].value) 
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Char" && syntaxStrTreeArg[1].value === syntaxStrTreeArg[1].value) 
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Empty") 
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].type === "Void") 
            return new Racket.Bool(true);

        return new Racket.Bool(false);
    }
    namespace["eq?"] = new Racket.Lambda(["a","b"], new Racket.Exp(), namespace);
    namespace["eq?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !=3) {
            outputlog("eq? requires 2 arguments.");
            return null;
        }

        if (syntaxStrTreeArg[1].type !== syntaxStrTreeArg[2].type) 
            return new Racket.Bool(false);
        else if (syntaxStrTreeArg[1] === syntaxStrTreeArg[2])
            return new Racket.Bool(true);
        else if (syntaxStrTreeArg[1].value && syntaxStrTreeArg[1].value === syntaxStrTreeArg[2].value)
            return new Racket.Bool(true);

        return new Racket.Bool(false);
    }
    namespace["equal?"] = new Racket.Lambda(["x","y"], new Racket.Exp(), namespace);
    namespace["equal?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("equal? requires 2 arguments.");
            return null;
        }

        var identity = new Racket.Continuation(globalNamespace);
        identity.continuation = Racket.Continuation.continuation.identity;
        var equality = new Racket.SExp(["eqv?",
                                        syntaxStrTreeArg[1],
                                        syntaxStrTreeArg[2]],
                                        globalNamespace,identity).evalFinal();
            
        if (equality.value) 
            return new Racket.Bool(true);
        if (syntaxStrTreeArg[1].type === syntaxStrTreeArg[2].type && 
            syntaxStrTreeArg[1].isRacketList && 
            syntaxStrTreeArg[1].toString() === syntaxStrTreeArg[2].toString())
            return new Racket.Bool(true);
        return new Racket.Bool(false);
    }
    namespace["expt"] = new Racket.Lambda(["x","y"], new Racket.Exp(), namespace);
    namespace["expt"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.pow(syntaxStrTreeArg[1], syntaxStrTreeArg[2]));
    }
    namespace["exp"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["exp"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.pow(Math.E, syntaxStrTreeArg[1].value));
    }
    namespace["log"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["log"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.log(syntaxStrTreeArg[1].value));
    }
    namespace["sin"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["sin"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.sin(syntaxStrTreeArg[1].value));
    }
    namespace["cos"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["cos"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.cos(syntaxStrTreeArg[1].value));
    }
    namespace["tan"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["tan"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.tan(syntaxStrTreeArg[1].value));
    }
    namespace["asin"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["asin"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.asin(syntaxStrTreeArg[1].value));
    }
    namespace["acos"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["acos"].evalBody = function(syntaxStrTreeArg, namespace) {
        return new Racket.Num(Math.acos(syntaxStrTreeArg[1].value));
    }
    namespace["atan"] = new Racket.Lambda(["x","y"], new Racket.Exp(), namespace); // 1 or 2 arguments
    namespace["atan"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length ===2)
            return new Racket.Num(Math.atan(syntaxStrTreeArg[1].value));
        else // if(syntaxStrTreeArg.length ===3)
            return new Racket.Num(Math.atan2(syntaxStrTreeArg[1].value,syntaxStrTreeArg[2].value));
    }
    namespace["+"] = new Racket.Lambda([".","x"], new Racket.Exp(), namespace);
    namespace["+"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["-"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["*"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["/"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["="].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["<"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["<="].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace[">"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace[">="].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["quotient"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("quotient requires exactly 2 arguments.");
            return null;
        }
        var result = syntaxStrTreeArg[1].value/syntaxStrTreeArg[2].value;
        return new Racket.Num(result>0? Math.floor(result): Math.ceil(result));
    }
    namespace["remainder"] = new Racket.Lambda(["num","mod"], new Racket.Exp(), namespace);
    namespace["remainder"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 3) {
            outputlog("remainder requires exactly 2 arguments.");
            return null;
        }
        return new Racket.Num(syntaxStrTreeArg[1].value % syntaxStrTreeArg[2].value);
    }
    namespace["modulo"] = new Racket.Lambda(["num","mod"], new Racket.Exp(), namespace);
    namespace["modulo"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["abs"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("abs requires exactly 1 argument.");
            return null;
        }
        return new Racket.Num(Math.abs(syntaxStrTreeArg[1].value));
    }
    namespace["floor"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["floor"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("floor requires exactly 1 argument.");
            return null;
        }
        return new Racket.Num(Math.floor(syntaxStrTreeArg[1].value));
    }
    namespace["ceiling"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["ceiling"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2) {
            outputlog("ceiling requires exactly 1 argument.");
            return null;
        }
        return new Racket.Num(Math.ceil(syntaxStrTreeArg[1].value));
    }
    namespace["string=?"] = new Racket.Lambda(["str1","str2",".","rst"], new Racket.Exp(), namespace);
    namespace["string=?"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string<=?"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string<?"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string>?"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string>=?"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["substring"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string-ref"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length != 3 || syntaxStrTreeArg[1].type !== "Str" || syntaxStrTreeArg[2].type !== "Num") {
            outputlog("string-ref requires a Str and Num argument.");
            return null;
        }
        var chr = syntaxStrTreeArg[1].value.charAt(syntaxStrTreeArg[2].value);
        return new Racket.Char(chr);
    }
    namespace["string-length"] = new Racket.Lambda(["str"], new Racket.Exp(), namespace);
    namespace["string-length"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length <= 2 || syntaxStrTreeArg[1].type !== "Str") {
            outputlog("string-length requires at least 2 arguments.");
            return null;
        }
        return new Racket.Num(syntaxStrTreeArg[1].value.length);
    }
    namespace["string-append"] = new Racket.Lambda([".","rststr"], new Racket.Exp(), namespace);
    namespace["string-append"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["string->list"].returnSExp = true;
    namespace["string->list"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
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
        return new Racket.SExp(chrlist.slice(0,chrlist.length-shift),namespace, continuation);
    }
    namespace["print"] = new Racket.Lambda(["obj"], new Racket.Exp(), namespace);
    namespace["print"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length !== 2 || !syntaxStrTreeArg[1].isRacketType) {
            outputlog("print requires 1 argument.");
            return null;
        }
        outputfield.value+=syntaxStrTreeArg[1].toString();
        return namespace["void"].obj;
    }
    namespace["newline"] = new Racket.Lambda([], new Racket.Exp(), namespace);
    namespace["newline"].evalBody = function(syntaxStrTreeArg, namespace) {
        outputfield.value+="\n";
        return namespace["void"].obj;
    }
    namespace["write"] = namespace["print"]; // For now until I actually write lists as '() ...
    namespace["display"] = namespace["print"];
    namespace["fprintf"] = new Racket.Lambda(["out","form","v",".","rst"], new Racket.Exp(), namespace);
    namespace["fprintf"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length < 4 || syntaxStrTreeArg[2].type != "Str") {
            outputlog("fprintf did not receive the right arguments.");
            return null;
        }
        var currentObject = 3;
        var formatStr = syntaxStrTreeArg[2].value;

        // defaults to console box for #<output-port>
        var out = outputfield;
        var error = false;
        var identity = new Racket.Continuation(namespace);
        identity.continuation = Racket.Continuation.continuation.identity;
        for (var i = 0; i< formatStr.length; ++i) {
            if (formatStr.charAt(i) === "\~") {
                ++i;

                switch (formatStr.charAt(i)) {
                    case "n":
                    case "\%":
                        out.value +="\n";
                        break;
                    case "a": //use (display)
                    case "A":
                        error = ! (new Racket.SExp(["display",syntaxStrTreeArg[currentObject]],namespace,identity).evalFinal());
                        ++currentObject;
                        break;
                    case "s": //use (write)
                    case "S":
                        error = ! (new Racket.SExp(["write",syntaxStrTreeArg[currentObject]],namespace,identity).evalFinal());
                        ++currentObject;
                        break;
                    case "v": //use (print)
                    case "V":
                        error = ! (new Racket.SExp(["print",syntaxStrTreeArg[currentObject]],namespace,identity).evalFinal());
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
            return namespace["void"].obj; //no errors
        }
    }
    namespace["printf"] = new Racket.Lambda(["form","v",".","rst"], new Racket.Exp(), namespace);
    namespace["printf"].returnSExp = true;
    namespace["printf"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
        if (syntaxStrTreeArg.length < 3) {
            outputlog("printf did not receive the right arguments.");
            return null;
        }
        // Empty is a placeholder for when i implement #<output-port>
        return new Racket.SExp(["fprintf",specialForms["empty"],syntaxStrTreeArg[1]].concat(syntaxStrTreeArg.slice(2)),namespace,continuation);
    }
    namespace["char=?"] = new Racket.Lambda(["chr1","chr2",".","rst"], new Racket.Exp(), namespace);
    namespace["char=?"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["char->integer"].evalBody = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type==="Char") {
            return new Racket.Num(syntaxStrTreeArg[1].value.charCodeAt(0));

        } else {
            outputlog("char->integer requires 1 Char argument.");
            return null;
        }
    }
    namespace["integer->char"] = new Racket.Lambda(["int"], new Racket.Exp(), namespace);
    namespace["integer->char"].evalBody = function(syntaxStrTreeArg, namespace) {
        var equal = true;
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type==="Num") {
            return new Racket.Char(String.fromCharCode(syntaxStrTreeArg[1].value));
        } else {
            outputlog("integer->char requires 1 Num argument.");
            return null;
        }
    }
    namespace["not"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["not"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length == 2) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Bool" && !syntaxStrTreeArg[1].value);
        } else {
            outputlog("not did not receive 1 argument.");
            return null;
        }
    }
    namespace["random"] = new Racket.Lambda(["max"], new Racket.Exp(), namespace);
    namespace["random"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["cons"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 3) {
            return new Racket.Cell(syntaxStrTreeArg[1], syntaxStrTreeArg[2]);
        } else {
            outputlog("cons was not called with 2 parameters.");
            return null;
        }
    }
    namespace["first"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["first"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.Cell) {
            return syntaxStrTreeArg[1].left;
        } else {
            outputlog("first was not called with 1 cons cell.");
            return null;
        }
    }
    namespace["rest"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["rest"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.Cell) {
            return syntaxStrTreeArg[1].right;
        } else {
            outputlog("rest was not called with 1 cons cell.");
            return null;
        }
    }
    namespace["empty?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["empty?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Empty");
        } else {
            outputlog("empty? was not called with 1 argument.");
            return null;
        }
    }
    namespace["cons?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["cons?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2) {
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Cell");
        } else {
            outputlog("cons? was not called with 1 argument.");
            return null;
        }
    }
    namespace["pair?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["pair?"].evalBody = function(syntaxStrTreeArg, namespace) {
      if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].isRacketList) {
        return new Racket.Bool(syntaxStrTreeArg[1].type === "Cell");
      } else {
        outputlog("pair? was not called with 1 list.");
        return null;
      }
    }
    namespace["list?"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["list?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].isRacketType) {
            if (syntaxStrTreeArg[1].type === "Empty")
                return new Racket.Bool(true);
            else if (!(syntaxStrTreeArg[1] instanceof Racket.Cell))
                return new Racket.Bool(false);
            else
                return this.evalBody(["list?", syntaxStrTreeArg[1].right], namespace);
        } else {
            outputlog("list? was not called with an expression.");
            return null;
        }
    }
    namespace["list"] = new Racket.Lambda([".","lst"], new Racket.Exp(), namespace);
    namespace["list"].evalBody = function(syntaxStrTreeArg, namespace) {
        var cons = specialForms["empty"];
        for (var i=syntaxStrTreeArg.length-1; i >= 1; --i) {
            var cell = new Racket.Cell();
            cell.right = cons;
            cell.left = syntaxStrTreeArg[i];
            cons = cell;
        }
        return cons;
    }
    namespace["length"] = new Racket.Lambda(["x"], new Racket.Exp(), namespace);
    namespace["length"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].isRacketList) {
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
    namespace["identity"].evalBody = function(syntaxStrTreeArg, namespace) {
        return syntaxStrTreeArg[1];
    }
    namespace["apply"] = new Racket.Lambda(["fn","list-arg"], new Racket.Exp(), namespace);
    namespace["apply"].returnSExp=true;
    namespace["apply"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
        var identity = new Racket.Continuation(namespace);
        identity.continuation = Racket.Continuation.continuation.identity;
        if (syntaxStrTreeArg.length === 3 && new Racket.SExp(["list?", syntaxStrTreeArg[2]],namespace,identity).evalFinal().value === true) {
            var arr;
            var len;
            if (syntaxStrTreeArg[2].isRacketList) {
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
            return new Racket.SExp(arr, namespace, continuation);
        } else {
            outputlog("apply was not called with 2 arguments.");
            return null;
        }
    }
    namespace["call-with-current-continuation"] = new Racket.Lambda(["fn"], new Racket.Exp(), namespace);
    namespace["call-with-current-continuation"].returnSExp = true;
    namespace["call-with-current-continuation"].evalBody = function(syntaxStrTreeArg, namespace,continuation) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1] instanceof Racket.Function) {
            //var new Racket.Lambda(["result"]], new Racket.Exp(), namespace);
            return new Racket.SExp([syntaxStrTreeArg[1],continuation],namespace,continuation);
        } else  {
            outputlog("call-with-current-continuation was not called with 1 argument.");
            return null;
        }
    }
    namespace["call/cc"] = namespace["call-with-current-continuation"];
    namespace["vector?"] = new Racket.Lambda(["vec"], new Racket.Exp(), namespace);
    namespace["vector?"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2){
            return new Racket.Bool(syntaxStrTreeArg[1].type === "Vector");
        } else {
            return null;
        }
    }
    namespace["vector"] = new Racket.Lambda([".","list-arg"], new Racket.Exp(), namespace);
    namespace["vector"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length >= 1){
            return new Racket.Vector(syntaxStrTreeArg.slice(1), syntaxStrTreeArg.length-1);
        } else {
            return null;
        }
    }
    namespace["make-vector"] = new Racket.Lambda(["size",".","init"], new Racket.Exp(), namespace);
    namespace["make-vector"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["vector-length"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type === "Vector"){
            return new Racket.Num(syntaxStrTreeArg[1].length);
        } else {
            outputlog("vector-length was not called with 1 Vector.");
            return null;
        }
    }
    namespace["vector-ref"] = new Racket.Lambda(["vec","pos"], new Racket.Exp(), namespace);
    namespace["vector-ref"].evalBody = function(syntaxStrTreeArg, namespace) {
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
    namespace["vector->list"].returnSExp = true;
    namespace["vector->list"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].type === "Vector"){
            var vec = syntaxStrTreeArg[1];

            return new Racket.SExp(["list"].concat(vec.arr),namespace,continuation);
        } else {
            outputlog("vector->list was not called with 1 Vector.");
            return null;
        }
    }
    namespace["vector-set!"] = new Racket.Lambda(["vec","idx","val"], new Racket.Exp(), namespace);
    namespace["vector-set!"].evalBody = function(syntaxStrTreeArg, namespace) {
        if (syntaxStrTreeArg.length === 4 && syntaxStrTreeArg[1].type === "Vector" && syntaxStrTreeArg[2].type === "Num" && syntaxStrTreeArg[3].isRacketType){
            var vec = syntaxStrTreeArg[1];
            var idx = syntaxStrTreeArg[2].value;
            if (0<=idx && idx < vec.length) {
                vec.arr[idx] = syntaxStrTreeArg[3];
            }
            return namespace["void"].obj;
        } else {
            outputlog("vector-set! was not called with a Vector, Num, and a Value.");
            return null;
        }
    }
    namespace["list->vector"] = new Racket.Lambda(["lst"], new Racket.Exp(), namespace);
    namespace["list->vector"].returnSExp = true;
    namespace["list->vector"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
        if (syntaxStrTreeArg.length === 2 && syntaxStrTreeArg[1].isRacketList){
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

            return new Racket.SExp(arr,namespace,continuation);
        } else {
            outputlog("vector->list was not called with 1 List.");
            return null;
        }
    }
    namespace["vector-append"] = new Racket.Lambda(["vec",".","rst"], new Racket.Exp(), namespace);
    namespace["vector-append"].returnSExp = true;
    namespace["vector-append"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
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
                return new Racket.SExp(arr,namespace,continuation);
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
    namespace["vector-map"].returnSExp = true;
    namespace["vector-map"].evalBody = function(syntaxStrTreeArg, namespace, continuation) {
        if (syntaxStrTreeArg.length >= 3){
            var isAllVecAndSameLength = true;
            var arrlen = syntaxStrTreeArg[2].length;
            for (var i=2; i<syntaxStrTreeArg.length; ++i){
                isAllVecAndSameLength = isAllVecAndSameLength && syntaxStrTreeArg[i].type === "Vector" && syntaxStrTreeArg[i].length === arrlen;
            }
            if (isAllVecAndSameLength){

                var arr = ["vector"];
                var identity = new Racket.Continuation(namespace);
                identity.continuation = Racket.Continuation.continuation.identity;
                for (var i=0; i<arrlen; ++i){
                    var exp = [syntaxStrTreeArg[1]];
                    for (var k=2; k < syntaxStrTreeArg.length; ++k){
                        exp.push(syntaxStrTreeArg[k].arr[i]);
                    }
                    arr.push(new Racket.SExp(exp,namespace,identity).evalFinal());
                }

                return new Racket.SExp(arr,namespace,continuation);
            } else {
                outputlog("vector-map was not called with all Vector arguments, or ones that are the same length.");
                return null;
            }

        } else {
            outputlog("vector-map was not called with at least 1 Vector.");
            return null;
        }
    }
    var keys = Object.keys(namespace);
    /*Racket.Lambda.prototype.eval = function (syntaxStrTreeArg, namespace, continuation) {
        continuation = continuation || new Racket.Continuation(namespace); // I WILL GET RID OF THIS LATER
        var result = this.evalBody(syntaxStrTreeArg,namespace,continuation); // usually the third parameter is not used
        return continuation.eval([continuation, result], namespace, continuation);
    };*/
    for (var i=0; i< keys.length; ++i) {
        var lambda = namespace[keys[i]];
        if (lambda && lambda.type === "Lambda") {
            
            if (!lambda.returnSExp) {
                lambda.eval = Racket.Lambda.libraryEval;
            }
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
    reindentbutton = document.getElementById("re-indent-button");
    checkbox = document.getElementById("auto-clear-checkbox");
    clearbutton = document.getElementById("clear-button");
    fileupload = document.getElementById("file-upload");
    filesubmit = document.getElementById("file-upload-submit");
    deletemenu = document.getElementById("delete-module-menu");
    deletebutton = document.getElementById("delete-button");
    filename = document.getElementById("file-name");
    listAbbrev = document.getElementById("list-abbrev-checkbox");
    reindentbutton.onclick = function() {
        textfield.value = textfield.value.trim();
        for (var i=0; i< textfield.value.length; ++i) {
            if (textfield.value.charAt(i) === "\n"){
                setCaretPos(textfield,i+1);
                automaticIndent({"keyCode":13});
            }
        }
    }
    deletebutton.onclick = function() {
        var filename = deletemenu.value;
        if (uploadedModulesParsed[filename])
            delete uploadedModulesParsed[filename];
        if (uploadedModulesRawText[filename])
            delete uploadedModulesRawText[filename];
        deletemenu.remove(deletemenu.selectedIndex);
    }
    filesubmit.onclick = function(){};
    submitbutton.onclick=function(){
        var result = evaluate(textfield.value);
    };
    textfield.onkeyup = automaticIndent;
    clearbutton.onclick = function () { outputfield.value = ""; };
    // Setup upload functionality
    setupModuleLoading();

    outputlog("Please wait until ("+libraryFilesCount+") libraries are loaded.");
    loadCode();
};

function outputlog(str) {
    outputfield.value += str+"\n";
    outputfield.scrollTop = outputfield.scrollHeight;
    //console.log("Logged: "+str);
};
var setCaretPos;
var getCaretPos;
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
    getCaretPos=doGetCaretPosition;
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
    setCaretPos=setCaretPosition;
    function trim(str) {// trim that removes whitespace but not newlines;
        return str.replace(/^[^\S\n]+|\s+$/g,'');
    }

    //Indent types
    var cond_like = ["cond", "case-lambda", "begin", "begin0", "require"];
    var lambda_like = ["lambda", "let", "let*", "letrec", "unless"];
    var define_like = ["define", "local", "define-struct","λ", "struct", "when"];


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
    fileupload.onchange = function() {
        filename.value = fileupload.files[0].name;
    };
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
    var result = [];
    function searchForward(str,idx,str2){
        for (var i=idx; i<str.length; ++i){
            if (str2 === str.charAt(i))
                return i;
        }
        return -1;
    }
    function searchForwardNestedComments(str,idx) {
        var open = "\#\|";
        var closed  = "\|\#";
        var count = 1;
        for (var i=idx; i<str.length; ++i){
            var st=str.substring(i,i+2);
            if (st === open) {
                count++;
                continue;
            } else if (st === closed) {
                count--;
                if (count <=0){
                    return i;
                }
                continue;
            }
        }
        return -1;
    }
    var separators = [" ","\n","\r","\(","\)","\[","\]","\'","\t"];
    function searchForwardArr(str,idx,arr) {
        for (var i=idx; i<str.length; ++i){
            if (arr.indexOf(str.charAt(i))!=-1)
                return i;
        }
        return -1;
    }

    // Overhaul tokenizing to not use regex, since can't control special conditions with it
    // Should also be faster...
    for (var i=0; i< input.length; ++i){
        var special=0;
        if (input.charAt(i) === "\""){
            special=searchForward(input,i+1,"\"");
            if (special !==-1){
                result.push(input.substring(i,special+1));
                i=special;
                continue;
            } else {
                console.log("Mismatching quotes when tokenizing.");
                return null;
            }
        } else if (input.charAt(i) === "\|"){
            special=searchForward(input,i+1,"\|");
            if (special !==-1){
                result.push(input.substring(i,special+1));
                i=special;
                continue;
            } else {
                console.log("Mismatching | when tokenizing.");
                return null;
            }
        } else if (input.substring(i,i+2) === "\#\|") {
            special = searchForwardNestedComments(input,i+1);
            if (special !==-1){
                //result.push(input.substring(i,special+1+2));
                i=special+1;
                continue;
            } else {
                console.log("Mismatching nested comments when tokenizing.");
                return null;
            }
        } else if (input.charAt(i) === "\'"){
            result.push(input.charAt(i));
            continue;
        } else if (input.charAt(i) === "\(" || input.charAt(i) === "\)"){
            result.push(input.charAt(i));
            continue;
        } else if (input.charAt(i) === "\[" || input.charAt(i) === "\]"){
            //result.push(input.charAt(i) === "\[" ? "\(" : "\)");
            result.push(input.charAt(i));
            continue;
        } else if (input.charAt(i) === " " || input.charAt(i) === "\n" || input.charAt(i) === "\r" || input.charAt(i) === "\t") {
            continue;
        } else if (input.charAt(i) === "\;") {
            special = searchForward(input,i+1,"\n");
            if (special === -1){
                special = input.length;
            }
            if (special !==-1){
                i=special;//-1;
                continue;
            }
            continue;
        } else {
            special = searchForwardArr(input,i+1,separators);
            if (special === -1){
                special = input.length;
            }
            result.push(input.substring(i,special));
            i=special-1;
            continue;
        }
    }
    return result;
};

function importCode(str){
    var temp = textfield.value;
    textfield.value = str;
    var result = evaluate(str);
    textfield.value = temp;
    return result;
};

function evaluate(str) {
    if (readyForUser || libraryLoadMode) {
        var rawCode = str;
        var tokenizedInput = tokenize(rawCode);

        console.log(tokenizedInput);

        var syntaxStrTreeBlocks = parseStr(tokenizedInput);
        if (!syntaxStrTreeBlocks) {
            //error occurred
            outputlog("Error occurred parsing or tokenizing code.");
            return null;
        }

        syntaxStrTreeBlocks = convertQuote(syntaxStrTreeBlocks);

        if (syntaxStrTreeBlocks[0] === "#lang") {
            syntaxStrTreeBlocks = syntaxStrTreeBlocks.slice(2);
        }
        console.log("Parsed String Tree:" );
        console.log(syntaxStrTreeBlocks);

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

        var start  = new Date();
        stepExp = syntaxStrTreeBlocks;
        while (stepExp.length > 0) {
            stepExp = parseStepExpBlocks(stepExp, namespace);
        }
        var end = new Date();
        outputlog("\n> Execution completed in: "+(end-start)+" ms.");
        return outputfield.value;
    }
};


function parseStr(strArr) {
    strArr.unshift("["); // Treat entire code as an array
    strArr.push("]");

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

    var parsedStrCodeTree = produceCodeBlocks(strArr);
    return parsedStrCodeTree;
};

function produceCodeBlocks(tokens){
    var block = [];

    var open = "\(";
    var closed = "\)";
    var quote = "\'";
    function findBracketEnd(tokens, idx){
        var count = 1;
        for (var i=idx; i<tokens.length; ++i) {
            if (tokens[i] === open){
                count++;
                continue;
            } else if (tokens[i] === closed){
                count--;
                if (count <=0){
                    return i;
                }
                continue;
            }
        }
        return -1;
    }
    var bracketCount=0;
    for (var i = 0; i < tokens.length; ++i) {
        if (tokens[i] == open){
            bracketCount++;
            if (i>0){
                var end = findBracketEnd(tokens,i+1);
                if (end !=-1) {
                    var result = produceCodeBlocks(tokens.slice(i,end+1));
                    if (result) {
                        block.push(result);
                        i = end;
                        bracketCount--;
                        continue;
                    } else {
                        console.log("Sub-block is null.");
                        return null;
                    }
                }
            }
        } else if (tokens[i] == closed) {
            bracketCount--;
        } else if (tokens[i] == quote) {
            block.push(tokens[i]);
        } else {
            block.push(tokens[i]);
        }
    }
    if (bracketCount!=0){
        console.log("Mismatching brackets.");
        return null;
    }
    return block;
}

function convertQuote(syntaxStrBlocks){
    var isQuote = false;
    for (var i=0; i< syntaxStrBlocks.length; ++i) {
        if (syntaxStrBlocks[i] === "\'") {
            var j=i; 
            while(syntaxStrBlocks[j] ==="\'") {
                ++j;
            }
            if (j<syntaxStrBlocks.length) {
                // Rules for quote special form
                // if (quote 5) -> 5
                // if (quote "d") -> "d"
                // if (quote #\d) -> #\d
                // if (quote asdf) -> 'asdf (Symbol type)
                // if (quote (a b c d) ...) where a b c d can be atoms or (),
                //    -> (list (quote a) (quote b) (quote c) (quote d) ...)
                //   i.e.: '(1 2) -> 
                //         (list (quote 1) (quote 2)) -> 
                //         (list 1 2)
                //   ie.: ''a -> 
                //        (quote (quote a)) -> 
                //        (list (quote quote) (quote a)) -> 
                //        (list 'quote 'a)
                //   i.e.: '('a 2) -> 
                //         (quote ((quote a) 2)) -> 
                //         (list (quote (quote a)) (quote 2)) -> 
                //         (list (list (quote quote) (quote a)) 2)
                //         (list (list 'quote 'a) 2)

                // Rule for expanding ''a, '('a), '''''a etc into (quote ... blah)
                // replace a 'next_obj with (quote next_obj)
                // if next_obj is a ' also, follow through so that i.e. ''a is (quote (quote a))
                // if next_obj is a (stuff_inside_i ... ) for 1<=i<=n n entries, 
                //                                        let stuff_inside_modified_i = convertQuote(stuff_inside_i)
                //    then replace with (list stuff_inside_modified_i ...)
                
                var replace = ["quote"].concat(syntaxStrBlocks.slice(i+1,j+1));
                replace = convertQuote(replace);
                syntaxStrBlocks = syntaxStrBlocks.slice(0,i).concat([replace]).concat(syntaxStrBlocks.slice(j+1));
            } else {
                console.log("Quote is not followed by anything.");
                return syntaxStrBlocks;
            }
        } else if (syntaxStrBlocks[i].constructor === Array){
            syntaxStrBlocks[i] = convertQuote(syntaxStrBlocks[i]);
        }
    }
    return syntaxStrBlocks;
}

function parseStepExpBlocks (syntaxStrBlocks, namespace) {
    if (syntaxStrBlocks.length > 0) {
        while (syntaxStrBlocks.constructor === Array && syntaxStrBlocks[0][0] === "begin") {
            syntaxStrBlocks = syntaxStrBlocks[0].slice(1).concat(syntaxStrBlocks.slice(1));
        }; // fix for (begins lifting to globalNamespace)
        // Expression inside begin in simplest form outputs are spliced to surrounding context
        //  meaning result is made output (only if namespace === globalNamespace)

        var exp = new Racket.SExp(syntaxStrBlocks[0],
                                    namespace,
                                    new Racket.Continuation(namespace,
                                        Racket.Continuation.continuation.identity));
        exp = exp.evalFinal();

        if (exp) { // Expression is simplest form
            if (exp !== true && exp.type !== "Void") {
                outputlog(exp.toString());
            }
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
    if (expression && expression.isRacketType)
        //replaced (expression.isRacketType || expression instanceof Racket.SExp) for now
        return expression;
    var len = expression.length;
    if (!isNaN(expression))
        return new Racket.Num(Number(expression));
    else if (expression.charAt(0)==="\"" && expression.charAt(len-1)==="\"")
        return new Racket.Str(expression.substring(1,len-1));
    else if (expression.charAt(0)==="\#") {
        if (expression.charAt(1) === "\\" && len>2) {
            return new Racket.Char(expression.substring(2));
        } else if (len===2) {
            return new Racket.Bool(expression ==="\#t");
        } else {
            outputlog("Unknown type: "+expression);
            return null;
        }
    }
    var lookup = specialForms[expression] || namespace[expression];
    if (lookup) {
        return lookup;
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
