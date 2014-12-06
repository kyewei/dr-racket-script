var textfield;
var button;



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
var Type = function() {
    this.eval = function() { return this;};
}

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
};
var Lambda = function (paramId, body) {
    // idList is an Array of Strings that is declared in the sub-namespace
    // body is the Exp that will involve members of idList
    
    this.type="Function";
    
    this.name = "lambda";
    this.paramCount;
    /* if (paramId.length >=3 && paramId[length-2] ==".") {
        this.paramCount = paramIdlength-1;
    }
    else {
        this.paramId = paramId;
    } */
    this.paramId=paramId;
    this.body = body;
    
    this.eval = function () {
    // arguments[0] is a Namespace
    // arguments.length = paramId.length + 1
    // arguments[1] to arguments[arguments.length-1] are Exp
    
    };
}
var FunctionEvaluation = function (lambda, args) {
    // lambda is a Lambda
    // args is a list of Exp
    this.lambda = lambda;
    this.args = args;
    this.type="FunctionEvaluation";
    this.eval = function(namespace) {
        return lambda.eval.apply(lambda, [namespace].concat(args));
    }
    
}
Type.prototype = new Exp();
Num.prototype = new Type();
Str.prototype = new Type();
Bool.prototype = new Type();
Sym.prototype = new Type();
Char.prototype = new Type();
Lambda.prototype = new Type();

function evalId(id, namespace) {
    // id is a String
    // namespace is a Namespace
    
    var evalResult = namespace[id];
    if (evalResult)
        return evalResult;
    else {
        console.log("No binding for Id: "+ this.id);
        return null;
    }
}

function populateSpecialForms() {
    var keywords = {};
    keywords["define"] = function(syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "define"
        
        if (Array.isArray(syntaxStrTree[2])) { // inside needs to be evaluated
            var result = parseExpTree(syntaxStrTree[2],namespace);
            if (result) {
                if (result instanceof Type)
                    syntaxStrTree[2] = result.toString;
                else 
                    syntaxStrTree[2] = result;
                return syntaxStrTree;
            }
        }
        else {
            var result = parseExpTree(syntaxStrTree[2],namespace);
            if (result) {
                namespace[syntaxStrTree[1]] = result;
                return true;
            }
        }
        
    };
    keywords["define"].prototype = Exp();
    return keywords;
};

var specialForms = populateSpecialForms();

function populateStandardFunctions(namespace) {
    namespace["+"] = new Lambda(["x","y"], new Exp());
    namespace["+"].eval = function(syntaxStrTreeArg, namespace) {
        //var lambdaNamespace = Namespace(namespace);

        if (syntaxStrTreeArg.reduce( function(prev, cur, ind, arr) { return (cur.type === "Num") && prev; }, true)) {
            return new Num(syntaxStrTreeArg.reduce(function (prev, cur, ind, arr) { return prev + cur.value; }, 0));
        }
        else {
            console.log("Not all arguments were Num Type");
            return null;
        }
    }

    namespace["-"] = function () {
        this.name = "-";
        return arguments.reduce(function(x,y){ return x.value-y.value; });
    }
    namespace["*"] = function () {
        this.name = "*";
        return arguments.reduce(function(x,y){ return x.value*y.value; });
    }
    namespace["/"] = function () {
        this.name = "\/";
        return arguments.reduce(function(x,y){ return x.value/y.value; });
    }
}
populateStandardFunctions(globalNamespace);
    
    





// ---------- INIT ----------



prep();

function prep() {
    textfield = document.getElementById("code-field");
    button = document.getElementById("submit-button");
    button.onclick=evaluate;
};


function tokenize(input) {
    rawCode = textfield.value;
    var temp = rawCode.replace(/[\(\)\[\]]/g, function(a){return " "+a+" ";})
    //|(?=[\(\)\[\]])|(?<=[\(\)\[\]])
    // Why does JS not support positive look-behind? :(
    
    // Semicolon to account for comments
    var temp2 = temp.split(/[\s\n]+|\;.*\n/g); 
    return temp2.filter( function(str){return str!="";} );
};



function evaluate() {
    var rawCode = textfield.value;
    var tokenizedInput = tokenize(rawCode);
    
    console.log(tokenizedInput);

    var syntaxStrTreeBlocks = parseStr(tokenizedInput);
    if (!syntaxStrTreeBlocks) {
        //error occurred
    }
    var output = syntaxStrTreeBlocks.map(printCode).reduce(function(prev,cur,i,arr) { return prev+(i>0?"\n":"")+cur; },"");
    console.log(output);
    
    var stepExp = syntaxStrTreeBlocks; 
    stepExp = parseStepExpBlocks(stepExp);
    while (stepExp.length > 0) {
        printCode(stepExp);
        stepExp = parseStepExpBlocks(stepExp);
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
    }
    else 
        return syntaxStrTreeBlocks;
};


