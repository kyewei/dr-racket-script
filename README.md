dr-racket-script
================

This is a minimal browser-based Racket/PLT-Scheme interpreter written in JavaScript. 
Racket is a language based in the Lisp/Scheme family of languages.
I wrote this to augment my understanding of the language and also to see how far I could take an ambitious project like this.
In its current state, it does not fully support all native types (Symbol, Number, String, Character, Boolean, etc) yet. 
Most list operations and higher order list processing functions are implemented however, 
since I found Racket's list processing functionalities the biggest difference compared to other traditional imperative programming languages.
The web page where the interpreter resides, specifically the evaluation textbox, also auto-indents on every Enter-key press. 

Try it out [here](http://kyewei.github.io/dr-racket-script/)

###Implementation Details
In order to create this, I had to use design patterns often found in functional programming.
User entered code is first tokenized, removing comments and normalizing brackets.
The project implements a recursive code parser that breaks code into blocks. 
Blocks are then recursively parsed and evaluated by first translating them into Racket types, or looking up functions in a given namespace.
Every object has an eval() that either returns itself, or in the case of a function or special form, returns the evaluated function result.
Proper namespacing and nesting was implemented through using JavaScript's prototypical inheritance.


###Supported Language Features
* Namespacing (for local, define, functions, etc)
```
    (local [(define x 5)] (local [(define x 6)] x)) -> 6
```
* Lambda functions
```
    ((lambda (x) (* x x)) 5) -> 25
```
* Lists
```
    (append (cons 1 (cons 2 empty)) (list 3 4 5) (list 6)) -> (list 1 2 3 4 5 6)
```
* Higher-order functions
```
    (foldr + 0 (build-list 100 add1)) -> 5050
```
* Rest arguments
```
    (define (mystery arg1 . rest-arg) 
      (cons (add1 arg1) rest-arg))
    (mystery 100 1 2 3 4 5) -> (list 101 1 2 3 4 5)
```
* Structures
```
    (define-struct posn (x y z))
    (define triangle (make-posn 3 4 5))
    (posn? triangle) -> #t
    (posn-x triangle) -> 3
    (posn-y triangle) -> 4
    (posn-z triangle) -> 5
```


###Special Forms
These are the currently implemented special forms:

    (define id bodyexp)
    (define (id args) ... bodyexp)
    (define-struct type-id (id ...))
    (local [(define ...) ...] bodyexp)
    (cond [predicate? bodyexp] ... [else bodyexp])
    (if predicate true-bodyexp false-bodyexp)
    (lambda (args ...) ... bodyexp)
    (or ...)
    (and ...)
    (let ([id exp] ...) bodyexp)
    (let* ([id exp] ...) bodyexp)
    (letrec ([id exp] ...) bodyexp)
    (set! id exp)
    

###Implemented List and Higher Order Functions
Higher order functions were implemented with variadic arguments if they supported them. 
However, although unary versions were implemented efficiently, 
their variadic counterparts required using (apply) and turned out not as efficient.

    cons
    cons?
    list?
    empty?
    foldr
    foldl
    map
    filter
    append
    apply
    list-ref
    reverse
    list
    
Other non-list functions were also implemented, but are not discussed here.

###To be Implemented in the Future
* More special forms (maybe)
* More functions

####Remark:
Beware of deep stacks caused by recursion. 
Since most JS engines don't have tail call optimizations, deep recursion can give stack errors.
Also, it's surprising how much work a person can get done during finals week...
