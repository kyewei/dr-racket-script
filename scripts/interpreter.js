var textfield;
var button;

var rawCode = "";
var initialFirst;
var namespace;
var specialforms = {};

prep();

function prep() {
    textfield = document.getElementById("code-field");
    button = document.getElementById("submit-button");
    button.onclick=evaluate;
    
    populateSpecialForms();
    
};

function tokenize(input) {
    rawCode = textfield.value;
    var temp = rawCode.replace(/[\(\)\[\]]/g, function(a){return " "+a+" ";})
    //|(?=[\(\)\[\]])|(?<=[\(\)\[\]])
    // why does JS not support positive lookbehind? :(
    
    // semicolon to account for comments
    var temp2 = temp.split(/[\s\n]+|\;.*\n/g); 
    return temp2.filter( function(str){return str!="";} );
};


function Exp () {this.def = namespace;};
var Num = function (val) { this.value=value; };
Num.prototype = new Exp();
var Str = function (val) { this.value=value; };
Str.prototype = new Exp();
var Bool = function (val) { this.value=value; };
Bool.prototype = new Exp();
var Sym = function (val) { this.value=value; };
Sym.prototype = new Exp();




function populateSpecialForms() {
    specialforms.define = function(name, id, body) {
        this.name = name;
    };
    specialforms.define.prototype = new Exp();
    
};

function evaluate() {
    rawCode = textfield.value;
    var tokenizedInput = tokenize(rawCode);
    
    console.log(tokenizedInput);

    var parseResult = parseStr(tokenizedInput);
    if (!parseResult) {
        //error occurred
    }
};

function parseStr(strArr) {
    //check for correct bracket pair
    var bracketStack = [];
    for (var i=0; i< strArr.length; ++i) {
        if (strArr[i]==="(" || strArr[i] === "[")
            bracketStack.push(strArr[i]);
        else if (strArr[i]===")" || strArr[i] === "]") {
            var lastBracket = bracketStack.pop();
            if (!((lastBracket === "[" && strArr[i] === "]") ||
            (lastBracket === "(" && strArr[i] === ")"))) {
                console.log("Bracket pairing mismatch!!!");
                return null;
            }
        }
            
    }
    //normalize brackets
    for (var i=0; i< strArr.length; ++i) {
        if (strArr[i] === "[")
            strArr[i] = "(";
        else if (strArr[i] === "]")
            strArr[i] = ")";
    }
    
    var strCodeBlocks = recognizeBlock(strArr);
    
    console.log("Parsed String Code Blocks:" );
    console.log(strCodeBlocks);
    
    var parsedStrCodeTree = new Array (strCodeBlocks.length);
    for (var i=0; i< strCodeBlocks.length; ++i) {
        parsedStrCodeTree[i] = recursivelyBuildCodeTree(strCodeBlocks[i]);
    }
    
    console.log("Parsed String Tree:" );
    console.log(parsedStrCodeTree);
    
    return strCodeBlocks;
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
        else
            console.log("Missing brackets");     
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
        if (strBlock[0] =="(") {
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
        }
        // decrement for closing brackets here        
        else if (strBlock[j] ===")"){
            bracketCount--;
        }
        else {
            console.log("Bracket-less array code block!");
        }
        return subBlocks;
    }
    else if (strBlock.length == 0)
        //should not be brackets
        return strBlock[0];
    else 
        console.log("Null element!!!");
        return null;
    
};





