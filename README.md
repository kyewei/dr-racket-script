dr-racket-script
================

This is a browser-based Racket/PLT-Scheme interpreter written in JavaScript.
Racket is a language based in the Lisp/Scheme family of languages.
I wrote this to augment my understanding of the language, which was taught in my university's CS135 course, 
and also to see how far I could take an ambitious project like this.

In its current state, it supports common atomic types (Number, String, Character, Boolean) with the exception of Symbols and as a result, literal notation. Numbers for now are also directly stored as JavaScript's floating point numbers, and not Racket's unlimited length numbers. It also supports named and anonymous functions (including lambda expressions along with its associated closure), Lists (singly-linked lists) and higher-order functions on Lists (map, foldr, foldl, filter, etc), creating user-defined structures, the Vector type (equivalent to array), basic module support (importing uploaded files through require and provide), and explicit continuations through call/cc.

You may find that there are many functions specific to lists. 
This is because I implemented many list functions and higher order list processing functions since I found Racket's list processing functionality very different from those in other traditional imperative programming languages. 

The way code is evaluated is a form of continuation passing style (CPS) but modified to work in JavaScript, where an explicit continuation (a sort of program state that encapsulates what a program does after a particular step in evaluation) is passed from call to call. This allows not only tail-recursive but also non-tail-recursive calls to recurse infinitely if needed, and can support deep recursion (as long as it eventually finishes of course).

