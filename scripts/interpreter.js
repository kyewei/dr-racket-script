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
};
var Lambda = function (ids, body, namespace) {
    // ids is an Array of Strings that is declared in the sub-namespace
    // body is the Exp that will involve members of ids
    
    this.type="Lambda";
    
    this.name = "lambda";
    this.paramCount = ids.length;
    /* if (paramId.length >=3 && paramId[length-2] ==".") {
        this.paramCount = paramIdlength-1;
    }
    else {
        this.paramId = paramId;
    } */
    this.ids=ids;
    this.body = body;
    this.inheritedNamespace = namespace;
    
    this.eval = function (syntaxStrTreeArg, namespace) {
        var lambdaNamespace = Namespace(this.inheritedNamespace);
        if (syntaxStrTreeArg.length - 1 === ids.length) {
            for (var i=0; i< ids.length; ++i) {
                lambdaNamespace[ids[i]]=syntaxStrTreeArg[i+1];
            }
            var result = parseExpTree(body, lambdaNamespace);
            if (result)
                return result;
            else {
                console.log("Lambda evaluation error.");
                return null;
            }
        } else {
            console.log("Function parameter count mismatch.");
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



function populateSpecialForms() {
    var keywords = {};
    keywords["true"] = new Bool(true);
    keywords["false"] = new Bool(false);
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
            console.log("define body evaluation failed.");
        }
    };
    keywords["local"] = new SpecialForm();
    keywords["local"].eval = function (syntaxStrTree, namespace) {
        //assert syntaxStrTree[0] === "local"
        // in the form of :
        // (local (exp exp ... exp) body)
        
        var localNamespace = Namespace(namespace);
        var defEval = syntaxStrTree[1].map(function(cur,i,arr) { return parseExpTree(cur,localNamespace); });
        var defSuccess = defEval.reduce(function(prev,cur,i,arr) { return prev && cur; }, true);
        if (defSuccess) {
            var result = parseExpTree(syntaxStrTree[2],localNamespace);
            if (result) {
                return result;
            } else {
                console.log("local body evaluation failed.");
                return null;
            } 
        } else {
            console.log("local definition body evaluation failed.");
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
        //assert syntaxStrTree[0] === "lambda"
        // in the form of :
        // (local (id id ... id) body)
    }
    return keywords;
};

var specialForms = populateSpecialForms();

function populateStandardFunctions(namespace) {
    namespace["+"] = new Lambda(["x","y"], new Exp());
    namespace["+"].eval = function(syntaxStrTreeArg, namespace) {
        var count = 0;
        for (var i=1; i< syntaxStrTreeArg.length; ++i) {
            if (syntaxStrTreeArg[i].type === "Num")
                count += syntaxStrTreeArg[i].value;
            else {
                //i = syntaxStrTreeArg.length;
                console.log("Not all arguments were Num Type");
                return null;
            }
        }
        return new Num(count);
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
    //console.log(temp);
    var temp2 = "";
    var quoteEnabled = false;
    for (var i=0; i< temp.length; ++i) {
        if (temp.charAt(i) === "\"")
            quoteEnabled = true;
        
        if (quoteEnabled) {
            var quoteEnd = i;
            for (var j=i+1; j< temp.length; ++j) {
                if (temp.charAt(j) === "\"")
                    quoteEnd = j;
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



function evaluate() {
    var rawCode = textfield.value;
    var tokenizedInput = tokenize(rawCode);
    
    console.log(tokenizedInput);

    var syntaxStrTreeBlocks = parseStr(tokenizedInput);
    if (!syntaxStrTreeBlocks) {
        //error occurred
    }
    //var output = syntaxStrTreeBlocks.map(printCode).reduce(function(prev,cur,i,arr) { return prev+(i>0?"\n":"")+cur; },"");
    //console.log("\n"+output);
    
    stepExp = syntaxStrTreeBlocks; 
    stepExp = parseStepExpBlocks(stepExp);
    while (stepExp.length > 0) {
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
                console.log(""+exp); //Print output to console
            return syntaxStrBlocks.slice(1); //return rest of blocks to parse
        }
    }
}

function parseLookupType(expression,namespace) {
    //console.log("Tried parsing: "+ expression);
    if (expression[0]==="\"" && expression[expression.length-1]==="\"")
        return new Str(expression.substring(1,expression.length-1));
    else if (expression[0]==="\'" && expression.length>1)
        return new Sym(expression.substring(1));
    else if (expression.substring(0,2)==="\#\\" && expression.length>2)
        return new Char(expression.substring(2));
    else if (expression[0]==="\#" && expression.length==2)
        return new Bool(expression==="\#t");
    else if (!isNaN(Number(expression)))
        return new Num(Number(expression));
    else if (console.log("Looked up special form: "+  expression) || specialForms[expression]) {
        return specialForms[expression];
    } else if (console.log("Looked up: "+ expression +" in namespace: " + namespace) || namespace[expression]) {
        return namespace[expression];
    } else {
        console.log("Unknown type: "+expression);
        return null;
    }
}

function parseExpTree (syntaxStrTree, namespace) {
    if (Array.isArray(syntaxStrTree)) { 
        
        var lookupExp; // Expression to call, whether it is special form or function
        lookupExp = parseExpTree(syntaxStrTree[0],namespace); 
        /*if (Array.isArray(syntaxStrTree[0])) {
            // lambda function that is declared in-line
        }
        else { // should be string
            lookupExp = lookupSpecialForm(syntaxStrTree[0]); // lookup special form
            if (lookupExp) { // if the special form is found, then this branch exits
                var result = lookupExp(syntaxStrTree, namespace);
                return result;
            }
            else { // lookup function in namespace
                lookupExp = lookupName(syntaxStrTree[0], namespace);
            }
        }*/
        
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
                    console.log("Function "+syntaxStrTree[0]+" evaluation returned error");
                    return null;
                }
            } else {
                //return [syntaxStrTree[0]].concat(evaluatedSyntaxStrTree.map(function(cur,i,arr){ return cur.toString(); })); 
                console.log(""+ syntaxStrTree[0]+ " function call arguments were not all Typed");
                return null;
            }
        } else {
            console.log("Descriptor not found: "+syntaxStrTree[0]);
            return null;
        }
    } else {
        return parseLookupType(syntaxStrTree, namespace);
    }
}

