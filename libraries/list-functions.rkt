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

(define (append . rst)
  (cond [(empty? rst) empty]
        [else (foldr cons 
                     (apply append (rest rst)) 
                     (first rst))]))

(define (build-list num fn)
  (local [(define (build-list/acc count fn)
            (cond [(< count num) 
                   (cons (fn count)
                         (build-list/acc (+ 1 count) fn))]
                  [else empty]))]
    (build-list/acc 0 fn)))

(define (reverse lst)
  (foldl cons empty lst))