Try it out [here](http://kyewei.github.io/dr-racket-script/).

###Implementation Details (for those who are curious)

To implement proper namespacing and nesting, I leveraged the JavaScript language's support of prototypical inheritance and its support of accessing objects as associative arrays. Nested deeper 'namespaces' inherit through its prototype chain (which consists of surrounding namespaces) to gain access to its environment variables. This allows deeer namespaces to act like augmented namespaces.

JavaScript's support for first-class functions and closures helped me implement the various types and custom structures. I leveraged using anonymous functions especially for callbacks and implementing structures, which required creating a generic functionality set for every structure.

The functional programming concept of eval-apply is employed in function evaluation. The Scheme substitution model says that arguments to a function are evaluated first, and then the function is applied to its arguments. I have implemented an apply function that can accepts a function and list of arguments, and applies the function with the arguments.

Continuations were implemented by following a clear sequence of steps for substitution model, and then separating each step into an explicit continuation that can be stored.

The actual parsing and evaluating of input consisted of the following steps.
User entered code is first tokenized, removing comments and normalizing brackets.
Tokenized input is broken into blocks through the project's recursive code parser.
Blocks are then recursively parsed into native nested arrays (effectively treated as nodes with the first element as a parent and the rest as children), and translated into Racket types or functions through namespace lookup.
While it is being converted into arrays, it is also being evaluated depth-first, effectively reducing the array to one final output when recursion is done.
Evaluation is done through every object having an eval() that accepts arguments, which either returns itself, or in the case of a function or special form, returns the evaluated function result.


###Supported Language Features
* Defining values and functions, lexical scoping (for `local`, `define`, functions, etc) with support for rest arguments 
```
(define a 2)
a ;; -> 2

(define (square n)
  (* n n))
(square 9) ;; -> 81

(define (mystery arg1 . rest-arg)
  (cons (add1 arg1) rest-arg))
(mystery 100 1 2 3 4 5) ;; -> (list 101 1 2 3 4 5)

(local [(define x 5)]
  (local [(define x 6)] x)) ;; -> 6
```
* Lambda (anonymous) functions (`lambda`)
```
((lambda (x) (* x x)) 5) ;; -> 25
```
* Sequencing and implicit `begin`s
```
(define n 
  (begin (print "Assigning 5 to n")
         5)) ;; -> "Assigning 5 to n"
a ;; -> 5

(define  (fn n)
  (printf "~a was passed" n)
  (void))
(fn 0) ;; -> 0 was passed
```
* Lists
```
(append (cons 1 (cons 2 empty))
        (list 3 4 5)
        (list 6)) ;; -> (list 1 2 3 4 5 6)
```
* Higher-order functions: `foldr`,`foldl`,`map`,`filter`,`build-list`,`andmap`,`ormap`,`apply`
```
(foldr + 0 (build-list 100 add1)) ;; -> 5050
(foldr + 0 (build-list 10000 add1)) ;; -> 50005000
```
* Structures (`define-struct`/`struct` and `make-posn`/`posn` (in this case) can be interchanged)
```
(define-struct posn (x y z))
(define triangle (make-posn 3 4 5))
(posn? triangle) ;; -> #t
(posn-x triangle) ;; -> 3
(posn-y triangle) ;; -> 4
(posn-z triangle) ;; -> 5
```
* Simple module `provide`/`require` and uploading (current only supports files 1 at a time)

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
  x ;; -> 5
  y ;; -> 10
  ```
* Allows tail and non-tail recursion to go infinitely, tail recursion is preferred for less memory use
```
(define (sum1 n) ;; Not tail recursive
  (if (>= 0 n)
      0
      (+ n (sum1 (sub1 n)))))
(sum1 5000) ;; -> 12502500
(sum1 10000) ;; -> 50005000

(define (sum2 acc n) ;; Tail recursive
  (if (>= 0 n)
      acc
      (sum2 (+ acc n)
            (sub1 n))))
(sum2 0 5000) ;; -> 12502500
(sum2 0 10000) ;; -> 50005000
(sum2 0 99999) ;; -> 4999950000
(sum2 0 500000) ;; -> 125000250000 ;; Takes a while to finish...
```
* List generators with mutation using `set!`
```
(define (list-generator lst)
  (lambda ()
    (if (empty? lst)
        empty
        (let ([x (car lst)])
          (set! lst (cdr lst))
          x))))

(define gen (list-generator (list 1 2 3)))
(gen) ;; -> 1
(gen) ;; -> 2
(gen) ;; -> 3
(gen) ;; -> empty
```
* Explicit continuations with `call/cc`:
```
(define continuation 0)
(+ 2 
   (+ 3 (call/cc (lambda (l)
                   (set! continuation l) 
                   4)))) ;; -> 9

(continuation 0) ;; -> 5
(continuation 102) ;; -> 107
;; continuation is equivalent to (lambda (n) (+ 2 (+ 3 n)))

;; To illustrate the power of call/cc, consider implementing a traditional 'break' using call/cc
(define (check-prime x) ;; naive prime checker by iterating from 2 .. i .. n-1, when break when i divides n
  (define add2 (lambda (l) (+ 2 l))) ;; reused multiple times
  (cond [(< x 0) #f]
        [(= x 2) #t]
        [else (call/cc (lambda (break)
                         (for-each (lambda (n)
                                     (if (zero? (remainder x n))
                                         (break #f)
                                         (void)))
                                   (build-list (- x 3)
                                               add2))
                         #t))]))
(check-prime 2) ;; -> #t
(check-prime 6) ;; -> #f
(check-prime 7) ;; -> #t
```

###Special Forms
These are the currently implemented special forms:

    (define id bodyexp)
    (define (id args) ... bodyexp)
    (define (((id curry-a) curry-b) curry-c) ... bodyexp)
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
    (begin exp ... final-return-exp)
    (begin0 first-return-exp ... exp)
    (set! id exp)
    (require filename-string ...)
    (provide id ...)
    (when predicate? ... true-final-exp))
    (unless predicate? ... false-final-exp))

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
    assoc
    remove
    remove*
    member
    take
    make-list
    for-each

Other non-list functions were also implemented, but are not discussed here.

###To be Implemented in the Future
I will be adding features as I learn more of the language. These include:
* More special forms and functions as I see fit that are unique to Lisp/Scheme languages

####Remark:
"It's surprising how much work a person can get done during finals week..." (Me, 2014)
