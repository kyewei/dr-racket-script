dr-racket-script
================

This is a minimal Racket/PLTScheme interpreter written in Javascript. 
It supports basic implementations of some of the patterns found in functional programming.
It currently does not support all types (Symbol, Number, String, Character, Boolean, etc) yet. 
The web evaluation textbox also auto-indents on every Enter-key press. 

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
    foldr
    foldl
    map
    filter
    append
    apply
    list-ref
    reverse
    list


###Implemented in the Future
* Structures
* More special forms (maybe)
* More functions

####Remark:
Beware of deep stacks. Since most JS engines don't have tail call optimizations, deep recursion can give stack errors.
Also, it's surprising how much work a person can get done during finals week...
