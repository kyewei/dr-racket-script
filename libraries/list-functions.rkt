(define (filter fn lst)
  (cond [(empty? lst) empty]
        [(fn (first lst))
         (cons (first lst)
               (filter fn (rest lst)))]
        [else (filter fn (rest lst))]))

(define (length lst)
  (local [(define (length/acc lst acc)
            (cond [(empty? lst) acc]
                  [else (length/acc (rest lst)
                                    (+ 1 acc))]))]
    (length/acc lst 0)))

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

(define (foldr fn bse lst . rst)
  (local [(define (unary-foldr fn bse lst)
            (cond [(empty? lst) bse]
                  [else (fn (first lst)
                            (unary-foldr fn bse (rest lst)))]))
          (define (full-foldr fn bse lst . rst)
            (cond [(empty? lst) bse]
                  [else (apply fn 
                               (cons (first lst)
                                     (foldr cons 
                                            (list (apply full-foldr 
                                                         (cons fn 
                                                               (cons bse
                                                                     (cons (rest lst)
                                                                           (map rest rst))))))                                            
                                            (map first rst))))]))]
    (cond [(empty? rst) (unary-foldr fn bse lst)]
          [else (apply full-foldr 
                       (cons fn
                             (cons bse
                                   (cons lst rst))))])))

(define (list-ref lst index)
  (cond [(> index 0) (list-ref (rest lst)
                               (- index 1))]
        [else (first lst)]))

