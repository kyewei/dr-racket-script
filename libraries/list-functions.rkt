(define (foldr fn bse lst)
  (cond [(empty? lst) bse]
        [else (fn (first lst)
                  (foldr fn bse (rest lst)))]))

(define (filter fn lst)
  (cond [(empty? lst) empty]
        [(fn (first lst))
         (cons (first lst)
               (filter fn (rest lst)))]
        [else (filter fn (rest lst))]))
