# DS Roadmap

A one-year path from no Python, no calculus and no statistics to a data science foundation, built on free MIT courses, with every step linked, dated and tracked.

<div class="kiln-widget" data-widget="ds-roadmap"></div>

Every step below carries a checkbox, and ticking one moves the bars above. A start date typed at the prompt as `YYYY-MM-DD` turns the week numbers into calendar dates and marks the week in progress. The record lives in this browser's local storage and nowhere else, so the `state` line is the backup. Pasted at the prompt of another browser, it restores the record there.

---

## The plan

The year is 52 weeks, 48 of study and 4 of catch-up (weeks 13, 26, 39 and 52), at about 20 hours a week and roughly 970 hours in total. Two tracks run side by side at about 10 hours a week each, one for code and data and one for mathematics, so that each course meets its prerequisites in the week it starts and a bad week in one track does not stall the other. Week numbers are relative, and `W01` is the week the work begins.

| weeks | code and data | mathematics | hours |
|---|---|---|---|
| `W01-12` | 6.100L, all 26 lectures | 18.01SC, units 1 to 3 | 220 |
| `W13` | catch-up | catch-up | |
| `W14-25` | 6.0002, then pandas and Project 1 | 18.01SC units 4 and 5, 18.02SC selected, then SQL | 240 |
| `W26` | catch-up | catch-up | |
| `W27-41` | 18.05 | 18.06SC | 300 |
| `W39` | catch-up | catch-up | |
| `W42-51` | ISLP, then the capstone | 6.036 | 210 |
| `W52` | wrap-up | wrap-up | |

| course | run | weeks | hours |
|---|---|---|---|
| 6.100L Introduction to CS and Programming using Python | MIT OCW, Fall 2022 | `W01-12` | 120 |
| 18.01SC Single Variable Calculus | MIT OCW Scholar, Fall 2010 | `W01-16` | 135 |
| 6.0002 Introduction to Computational Thinking and Data Science | MIT OCW, Fall 2016 | `W14-21` | 80 |
| 18.02SC Multivariable Calculus, selected | MIT OCW Scholar, Fall 2010 | `W17-23` | 65 |
| Python for Data Analysis and Project 1 | McKinney, open edition | `W22-25` | 40 |
| CS50 SQL, weeks 0 to 3 | Harvard | `W24-25` | 20 |
| 18.05 Introduction to Probability and Statistics | MIT OCW, Spring 2022 | `W27-41` | 150 |
| 18.06SC Linear Algebra | MIT OCW Scholar, Fall 2011 | `W27-41` | 150 |
| 6.036 Introduction to Machine Learning, 10 of 13 weeks | MIT Open Learning Library | `W42-51` | 120 |
| An Introduction to Statistical Learning with Python | James, Witten, Hastie, Tibshirani, Taylor | `W42-46` | 40 |
| Capstone | own project | `W47-51` | 50 |

**Verified.** Every course fact on this page was read from the linked official page on 2026-11-11, and quoted text is verbatim. The hours are MIT's own figures where its pages state one (150 hours each for the whole of 18.01SC, 18.02SC and 18.06SC, 12 hours a week for 6.036), scaled to the sessions selected here, and estimates everywhere else.

**Checkpoints.** The exams are the measure of progress. Each is taken closed-book and timed, then corrected against the posted solutions. A score under about 70% sends the unit's problems back for a second pass before the next unit starts.

---

## Phase 1. Python and single-variable calculus

Weeks 1 to 13. The phase ends with the ability to write and debug small Python programs unaided and to differentiate and integrate functions of one variable. Neither course needs the other, and everything after week 13 needs both.

### Setup