function parseStr(strArr) {
    
    //This is a preliminary check for correct bracket pairing and count
    var bracketStack = [];
    for (var i=0; i< strArr.length; ++i) {
        if (strArr[i]==="(" || strArr[i] === "[")
            bracketStack.push(strArr[i]);
        else if (strArr[i]===")" || strArr[i] === "]") {
            var lastBracket = bracketStack.pop();
            if (!lastBracket) {
                console.log("Extra brackets!");
                return null;
            }
            else if (!((lastBracket === "[" && strArr[i] === "]") ||
            (lastBracket === "(" && strArr[i] === ")"))) {
                console.log("Brackets paired incorrectly!");
                return null;
            }
            //Otherwise, brackets fine
        }   
    }
    if (bracketStack.length>0) {
        console.log("Missing brackets!");
        return null;
    }
    
    
    //Check passed: now normalize brackets
    for (var i=0; i< strArr.length; ++i) {
        if (strArr[i] === "[")
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
    if (unparsedBlocks.length ==1)
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
                    if (bracketcount ==0) {
                        var splicedblock = unparsedBlocks.slice(0,i+1);
                        block.push(splicedblock);
                        unparsedBlocks = unparsedBlocks.slice(i+1,unparsedBlocks.length);
                        i = unparsedBlocks.length;
                    }
                }
            }
        }
        else if (unparsedBlocks[0]===")"){
            console.log("Extra brackets");
            return null;
        }
        else {
            block.push (unparsedBlocks[0])
            unparsedBlocks = unparsedBlocks.slice(1);
        }
    }
    return block;
};

// strBlock is Array of (String)
// returns Array of (String or (Array of (String)))
function recursivelyBuildCodeTree(strBlock) {
    console.log("recursivelyBuildCodeTree called with: ");
    console.log(strBlock);
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
    /*var expResultTree = new Array(syntaxStrBlocks.length);
    for (var i=0; i< syntaxStrBlocks.length; ++i) {
        var result = parseExpTree(syntaxStrBlocks[i], globalNamespace);
        if (result){ //Not null
            expResultTree[i] = result;
            
        }
        else {
            console.log("Unknown identifier.");
            return null;
        }
    }
    return expResultTree;*/
    
    if (syntaxStrBlocks.length > 0) {
        var exp = parseExpTree(syntaxStrBlocks[0], globalNamespace);
        
        if (Array.isArray(exp)) {
            syntaxStrBlocks[0] = exp;
            return syntaxStrBlocks; //don't need since original object is modified
        }
        else { // Expression is simplest form 
            console.log(exp); //Print output to console
            return syntaxStrBlocks.slice(1); //return rest of blocks to parse
        }
    }
}

function parseType(expression,namespace) {
    if (expression[0]==="\"" && expression[expression.length-1]==="\"")
        return new Str(expression.substring(1,length-1));
    else if (expression[0]==="\'" && expression.length>1)
        return new Sym(expression.substring(1));
    else if (expression.substring(0,2)==="\#\\" && expression.length>2)
        return new Char(expression.substring(2));
    else if (expression[0]==="\#" && expression.length==2)
        return new Bool(expression==="\#t");
    else if (!isNaN(Number(expression)))
        return new Num(Number(expression));
    else if (namespace[expression])
        return namespace[expression];
    else {
        console.log("Unknown type");
        return null;
    }
}

function parseExpTree (syntaxStrTree, namespace) {
    if (Array.isArray(syntaxStrTree)) { 
        
        if (Array.isArray(syntaxStrTree[0])) {
            //probably lambda fn
        }
        else { // should be string
            var lookupExp = lookupSpecialForm(syntaxStrTree[0]); // lookup special form
            if (lookupExp) {
                var result = lookupExp(syntaxStrTree, namespace);
                return result;
            }
            else { // lookup function
                lookupExp = lookupName(syntaxStrTree[0], namespace);
                if (lookupExp) { //evaluate function
                    var functionCallArgs = syntaxStrTree.slice(1).map(function(cur,i,arr) { return parseExpTree(cur,namespace); });
                    if (functionCallArgs.reduce(function(prev,cur,i,arr) { return prev && (cur instanceof Type); }, true)) {
                        var result = lookupExp.eval(functionCallArgs,namespace);
                        if (result) {
                            return result;
                        }
                        else {
                            console.log("Function "+syntaxStrTree[0]+" evaluation returned error");
                            return null;
                        }

                    }
                    else {
                        return [syntaxStrTree[0]].concat(functionCallArgs.map(function(cur,i,arr){ return cur.toString(); })); 
                    }
                }
                else {
                    console.log("Descriptor not found: "+syntaxStrTree[0]);
                    return null;
                }
            }
        }
        
        /*var expResultTree = new Array(syntaxStrTree.length);
        
        if (syntaxStrTree.length>1) {
            if (Array.isArray(syntaxStrTree[0])) {
                //probably lambda fn
            }
            else { // Is keyword for function or special form.
                var lookupExp = lookupName(syntaxStrTree[0], namespace);
                if (lookupExp) {
                    var result = new lookupExp(syntaxStrTree[1], parseExpTree(syntaxStrTree[2], namespace));
                    //return result;
                }
                else {
                    console.log("Descriptor not found: "+syntaxStrTree[0]);
                    return null;
                }
            }
        }*/
    }
    else {
        return parseType(syntaxStrTree, namespace);
    }
}
function lookupSpecialForm(name) {
    console.log("Looked up special form: "+  name);
    if (specialForms[name])
        return specialForms[name];
    else 
        return null;
}

function lookupName(name, namespace) {
    console.log("Looked up: "+  name +" in namespace: " + namespace);
    if (namespace[name])
        return namespace[name];
    else 
        return null;
}



