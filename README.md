dr-racket-script
================

This is a minimal browser-based Racket/PLT-Scheme interpreter written in JavaScript.
Racket is a language based in the Lisp/Scheme family of languages.
I wrote this to augment my understanding of the language and also to see how far I could take an ambitious project like this.
In its current state, it does not fully support all native types (Symbol, Number, String, Character, Boolean, etc) yet.
Most list operations and higher order list processing functions are implemented however,
since I found Racket's list processing functionalities the biggest difference compared to other traditional imperative programming languages.
The web page where the interpreter resides, specifically the evaluation textbox, also auto-indents on every Enter-key press.

Try it out [here](http://kyewei.github.io/dr-racket-script/).

###Implementation Details
In order to create this, I had to use patterns often found in functional programming, such as the idea of eval-apply cycle and recursion on structures,
as well as various JavaScript language features such as its support of prototypical inheritance, accessing objects as associative arrays, and first-class functions and closures.

To implement proper namespacing and nesting, I leveraged JavaScript's support of prototypical inheritance and its support of accessing objects as associative arrays.
JavaScript's support for first-class functions and closures also helped me implement the various types and custom structures.
The concept of eval-apply is employed in function evaluation.

The actual parsing and evaluating of input consisted of the following steps.
User entered code is first tokenized, removing comments and normalizing brackets.
Tokenized input is broken into blocks through the project's recursive code parser.
Blocks are then recursively parsed into native nested arrays (effectively treated as nodes with the first element as a parent and the rest as children), and translated into Racket types or functions through namespace lookup.
While it is being converted into arrays, it is also being evaluated depth-first, effectively reducing the array to one final output when recursion is done.
Evaluation is done through every object having an eval() that accepts arguments, which either returns itself, or in the case of a function or special form, returns the evaluated function result.


###Supported Language Features
* Namespacing (for local, define, functions, etc)
```
(local [(define x 5)]
  (local [(define x 6)] x)) -> 6
```
* Lambda functions
```
((lambda (x) (* x x)) 5) -> 25
```
* Lists
```
(append (cons 1 (cons 2 empty))
        (list 3 4 5)
        (list 6)) -> (list 1 2 3 4 5 6)
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
* Structures (`define-struct`/`struct` and `make-posn`/`posn` (in this case) can be interchanged)
```
(define-struct posn (x y z))
(define triangle (make-posn 3 4 5))
(posn? triangle) -> #t
(posn-x triangle) -> 3
(posn-y triangle) -> 4
(posn-z triangle) -> 5
```
* Simple module provide/require and uploading (current only supports single files)

  `file1.rkt`:
  ```
  (provide x)
  (define x 5)
  ```
  `file2.rkt`:
  ```
  (require "file1.rkt")
  (provide x y)
  (define y 10)
  ```
  `file3.rkt`:
  ```
  (require "file2.rkt")
  x -> 5
  y -> 10
  ```
* Basic support for tail-recursion (things just get slower instead)
```
(define (sum1 n) ;; Not tail recursive
  (if (>= 0 n)
      0
      (+ n (sum1 (sub1 n)))))
(sum1 5000) -> 12502500
(sum1 10000) -> "Maximum call stack size exceeded" in Chrome JavaScript console

(define (sum2 acc n) ;; Tail recursive
  (if (>= 0 n)
      acc
      (sum2 (+ acc n)
            (sub1 n))))
(sum2 0 5000) -> 12502500
(sum2 0 10000) -> 50005000
(sum2 0 99999) -> 4999950000
(sum2 0 500000) -> 125000250000 ;; Takes a while to finish...
```

###Special Forms
These are the currently implemented special forms:

    (define id bodyexp)
    (define (id args) ... bodyexp)
    (define-struct type-id (id ...))
    (struct type-id (id ...))
    (local [(define ...) ...] ... bodyexp)
    (cond [predicate? ... bodyexp] ... [else bodyexp])
    (if predicate true-bodyexp false-bodyexp)
    (lambda (args ...) ... bodyexp)
    (case-lambda [(args ...) ... bodyexp] ...)
    (or ...)
    (and ...)
    (let ([id exp] ...) ... bodyexp)
    (let* ([id exp] ...) ... bodyexp)
    (letrec ([id exp] ...) ... bodyexp)
    (begin exp ... final-exp)
    (set! id exp)
    (require filename-string ...)
    (provide id ...)


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
    andmap
    ormap
    filter
    append
    apply
    list
    list-ref
    list-tail
    build-list
    reverse
    assf
    remove
    remove*
    member

Other non-list functions were also implemented, but are not discussed here.

###To be Implemented in the Future
I will be adding features as I learn more of the language. These may include:
* More special forms (maybe)
* More functions

####Remark:
Beware of deep stacks caused by recursion (by that I mean non-tail-recursive recursion).
Since most JS engines don't optimize for deep stacks, deep recursion can give stack errors.
Also, it's surprising how much work a person can get done during finals week...
