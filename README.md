dr-racket-script
================

This is a minimal browser Racket/PLT-Scheme interpreter written in JavaScript.
I wrote this to augment my understanding of the language and also to see how far I could take an ambitious project like this.
In its current state, it does not fully support all native types (Symbol, Number, String, Character, Boolean, etc) yet. 
Most list operations and higher order list processing functions are implemented however.
The web page where the interpreter resides, specifically the evaluation textbox, also auto-indents on every Enter-key press. 


###Implementation
In order to create this, I had to use design patterns often found in functional programming.
User entered code is first tokenized, removing comments and normalizing brackets.
The project implements a recursive code parser that breaks code into blocks. 
Blocks are then recursively parsed and evaluated by first translating them into Racket types, or looking up functions in a given namespace.
Every object has an eval() that either returns itself, or in the case of a function or special form, returns the evaluated function result.
Proper namespacing and nesting was implemented through using JavaScript's prototypical inheritance.


###Implemented Language Features
* Namespacing (for local, define, functions, etc)
```
    (local [(define x 5)] (local [(define x 6)] x))
```
* Lambda functions
```
    ((lambda (x) (* x x)) 5)
```
* Lists
```
    (append (cons 1 (cons 2 empty)) (list 3 4 5) (list 6))
```
* Higher-order functions
```
    (foldr + 0 (build-list 100 add1))
```
* Rest arguments
```
    (define (function arg . rest-arg) body)
```


###Implemented Special Forms
These are the currently implemented special forms:

    (define id bodyexp)
    (define (id args) bodyexp)
    (local [(define ...) ...] bodyexp)
    (cond [predicate? bodyexp] ... [else bodyexp])
    (if predicate true-bodyexp false-bodyexp)
    (lambda (args ...) bodyexp)
    (or ...)
    (and ...)

###Implemented List and Higher Order Functions
Higher order functions were implemented with variadic arguments if they used them. However, unary versions are more efficient.

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
    
Other functions were also implemented, but are not discussed here.

###Implemented in the Future
* Structures
* More special forms (maybe)
* More functions

####Remark:
Beware of deep stacks caused by recursion. 
Since most JS engines don't have tail call optimizations, deep recursion can give stack errors.
Also, it's surprising how much work a person can get done during finals week...
