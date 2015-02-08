#lang racket

;; List Things
(define (filter fn lst)
  (cond [(empty? lst) empty]
        [(fn (first lst))
         (cons (first lst)
               (filter fn (rest lst)))]
        [else (filter fn (rest lst))]))

(define (map fn lst . rst)
  (local [(define (unary-map fn lst)
            (cond [(empty? lst) empty]
                  [else (cons (fn (first lst))
                              (unary-map fn (rest lst)))]))
          (define (full-map fn lst . rst)
            (cond [(empty? lst) empty]
                  [else (cons (apply fn (cons (first lst)
                                              (unary-map first rst)))
                              (apply full-map (cons fn
                                                    (cons (rest lst)
                                                          (unary-map rest rst)))))]))]
    (cond [(empty? rst) (unary-map fn lst)]
          [else (apply full-map
                       (cons fn
                             (cons lst rst)))])))

(define (andmap fn lst . rst)
  (local [(define (unary-andmap lst)
            (cond [(empty? lst) true]
                  [else (local [(define fn-rslt (fn (first lst)))]
                          (cond [(not fn-rslt) false]
                                [else (unary-andmap (rest lst))]))]))
          (define (full-andmap lst . rst)
            (cond [(empty? lst) true]
                  [else (local [(define fn-rslt (apply fn (cons (first lst)
                                                                (map first rst))))]
                          (cond [(not fn-rslt) false]
                                [else (apply full-andmap (cons (rest lst)
                                                               (map rest rst)))]))]))]
    (cond [(empty? rst) (unary-andmap lst)]
          [else (apply full-andmap
                       (cons lst rst))])))

(define (ormap fn lst . rst)
  (local [(define (unary-ormap lst)
            (cond [(empty? lst) false]
                  [else (local [(define fn-rslt (fn (first lst)))]
                          (cond [fn-rslt true]
                                [else (unary-ormap (rest lst))]))]))
          (define (full-ormap lst . rst)
            (cond [(empty? lst) false]
                  [else (local [(define fn-rslt (apply fn (cons (first lst)
                                                                (map first rst))))]
                          (cond [fn-rslt true]
                                [else (apply full-ormap (cons (rest lst)
                                                              (map rest rst)))]))]))]
    (cond [(empty? rst) (unary-ormap lst)]
          [else (apply full-ormap
                       (cons lst rst))])))

(define (foldr fn bse lst . rst)
  (local [(define (unary-foldr lst)
            (cond [(empty? lst) bse]
                  [else (fn (first lst)
                            (unary-foldr (rest lst)))]))
          (define (full-foldr lst . rst)
            (cond [(empty? lst) bse]
                  [else (apply fn
                               (cons (first lst)
                                     (append (map first rst)
                                             (list (apply full-foldr
                                                          (cons (rest lst)
                                                                (map rest rst)))))))]))]
    (cond [(empty? rst) (unary-foldr lst)]
          [else (apply full-foldr
                       (cons lst rst))])))

(define (foldl fn bse lst . rst)
  (local [(define (unary-foldl lst)
            (local [(define (unary-foldl/acc acc lst)
                      (cond [(empty? lst) acc]
                            [else (unary-foldl/acc (fn (first lst)
                                                       acc)
                                                   (rest lst))]))]
              (unary-foldl/acc bse lst)))
          (define (full-foldl lst . rst)
            (local [(define (full-foldl/acc acc lst . rst)
                      (cond [(empty? lst) acc]
                            [else (apply full-foldl/acc
                                         (cons (apply fn
                                                      (cons (first lst)
                                                            (append (map first rst)
                                                                    (list acc))))
                                               (cons (rest lst)
                                                     (map rest rst))))]))]
              (apply full-foldl/acc (cons bse
                                          (cons lst rst)))))]
    (cond [(empty? rst) (unary-foldl lst)]
          [else (apply full-foldl
                       (cons lst rst))])))

(define (list-ref lst index)
  (cond [(> index 0) (list-ref (rest lst)
                               (- index 1))]
        [else (first lst)]))

(define (list-tail lst index)
  (cond [(> index 0) (list-tail (rest lst)
                                (- index 1))]
        [else lst]))

(define (append . rst)
  (cond [(empty? rst) empty]
        [else (foldr cons
                     (apply append (rest rst))
                     (first rst))]))

(define (build-list num fn)
  (local [(define (build-list/acc count acc)
            (cond [(< count 0) acc]
                  [else (build-list/acc (sub1 count)
                                        (cons (fn count)
                                              acc))]))]
    (build-list/acc (sub1 num) empty)))

(define (flatten lst)
  (cond [(empty? lst) empty]
        [(cons? lst)
         (append (flatten (first lst))
                 (flatten (rest lst)))]
        [else (list lst)]))

(define (reverse lst)
  (foldl cons empty lst))

(define (second lst) (list-ref lst 1))

(define (third lst) (list-ref lst 2))

(define (fourth lst) (list-ref lst 3))

(define (fifth lst) (list-ref lst 4))

(define (sixth lst) (list-ref lst 5))

(define (seventh lst) (list-ref lst 6))

(define (eighth lst) (list-ref lst 7))

(define (ninth lst) (list-ref lst 8))

(define (tenth lst) (list-ref lst 9))

(define null? empty?)

(define car first)

(define cdr rest)

(define cadr second)

(define caddr third)

(define cadddr fourth)

(define (cddr lst) (list-tail lst 2))

(define (cdddr lst) (list-tail lst 3))

(define (cddddr lst) (list-tail lst 4))

(define (member elem lst)
  (cond [(empty? lst) false]
        [(equal? elem (first lst))
         lst]
        [else (member elem (rest lst))]))

(define (remove elem lst)
  (cond [(empty? lst) empty]
        [(equal? elem (first lst))
         (rest lst)]
        [else (cons (first lst)
                    (remove elem (rest lst)))]))

(define (remove* elems lst)
  (filter (lambda (x)
            (not (list? (member x elems))))
          lst))

(define (assf fn al)
  (cond [(empty? al) false]
        [(fn (first (first al)))
         (first al)]
        [else (assf fn (rest al))]))

(define (assoc obj al . fn)
  (cond [(empty? fn)
         (cond [(empty? al) false]
               [(equal? obj (first (first al)))
                (first al)]
               [else (assoc obj (rest al))])]
        [else (assf (lambda (x) ((first fn) obj x))
                    al)]))

(define drop list-tail)

(define (take lst pos)
  (cond [(empty? lst) empty]
        [(<= pos 0) empty]
        [else (cons (first lst)
                    (take (rest lst)
                          (sub1 pos)))]))

(define (make-list k v)
  (build-list k (lambda (x) v)))

(define (last lst)
  (cond [(empty? (rest lst)) (first lst)]
        [else (last (rest lst))]))
