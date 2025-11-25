
# Linear Algebra

An implementation of linear algebra over a field F. We build matrices and vectors out of elements of this field, but are careful not to assume anything about the 
underlying structure of the field: only that it has the required methods

**.clone() .add() .sub() .mul() .inv() .div()**

In this way we can use the same linear algebra class for lots of problems (even standard linear algebra; if we 
implement the field of Floating Point Numbers!)

**Why in the world?!** Why are we doing this?  All the fields we care about are subfields of R after all, so 
we could just use floating point arithmetic in the components of our vector spaces.  But in many situations we know 
that everything in our problem actually lives in an *extremely small* field inside of R, where exact arithmetic is 
possible, just as it is in Z or Q.  So, the payout of writing all the Linear Algebra classes with this level of 
generality is we can import this whole system to any project where we need exact arithmetic, construct the 
appropriate field, and be good to go.

## Vector3

A Vector3 is an array of three field elements.  The constructor takes three field elements (otherwise sets the
entries to undefined)

**new Vector( Real.one, Real.zero, new Real(13.23))**

Vectors implement the standard vector space operations, leaving the 
originals immutable and returning a new copy 
with the resulting calculation.   That is a.add(b) does not modify a or b but returns a+b as a new Vector3. This 
class has getter and setter functions to read and mutate the value of the object when needed:

- **.set(f1,f2,f3)**: set the value with three field elements
- **.x, .y, .z**: get and set individual values
- **.clone()**: make a copy of the current vector

It implements the standard Vector space arithmetic over the base field of its entries

- **.add(v)**: add vector v
- **.sub(v)**: subtract vector v
- **.scale(f)**: scale by a field element

It also knows about the action of M(3x3,F): (the name comes from THREE.js, we can change it as we are not trying to 
be compatible), and the cross product

- **.applyMatrix3(M)**: return the result of v->Mv
- **.cross(v)**: returns the (Euclidean) cross product this x v

Vectors have methods to output their entries, either to vectors over R (by embedding the abstract field in R, when 
possible) or to legible strings 

- **.realEmbedding()**: sends each component to a floating point number, using the specified .realEmbedding() for the 
  underlying field.
- **.prettyPrint()**: prints the vector as an array of length 3, using prettyPrint of the field.

## Matrix3

A Matrix3 is stored internally (and called via constructor) as three Vector3 objects: these are the columns of the 
matrix:

**new Matrix3(
new Vector3(...),
new Vector3(...),
new Vector3(...),
)**

The operations of the matrix class are generally immutable, returning new Matrix3 objects containing the result of 
the computation.  To access or mutate the contents of an existing Matrix3, there are set and element wise methods

- **.set(c1,c2,c3)**: sets the current matrix to the given three columns
- **.entry(i,j)** returns the ijth entry of the matrix. Note this is the standard index ordering, so i is the row in 
  the matrix and j is the column.
- **.clone()** creates an independent copy of the current matrix.

The Matrix3 class implements the linear algebra structure of M(3x3,F)

- **.add(M)** returns the sum of the current matrix and M
- **.sub(M)** returns the difference of the current matrix and M
- **.scale(r)** returns the scalar multiple of the current matrix by a field element

It also implements the group structure of M(3x3,F):

- **.rightMul(M)**: A.rightMul(B) returns the matrix product AB
- **.leftMul(M)**: A.leftMul(B) returns the matrix product BA
- **.invert()**: returns the inverse of the current matrix
- **.identity(Field)**: static factory that returns the identity matrix over the given field
- **.conj(C)** returns the result of M-> CMC^{-1}

The class Matrix3 computes some elementary quantities relating the underlying vector space and its dual

- **.det()** the determinant, in the underlying field
- **.transpose()** the transpose of the current matrix

It also has analogs of the extensions from Field and Vector3 to convert these matrices to real numbers and make them 
readable:

- **.realEmbedding()** runs the real embedding on each field element, returning a column-major array of floating 
  point numbers.
- **.prettyPrint()** prints a 3x3 array of numbers, using prettyPrint on each field element.


## Inner Product 

An inner product captures the geometry of a vector space, via an quadratic form.
This is given in code as a real symmetric matrix B.

**new InnerProduct(B)**

This inner product is a 'computer' that can do any geometric calculations which can be phrased solely in terms of 
linear algebra.  The most important of these is the B-dot product (v,w)_B = v^TBw

- **.dot(v,w)** returns the B dot product of v and w (as a Field element, of the field they both are defined over)
- **.norm2(v)** directly returns .dot(v,v)
- **.cos2(v,w)** returns space.dot(v,w)^2/space.dot(v,v)*space.dot(w,w) - the square of the usual expression 
  defining the cosine of the angle between two vectors

As we have restricted ourselves to 3 dimensions, there is a version of the cross product: the metric B sets up an 
isomorphism between V and its dual as well as a volume form, and this induces a Hodge Star operator on the 
alternating algebra over V*.  The cross product is the Hodge dual of the wedge product (with appropriate musical 
isomorphisms): which in coordinates becomes remarkably simple (u,v)->(Bu)x(Bv)

- **.cross(u,v)** returns the Euclidean cross product of Bu and Bv.

Inner products are also crucial to defining reflections and projections in linear algebra, so this class implements 
methods to produce the matrices of such transformations

- **.reflectIn(n)** returns the Matrix3 that reflects in the given normal vector (orthogonally with respect to B)
- **.projectOnto(v)** returns the matrix that projects orthogonally (w.r.t B) onto the span of v

Certain familiar quantities in the geometry of *complete* vector spaces dont carry over to our level of generality, 
where the relatively small fields we are working with may not have square roots, and certainly dont posess 
transcendental functions like arccosine.  Because of this, we do not have the ability to actually compute the *norm* 
of a vector, or the *angle* between two of them while guaranteeing we stay in the Field.

Our solution is to implement *real* versions of these functions, that output a *Real()* element instead of the 
original base field, using the provided *.realEmbedding()*.  These are named to remind us of this

- **.realNorm(v)**
- **.realAngle(v,w)**

Note that realNorm isn't even technically defined for signature (2,1) forms: as then norm squares can be negative 
and the reals don't have square roots of negative numbers.  So *realNorm* returns the common abuse of notation: the 
square root of the *absolute value* of the norm square.

Also note that *realAngle* is only relevant when the form *B* is signature (3,0), like the Euclidean metric.
When the form is signature (2,1) we instead have a *realDistance* function that is well defined for vectors of 
negative norm square:

**.realDist(v,w)**

This measures the hyperbolic distance between the vectors v and w with respect to the hyperbolic metric induced on 
the 2 sheeted hyperboloids by B.  Note just like measuring angle in Euclidean geometry doesn't require vectors of 
the same length (as we just use *cos(ang)=do(v,w)/norm(v)norm(w)*), the vectors *v* and *w* don't have to lie on the 
same hyperboloid for the distance formula to work! Here's the definition:

space.realDist(v,w)=arccosh(space.dot(v,w).realEmbedding()/(space.realNorm(v)*space.realNorm(w)))


Using Grahm Schmidt over our field the quadratic form B can be orthogonally diagonalized.  But over the Reals (using 
norms and square roots) we can do something much more useful: we can also scale things duirng the diagonalization to 
put the inner product in a standard form: either *diag(1,1,1)* when signature (3,0) or *diag(1,1,-1)* when siganture 
(2,1).

**.realDiagonalize()**

performs this calcualtion and returns a Real matrix *C* such that *C^T BC* is standardized.  This is very useful in 
trying to draw nice pictures, as given whatever points we compute with B, applying C puts them in 'standard form' 
(say, onto the standard hyperboloid, from which we can easily project to the poincare disk).
