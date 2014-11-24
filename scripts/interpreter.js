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
    
};

function parseStr(strArr) {
  
    var strCodeBlocks = recognizeBlock(strArr);
    
    console.log("Parsed String Code Blocks:" );
    console.log(strCodeBlocks);
    
    var parsedStrCodeTree = new Array (strCodeBlocks.length);
    for (var i=0; i< strCodeBlocks.length; ++i) {
        parsedStrCodeTree[i] = recursivelyBuildCodeTree(strCodeBlocks[i]);
    }
    
    return strCodeBlocks;
};

function recognizeBlock(unparsedBlocks) {
    if (unparsedBlocks.length ==1)
        return unparsedBlocks;
    block = [];
    while (unparsedBlocks.length > 0){
        if (unparsedBlocks[0]=="(" || unparsedBlocks[0] == "[") {
            var blockstart = unparsedBlocks[0];
            var bracketcount = 1;
            for (var i=1; i<unparsedBlocks.length; ++i) {
                if (unparsedBlocks[i]=="(" || unparsedBlocks[i] == "[")
                    bracketcount++;
                else if (unparsedBlocks[i]==")" || unparsedBlocks[i] == "]")
                    bracketcount--;
                    if (bracketcount ==0) {
                        if ( (blockstart == "[" && unparsedBlocks[i] == "]") ||
                             (blockstart == "(" && unparsedBlocks[i] == ")") ){
                            var splicedblock = unparsedBlocks.slice(0,i+1);
                            block.push(splicedblock);
                            unparsedBlocks = unparsedBlocks.slice(i+1,unparsedBlocks.length);
                            i = unparsedBlocks.length;
                        }
                        else {
                            i = unparsedBlocks.length;
                            console.log("Error, mismatching block brackets");
                            unparsedBlocks=[];
                        }
                    }
            }
        }
        else
            console.log("Missing brackets");     
    }
    return block;
}

function recursivelyBuildCodeTree(strBlock) {

};