The playground is a private repository holding a [uv](https://docs.astral.sh/uv/){ .external-link } project pinned to one Python version and one set of libraries (NumPy, pandas, Matplotlib, seaborn, SciPy, scikit-learn, statsmodels, SymPy, JupyterLab). All course work is committed there.

- `W01`{ data-step=set-01 } uv installed, the playground cloned, `uv sync` run, and `uv run python tools/check_env.py` ending in `environment ok`.
- `W01`{ data-step=set-02 } [Highlights of Calculus](https://ocw.mit.edu/courses/res-18-005-highlights-of-calculus-spring-2010/video_galleries/highlights_of_calculus/){ .external-link }, the five overview videos by Prof. Gilbert Strang, as an optional warm-up before the first calculus session. The stated prerequisite of 18.01SC is high school algebra and trigonometry, and Khan Academy's [Algebra 2](https://www.khanacademy.org/math/algebra2){ .external-link } and [Trigonometry](https://www.khanacademy.org/math/trigonometry){ .external-link } repair either one.

### 6.100L Introduction to CS and Programming using Python

[6.100L](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/){ .external-link } is the Fall 2022 run taught by Dr. Ana Bell, with no prerequisites. The syllabus calls it "a full-semester version of 6.100A (formerly 6.0001 Introduction to Computer Science and Programming in Python)" in which "the material covered is the same, but the pace is slowed down", and states the goal "to give students who have never programmed the time to practice the concepts". It has 26 lectures with video, slides and code, a [finger exercise](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/finger-exercises/){ .external-link } per lecture with solutions, and problem sets 0 to 5, each published on the page of the lecture that hands it out.

The textbook (Guttag, Introduction to Computation and Programming Using Python, third edition) is not free and is not needed to follow the lectures. The [readings](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/readings/){ .external-link } page maps its chapters to the lectures. Each finger exercise is done on the day of its lecture. The course is done when problem sets 1 to 5 are complete and run, written without copying.

- `W01`{ data-step=py-01 } [Lectures 1 and 2](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-1-introduction/){ .external-link }. Introduction, then strings, input and output, branching. PS 0, on the Lecture 1 page.
- `W02`{ data-step=py-02 } [Lectures 3 and 4](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-3-iteration/){ .external-link }. Iteration, loops over strings, guess-and-check, binary. PS 1 started, from the [Lecture 2](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-2-strings-inputoutput-branching/){ .external-link } page.
- `W03`{ data-step=py-03 } [Lectures 5 and 6](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-5-floats-and-approximation-methods/){ .external-link }. Floats, approximation methods, bisection search.
- `W04`{ data-step=py-04 } [Lectures 7 and 8](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-7-decomposition-abstraction-functions/){ .external-link }. Decomposition, abstraction, functions, functions as objects. PS 1 finished.
- `W05`{ data-step=py-05 } [Lectures 9 and 10](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-9-lambda-functions-tuples-and-lists/){ .external-link }. Lambda functions, tuples, lists, mutability. PS 2 started, from the Lecture 9 page.
- `W06`{ data-step=py-06 } [Lectures 11 and 12](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-11-aliasing-cloning/){ .external-link }. Aliasing, cloning, list comprehension, testing, debugging. PS 2 finished.
- `W07`{ data-step=py-07 } [Lectures 13 and 14](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-13-exceptions-assertions/){ .external-link }. Exceptions, assertions, dictionaries. PS 3 started, from the [Lecture 12](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-12-list-comprehension-functions-as-objects-testing-debugging/){ .external-link } page.
- `W08`{ data-step=py-08 } [Lectures 15 and 16](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-15-recursion/){ .external-link }. Recursion, on numbers and on non-numerics. PS 3 finished.
- `W09`{ data-step=py-09 } [Lectures 17 and 18](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-17-python-classes/){ .external-link }. Python classes and class methods. PS 4 started, from the [Lecture 16](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-16-recursion-on-non-numerics/){ .external-link } page.
- `W10`{ data-step=py-10 } [Lectures 19 and 20](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-19-inheritance/){ .external-link }. Inheritance and a worked object-oriented example. PS 4 finished.
- `W11`{ data-step=py-11 } [Lectures 21 to 23](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-21-timing-programs-counting-operations/){ .external-link }. Timing programs, counting operations, big O and theta, complexity classes. PS 5 started, from the [Lecture 20](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-20-fitness-tracker-object-oriented-programming-example/){ .external-link } page.
- `W12`{ data-step=py-12 } [Lectures 24 to 26](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/lecture-24-sorting-algorithms/){ .external-link }. Sorting algorithms, plotting, hashing, simulations. PS 5 finished.

### 18.01SC Single Variable Calculus

[18.01SC](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/){ .external-link } is the OCW Scholar edition of Prof. David Jerison's course, "designed for independent study". Its [syllabus](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/syllabus/){ .external-link } states that "the prerequisites are high school algebra and trigonometry" and that "no textbook is required". Each of its 101 sessions has lecture clips with notes, a recitation video, worked examples and problems, and every problem set and exam comes with solutions. MIT's own figure is "about 150 hours" for the whole course and "an hour or more" per session.

Units 1 to 3 belong to this phase. Every problem is attempted on paper before its solution is opened, and each exam is logged with its score.

- `W01-02`{ data-step=c1-01 } [Unit 1, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/1.-differentiation/part-a-definition-and-basic-rules/){ .external-link }. Sessions 1 to 12. The derivative, limits and continuity, the product, quotient and chain rules.
- `W03-04`{ data-step=c1-02 } [Unit 1, Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/1.-differentiation/part-b-implicit-differentiation-and-inverse-functions/){ .external-link }. Sessions 13 to 20. Implicit differentiation, inverse functions, exponentials and logarithms.
- `W04`{ data-step=c1-03 } [Exam 1](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/1.-differentiation/exam-1/){ .external-link }. Sessions 21 and 22.
- `W05`{ data-step=c1-04 } [Unit 2, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/part-a-approximation-and-curve-sketching/){ .external-link }. Sessions 23 to 28. Linear and quadratic approximation, curve sketching.
- `W06`{ data-step=c1-05 } [Unit 2, Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/part-b-optimization-related-rates-and-newtons-method/){ .external-link }. Sessions 29 to 33. Optimization, related rates, Newton's method.
- `W07`{ data-step=c1-06 } [Unit 2, Part C](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/part-c-mean-value-theorem-antiderivatives-and-differential-equations/){ .external-link }. Sessions 34 to 40. The mean value theorem, antiderivatives, substitution, separable differential equations.
- `W08`{ data-step=c1-07 } [Exam 2](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/exam-2/){ .external-link }. Sessions 41 and 42.
- `W08-09`{ data-step=c1-08 } [Unit 3, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-3-the-definite-integral-and-its-applications/part-a-definition-of-the-definite-integral-and-first-fundamental-theorem/){ .external-link }. Sessions 43 to 50. Riemann sums, the definite integral, the first fundamental theorem.
- `W10-11`{ data-step=c1-09 } [Unit 3, Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-3-the-definite-integral-and-its-applications/part-b-second-fundamental-theorem-areas-volumes/){ .external-link }. Sessions 51 to 59. The second fundamental theorem, areas, volumes.
- `W11-12`{ data-step=c1-10 } [Unit 3, Part C](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-3-the-definite-integral-and-its-applications/part-c-average-value-probability-and-numerical-integration/){ .external-link }. Sessions 60 to 65. Average value, probability, numerical integration, the bell curve.
- `W12`{ data-step=c1-11 } [Exam 3](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-3-the-definite-integral-and-its-applications/exam-3/){ .external-link }. Sessions 66 and 67.

Week 13 is a catch-up week with no new material.

---

## Phase 2. Data tools and multivariable calculus

Weeks 14 to 26. The phase ends with real tabular data handled in pandas and SQL, simulation as a habit of thought, and the multivariable calculus that probability and machine learning use.

### 18.01SC, units 4 and 5

Unit 4 is cut to five sessions. Integration by parts, partial fractions and polar coordinates return in 18.02SC and 18.05, while trigonometric substitution, arc length and surfaces of revolution do not, so those sessions and Exam 4 are skipped. Unit 5 is taken whole, since improper integrals and Taylor series carry into every later course. The cut is this roadmap's, not MIT's, and the final exam is sat with the questions on skipped material left out.

- `W14`{ data-step=c1-12 } Unit 4, sessions 74 and 76 in [Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-4-techniques-of-integration/part-b-partial-fractions-integration-by-parts-arc-length-and-surface-area/){ .external-link } (partial fractions, integration by parts) and sessions 82 to 84 in [Part C](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-4-techniques-of-integration/part-c-parametric-equations-and-polar-coordinates/){ .external-link } (polar coordinates).
- `W15`{ data-step=c1-13 } [Unit 5, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-5-exploring-the-infinite/part-a-lhospitals-rule-and-improper-integrals/){ .external-link }. Sessions 87 to 93. L'Hospital's rule, improper integrals.
- `W16`{ data-step=c1-14 } [Unit 5, Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-5-exploring-the-infinite/part-b-taylor-series/){ .external-link }. Sessions 94 to 101. Infinite series, power series, Taylor series.
- `W16`{ data-step=c1-15 } [Final exam](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/final-exam/){ .external-link }.

### 18.02SC Multivariable Calculus

[18.02SC](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/){ .external-link } is the OCW Scholar edition of Prof. Denis Auroux's course, in the same independent-study format with solutions to its problems and exams. Its prerequisite is 18.01, and MIT's figure is again "about 150 hours" for all 102 sessions.

46 sessions are selected. Vectors and matrices prepare 18.06SC, partial derivatives, the gradient and Lagrange multipliers are the calculus of every loss function in 6.036, and double integrals are what 18.05 needs for joint distributions. Parametric curves, line integrals, Green's theorem and all of unit 4 (triple integrals, flux, the divergence and Stokes' theorems) are vector calculus for physics and are skipped. The selection is this roadmap's, not MIT's.

- `W17`{ data-step=c2-01 } [Unit 1, Part A](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/1.-vectors-and-matrices/part-a-vectors-determinants-and-planes/){ .external-link }. Sessions 1 to 8. Vectors, dot and cross products, determinants, planes.
- `W18`{ data-step=c2-02 } [Unit 1, Part B](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/1.-vectors-and-matrices/part-b-matrices-and-systems-of-equations/){ .external-link }. Sessions 9 to 14. Matrix multiplication, inverses, linear systems.
- `W19`{ data-step=c2-03 } [Unit 2, Part A](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/2.-partial-derivatives/part-a-functions-of-two-variables-tangent-approximation-and-optimization/){ .external-link }. Sessions 24 to 31. Partial derivatives, optimization, least squares, the second derivative test.
- `W20`{ data-step=c2-04 } [Unit 2, Part B](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/2.-partial-derivatives/part-b-chain-rule-gradient-and-directional-derivatives/){ .external-link }. Sessions 32 to 38. The chain rule, the gradient, directional derivatives.
- `W21`{ data-step=c2-05 } [Unit 2, Part C](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/2.-partial-derivatives/part-c-lagrange-multipliers-and-constrained-differentials/){ .external-link }. Sessions 39 to 44. Lagrange multipliers, constrained differentials.
- `W22`{ data-step=c2-06 } [Exam 2](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/2.-partial-derivatives/exam-2/){ .external-link }. Sessions 45 and 46.
- `W22-23`{ data-step=c2-07 } [Unit 3, Part A](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/3.-double-integrals-and-line-integrals-in-the-plane/part-a-double-integrals/){ .external-link }. Sessions 47 to 55. Double integrals, polar coordinates, change of variables.

### 6.0002 Introduction to Computational Thinking and Data Science

[6.0002](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/){ .external-link } is the Fall 2016 run taught by Prof. Eric Grimson, Prof. John Guttag and Dr. Ana Bell, the continuation of 6.0001, whose material 6.100L covers. Its 15 lectures run from optimization and graph models through random walks, Monte Carlo simulation, confidence intervals and sampling to curve fitting, clustering and classification. The [slides and code](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/pages/lecture-slides-and-files/){ .external-link } and the five [problem sets](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/pages/assignments/){ .external-link } are on their own pages.

Two caveats apply. The assignments page states that "solutions for the problems sets are not available", and the course code targets Python 3.5, so a few lines need small repairs on a current interpreter. The split of problem sets across weeks below is this roadmap's. The course is done when all five run.

- `W14`{ data-step=cs-01 } [Lectures 1 and 2](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Optimization problems. PS 1 started.
- `W15`{ data-step=cs-02 } [Lectures 3 and 4](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Graph-theoretic models, stochastic thinking. PS 1 finished.
- `W16`{ data-step=cs-03 } [Lectures 5 and 6](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Random walks, Monte Carlo simulation. PS 2.
- `W17`{ data-step=cs-04 } [Lectures 7 and 8](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Confidence intervals, sampling and standard error. PS 3.
- `W18`{ data-step=cs-05 } [Lectures 9 and 10](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Understanding experimental data.
- `W19`{ data-step=cs-06 } [Lectures 11 and 12](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Introduction to machine learning, clustering. PS 4.
- `W20`{ data-step=cs-07 } [Lectures 13 and 14](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Classification, statistical sins.
- `W21`{ data-step=cs-08 } [Lecture 15](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/video_galleries/lecture-videos/){ .external-link }. Statistical sins and wrap-up. PS 5.

### pandas and Project 1

The text is the open edition of Wes McKinney's [Python for Data Analysis](https://wesmckinney.com/book/){ .external-link }, third edition, "available as an 'Open Access' HTML version". The book "has been updated for pandas 2.0.0 and Python 3.10" and the playground runs pandas 3, so where behaviour differs the [pandas 3.0 release notes](https://pandas.pydata.org/docs/whatsnew/v3.0.0.html){ .external-link } and the official [getting started tutorials](https://pandas.pydata.org/docs/getting_started/intro_tutorials/index.html){ .external-link } decide. The [Pandas](../pandas/index.md) guide on this site holds the idioms in condensed form.

Each chapter's examples are retyped, then repeated on a dataset from one's own field. Project 1 closes the block with an exploratory analysis of one such dataset, loaded, cleaned, summarised and plotted, ending in five findings a colleague could act on and no model. A labelled network-flow set such as [CIC-IDS2017](https://www.unb.ca/cic/datasets/ids-2017.html){ .external-link } fits.

- `W22`{ data-step=pd-01 } [Chapter 4](https://wesmckinney.com/book/numpy-basics.html){ .external-link }, NumPy Basics, and [chapter 5](https://wesmckinney.com/book/pandas-basics.html){ .external-link }, Getting Started with pandas.
- `W23`{ data-step=pd-02 } [Chapter 6](https://wesmckinney.com/book/accessing-data.html){ .external-link }, Data Loading, Storage, and File Formats, and [chapter 7](https://wesmckinney.com/book/data-cleaning.html){ .external-link }, Data Cleaning and Preparation.
- `W24`{ data-step=pd-03 } [Chapter 8](https://wesmckinney.com/book/data-wrangling.html){ .external-link }, Data Wrangling, and [chapter 10](https://wesmckinney.com/book/data-aggregation.html){ .external-link }, Data Aggregation and Group Operations.
- `W25`{ data-step=pd-04 } [Chapter 9](https://wesmckinney.com/book/plotting-and-visualization.html){ .external-link }, Plotting and Visualization, with the [Matplotlib quick start](https://matplotlib.org/stable/users/explain/quick_start.html){ .external-link } and the [seaborn tutorial](https://seaborn.pydata.org/tutorial.html){ .external-link } as references.
- `W25`{ data-step=pd-05 } Project 1, committed with its five findings.

### SQL

[CS50's Introduction to Databases with SQL](https://cs50.harvard.edu/sql/){ .external-link } is Harvard's free course, a lecture and a problem set per week, starting on SQLite. Weeks 0 to 3 are taken here, in the same fortnight as chapters 8 and 10 of the pandas book, because a join and a group-by are the same idea in both languages. Weeks 4 to 6 (viewing, optimizing, scaling) are optional.

- `W24`{ data-step=sq-01 } [Week 0](https://cs50.harvard.edu/sql/weeks/0/){ .external-link }, Querying, and [week 1](https://cs50.harvard.edu/sql/weeks/1/){ .external-link }, Relating.
- `W25`{ data-step=sq-02 } [Week 2](https://cs50.harvard.edu/sql/weeks/2/){ .external-link }, Designing, and [week 3](https://cs50.harvard.edu/sql/weeks/3/){ .external-link }, Writing.

Week 26 is a catch-up week with no new material.

---

## Phase 3. Probability, statistics and linear algebra

Weeks 27 to 41, with week 39 for catch-up. These are the two mathematical pillars under every model. The phase is the heaviest of the four at about 21 hours a week and the one that most repays care.

### 18.05 Introduction to Probability and Statistics

[18.05](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/){ .external-link } is the Spring 2022 run taught by Dr. Jeremy Orloff and Dr. Jennifer French Kamrin, with 18.02 as its prerequisite. It has no lecture videos. Each class has a reading from the course's own notes (the syllabus assigns no textbook), slides, in-class problems and their solutions, all on the [classes](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link } page. The reading comes first and the in-class problems are worked before their solutions are opened. The 11 [problem sets](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/problem-sets/){ .external-link } and the three [exams](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/exams/){ .external-link } have solutions, and the [Open Learning Library edition](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+18.05r_10+2022_Summer/about){ .external-link } adds online reading questions and answer checkers for the problem sets, free and usable without enrolling.

The course computes in R, in ten weekly [studios](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/studio-resources/){ .external-link } and in some problem-set questions. Here those parts are done in Python with NumPy and `scipy.stats`, and the numbers are compared with the posted R solutions. The translation is slower than following along in R, and it is the practice that carries over. One course week is taken per study week, following the course [calendar](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/calendar/){ .external-link }. Class 9 is Exam 1 and class 25 was an in-class R quiz, so neither appears below as a reading.

- `W27`{ data-step=st-01 } [Classes 1 and 2](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Counting, probability basics. Studio 1.
- `W28`{ data-step=st-02 } [Classes 3 and 4](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Conditional probability, independence, Bayes' theorem, discrete random variables, expected value. PS 1, studio 2.
- `W29`{ data-step=st-03 } [Classes 5a and 5b](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Variance, continuous random variables. PS 2, studio 3.
- `W30`{ data-step=st-04 } [Classes 6a and 6b](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Expected value and variance of continuous variables, the law of large numbers, the central limit theorem. PS 3.
- `W31`{ data-step=st-05 } [Classes 7 and 8](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Joint distributions, covariance, correlation, review. PS 4, studio 4.
- `W32`{ data-step=st-06 } [Exam 1](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/exams/){ .external-link }, then class 10. Likelihood and maximum likelihood estimates. PS 5.
- `W33`{ data-step=st-07 } [Classes 11 and 12](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Bayesian updating with discrete priors, predictive probabilities, odds. PS 6, studio 5.
- `W34`{ data-step=st-08 } [Classes 13 to 15](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Continuous priors, beta distributions, conjugate priors. Studio 6.
- `W35`{ data-step=st-09 } [Classes 16 and 17](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Choosing priors, probability intervals, significance testing, the z-test. PS 7, studio 7.
- `W36`{ data-step=st-10 } [Classes 18 and 19](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. t-tests, chi-square tests, ANOVA. PS 8, studio 8.
- `W37`{ data-step=st-11 } [Classes 20 and 22](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Bayesian and frequentist inference compared, confidence intervals. PS 9, studio 9.
- `W38`{ data-step=st-12 } Class 21, the review, then [Exam 2](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/exams/){ .external-link }. Studio 10.
- `W40`{ data-step=st-13 } [Classes 23 and 24](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Confidence intervals continued, bootstrap confidence intervals. PS 10.
- `W41`{ data-step=st-14 } [Classes 26 and 27](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Linear and multiple regression, review. PS 11, then the [final exam](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/exams/){ .external-link }.

### 18.06SC Linear Algebra

[18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/){ .external-link } is the OCW Scholar edition of Prof. Gilbert Strang's course, "designed for independent study", with a lecture video and summary per session, a recitation video on every topic, and problems, three exams and a final with solutions. Its [syllabus](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/syllabus/){ .external-link } states that 18.02 "is a formal prerequisite for MIT students wishing to enroll in 18.06 Linear Algebra, but knowledge of calculus is not required to learn the subject", and asks only for comfort "with vectors, matrices, and three-dimensional coordinate systems", which unit 1 of 18.02SC supplies. Readings in Strang's Introduction to Linear Algebra are suggested for further study, and the book is neither free nor needed. MIT's figure is "about 150 hours".

Nothing is trimmed. Least squares is regression, eigenvectors and the singular value decomposition are principal component analysis, and positive definiteness is what makes an optimum a minimum. Session numbers below count the lecture sessions inside a unit in the order its page lists them.

- `W27`{ data-step=la-01 } [Unit I](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/ax-b-and-the-four-subspaces/){ .external-link }, sessions 1 to 3. The geometry of linear equations, an overview of key ideas, elimination with matrices.
- `W28`{ data-step=la-02 } Unit I, sessions 4 to 6. Multiplication and inverse matrices, factorization into A = LU, transposes, permutations, vector spaces.
- `W29`{ data-step=la-03 } Unit I, sessions 7 to 9. Column space and nullspace, solving Ax = 0, solving Ax = b.
- `W30`{ data-step=la-04 } Unit I, sessions 10 to 12. Independence, basis and dimension, the four fundamental subspaces, matrix spaces.
- `W31`{ data-step=la-05 } Unit I, session 13. Graphs, networks, incidence matrices. Then the review and Exam 1.
- `W32`{ data-step=la-06 } [Unit II](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/least-squares-determinants-and-eigenvalues/){ .external-link }, sessions 1 to 3. Orthogonal vectors and subspaces, projections onto subspaces, projection matrices and least squares.
- `W33`{ data-step=la-07 } Unit II, sessions 4 to 6. Orthogonal matrices and Gram-Schmidt, properties of determinants, determinant formulas and cofactors.
- `W34`{ data-step=la-08 } Unit II, sessions 7 to 9. Cramer's rule, eigenvalues and eigenvectors, diagonalization and powers of A.
- `W35`{ data-step=la-09 } Unit II, sessions 10 and 11. Differential equations and exp(At), Markov matrices. Then the review and Exam 2.
- `W36`{ data-step=la-10 } [Unit III](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/){ .external-link }, sessions 1 to 3. Symmetric matrices and positive definiteness, complex matrices, positive definite matrices and minima.
- `W37`{ data-step=la-11 } Unit III, sessions 4 and 5. Similar matrices and Jordan form, the singular value decomposition.
- `W38`{ data-step=la-12 } Unit III, sessions 6 to 8. Linear transformations and their matrices, change of basis, left and right inverses and the pseudoinverse.
- `W40`{ data-step=la-13 } Unit III, the review and Exam 3.
- `W41`{ data-step=la-14 } The [final course review](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/final-course-review/){ .external-link } and the [final exam](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/final-exam/){ .external-link }.

---

## Phase 4. Machine learning and capstone

Weeks 42 to 52. The phase ends with an understanding of how the standard models work, the habit of using them through scikit-learn, and one project that proves both.

### 6.036 Introduction to Machine Learning

[6.036](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/about){ .external-link } lives on the MIT Open Learning Library, and its [OCW page](https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/){ .external-link } (Fall 2020, Prof. Leslie Kaelbling, Prof. Tomás Lozano-Pérez, Prof. Isaac Chuang, Prof. Duane Boning) only points there. The course is free, "includes lectures, lecture notes, exercises, labs, and homework problems", and can be used without enrolling, though a free account keeps the answers. It recommends "Computer programming (python); Calculus; Linear Algebra" and estimates 12 hours a week for 13 weeks. It issues no certificate.

Ten of the 13 weeks are taken, one per study week. Weeks 9 to 11 (state machines and Markov decision processes, reinforcement learning, recurrent neural networks) are self-contained and not needed for tabular data, so they are skipped. The selection is this roadmap's, not MIT's. Every step below opens the same [course outline](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }.

- `W42`{ data-step=ml-01 } [Week 1](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Basics. Introduction to machine learning, linear classifiers.
- `W43`{ data-step=ml-02 } [Week 2](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Perceptrons.
- `W44`{ data-step=ml-03 } [Week 3](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Features.
- `W45`{ data-step=ml-04 } [Week 4](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Margin maximization. Logistic regression, gradient descent.
- `W46`{ data-step=ml-05 } [Week 5](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Regression.
- `W47`{ data-step=ml-06 } [Week 6](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Neural networks I.
- `W48`{ data-step=ml-07 } [Week 7](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Neural networks II.
- `W49`{ data-step=ml-08 } [Week 8](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Convolutional neural networks.
- `W50`{ data-step=ml-09 } [Week 12](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Recommender systems.
- `W51`{ data-step=ml-10 } [Week 13](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }. Decision trees and nearest neighbors.

### An Introduction to Statistical Learning with Python

[An Introduction to Statistical Learning](https://www.statlearning.com/){ .external-link } by James, Witten, Hastie, Tibshirani and Taylor is free as a PDF from its own site, in the Python edition published in 2023, with a [lab](https://github.com/intro-stat-learning/ISLP_labs/tree/stable){ .external-link } closing each chapter. 6.036 builds the algorithms. This book teaches how to judge a model honestly (validation, bias against variance, regularization), and its labs are where scikit-learn and statsmodels become habit, with the scikit-learn [getting started](https://scikit-learn.org/stable/getting_started.html){ .external-link } page and [user guide](https://scikit-learn.org/stable/user_guide.html){ .external-link } as the reference.

Each chapter is read, then its lab is run. The labs use the `ISLP` package, which pins its own dependency versions and therefore gets an environment of its own.

- `W42`{ data-step=is-01 } Chapter 2, Statistical Learning, and chapter 3, Linear Regression.
- `W43`{ data-step=is-02 } Chapter 4, Classification.
- `W44`{ data-step=is-03 } Chapter 5, Resampling Methods. Cross-validation and the bootstrap.
- `W45`{ data-step=is-04 } Chapter 6, Linear Model Selection and Regularization.
- `W46`{ data-step=is-05 } Chapter 8, Tree-Based Methods.

### Capstone

One end-to-end project on data from one's own field, where a forensic and malware background tells a meaningful feature from a leaky one. The suggested subject is static malware detection on [EMBER2024](https://github.com/FutureComputing4AI/EMBER2024){ .external-link }, which holds features and labels for about 3.2 million malicious and benign files across Win32, Win64, .NET, APK, ELF and PDF under Apache-2.0, on a subsample that fits in memory.

Whatever the subject, the question is stated before the data is opened, the test set is newer than the training set, a trivial baseline is scored first, at least two model families are compared by cross-validation, and the report states what the model cannot do.

- `W47`{ data-step=cp-01 } The question, the data and a split that respects time.
- `W48`{ data-step=cp-02 } Exploration and the baseline.
- `W49`{ data-step=cp-03 } Models and cross-validation.
- `W50`{ data-step=cp-04 } Error analysis.
- `W51`{ data-step=cp-05 } The report.

Week 52 closes the year with the report finished and a retrospective written.

---

## Why this order

**6.100L, not 6.0001.** The material is the same. 6.100L is the full-semester pace MIT built for students who have never programmed.

**Scholar editions for the mathematics.** 18.01SC, 18.02SC and 18.06SC are the editions designed for independent study, with recitation videos and solutions to everything. Without a teacher, solutions are the feedback loop.

**6.0002 before any statistics.** It teaches simulation as a way of thinking and gives confidence intervals and overfitting a first intuitive pass before 18.05 makes them exact.

**18.02SC before 18.05, and 18.06SC before 6.036.** 18.05 lists 18.02 as its prerequisite, and 6.036 recommends calculus and linear algebra. Logistic regression, gradient descent and neural networks are matrix calculus.

**18.05 for statistics.** It covers probability, Bayesian and frequentist inference, the bootstrap and regression in one term, which is the statistical toolbox the work uses.

**ISLP beside 6.036, and the capstone last.** One course explains how the models work and the other how to use and judge them. A project is where the remaining gaps show.

---

## Left out

The year is not overloaded on purpose. Each omission below is deliberate.

| left out | reason |
|---|---|
| 18.01SC unit 4, except five sessions | Integration techniques that no later course uses. |
| 18.02SC unit 1 part C, unit 3 parts B and C, unit 4 | Vector calculus for physics. |
| 6.036 weeks 9 to 11 | Sequential models and reinforcement learning, not needed for tabular data. |
| A second statistics course (18.650) | The proofs under 18.05. Year two. |
| Deep learning beyond 6.036 | Weeks 6 to 8 of 6.036 are the foundation. Frameworks are a specialisation. |
| Spark, cloud platforms, MLOps | Tools learned on the job once the foundation exists. |
| R | 18.05 uses it. Python covers the same ground. |

When the schedule slips past the four catch-up weeks, cuts come in this order. ISLP chapters 6 and 8, then 6.036 weeks 12 and 8, then CS50 SQL weeks 2 and 3, then 6.0002 lectures 1 to 3 with PS 1 and PS 2. The 6.100L problem sets, 18.01SC units 1 to 3, 18.02SC unit 2, 18.05 and 18.06SC are never cut. If the weekly load is too high, the calendar stretches and the foundation stays whole.

---

## After the year

The next courses, in rough order of use, are [18.650 Statistics for Applications](https://ocw.mit.edu/courses/18-650-statistics-for-applications-fall-2016/){ .external-link } for the theory under 18.05, [18.065 Matrix Methods in Data Analysis, Signal Processing, and Machine Learning](https://ocw.mit.edu/courses/18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018/){ .external-link } for linear algebra pointed at data, the skipped weeks 9 to 11 of 6.036, [6.S191 Introduction to Deep Learning](https://introtodeeplearning.com/){ .external-link }, [15.071 The Analytics Edge](https://ocw.mit.edu/courses/15-071-the-analytics-edge-spring-2017/){ .external-link } for case-driven modelling, and [RES.6-012 Introduction to Probability](https://ocw.mit.edu/courses/res-6-012-introduction-to-probability-spring-2018/){ .external-link } for deeper probability. The [MIT Roadmap](../pandas/mit-roadmap.md) page describes several of them.

---

## Sources

Every page below was read on 2026-11-11. MIT OpenCourseWare is free, needs no enrolment, grants no credit or certificate, and is licensed CC BY-NC-SA. The MIT Open Learning Library is free with optional enrolment.

| source | used for |
|---|---|
| [MIT OCW 6.100L, Fall 2022](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/){ .external-link } | Python |
| [MIT OCW 18.01SC, Fall 2010](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/){ .external-link } | Single-variable calculus |
| [MIT OCW 18.02SC, Fall 2010](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/){ .external-link } | Multivariable calculus |
| [MIT OCW 6.0002, Fall 2016](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/){ .external-link } | Computational thinking, simulation |
| [MIT OCW 18.05, Spring 2022](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/){ .external-link } | Probability and statistics |
| [MIT OLL 18.05](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+18.05r_10+2022_Summer/about){ .external-link } | Reading questions, answer checkers |
| [MIT OCW 18.06SC, Fall 2011](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/){ .external-link } | Linear algebra |
| [MIT OLL 6.036](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/about){ .external-link } | Machine learning |
| [MIT OCW RES.18-005, Spring 2010](https://ocw.mit.edu/courses/res-18-005-highlights-of-calculus-spring-2010/){ .external-link } | Calculus warm-up |
| [MIT OCW terms of use](https://ocw.mit.edu/pages/privacy-and-terms-of-use/){ .external-link } | Licence |
| [Python for Data Analysis, 3rd edition](https://wesmckinney.com/book/){ .external-link } | pandas |
| [An Introduction to Statistical Learning](https://www.statlearning.com/){ .external-link } | Applied machine learning |
| [CS50's Introduction to Databases with SQL](https://cs50.harvard.edu/sql/){ .external-link } | SQL |
| [pandas documentation](https://pandas.pydata.org/docs/){ .external-link } | Reference |
| [scikit-learn documentation](https://scikit-learn.org/stable/){ .external-link } | Reference |
| [NumPy, the absolute basics for beginners](https://numpy.org/doc/stable/user/absolute_beginners.html){ .external-link } | Reference |
| [The Python Tutorial](https://docs.python.org/3/tutorial/index.html){ .external-link } | Reference |
| [uv documentation](https://docs.astral.sh/uv/){ .external-link } | Environment |
| [The Missing Semester of Your CS Education](https://missing.csail.mit.edu/){ .external-link } | Shell and git, if a gap shows |
