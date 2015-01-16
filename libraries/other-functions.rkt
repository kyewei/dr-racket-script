(define (sub1 n) (- n 1))

(define (add1 n) (+ n 1))

(define (zero? n) (= n 0))

(define (positive? n) (> n 0))

(define (negative? n) (< n 0))

(define (even? num)
  (zero? (modulo num 2)))

(define (odd? num)
  (= 1 (modulo num 2)))

(define (integer? num)
  (zero? (modulo num 1)))

(define (max . rst)
  (foldr (lambda (x y) (cond [(> x y) x]
                             [else y]))
         (first rst)
         rst))

(define (min . rst)
  (foldr (lambda (x y) (cond [(> x y) y]
                             [else x]))
         (first rst)
         rst))

(define (sqr num)
  (* num num))

(define (sgn num)
  (cond [(= num 0) 0]
        [else (/ num (abs num))]))

(define (xor b1 b2)
  (cond [(and b1 (not b2))
         b1]
        [(and b2 (not b1))
         b2]
        [else false]))