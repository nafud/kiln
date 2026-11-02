# MIT Roadmap

A self-study sequence through the free MIT courses behind the Pandas guides, from the Python base to probability, statistics, linear algebra and machine learning, with the term, instructors, content and place of each course, and the pages of this guide it feeds.

---

## The sequence

Every course below is published in full by MIT, free of charge and without enrolment, on [MIT OpenCourseWare](https://ocw.mit.edu/){ .external-link } (OCW) unless the row says otherwise. Lecture videos, notes, problem sets and most solutions are on the course page; the term in the second column is the archived run the page holds, and it is the one to follow, since the materials of one run fit together.

| stage | course | run | gives |
|---|---|---|---|
| 1 | [6.0001 Introduction to Computer Science and Programming in Python](https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/){ .external-link } | Fall 2016, Bell, Grimson, Guttag | The Python base, done through the problem sets. Skipped by anyone who already writes Python daily. |
| 1 | [6.0002 Introduction to Computational Thinking and Data Science](https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/){ .external-link } | Fall 2016, Grimson, Guttag, Bell | Fifteen sessions from optimization and graph models through random walks, Monte Carlo simulation, confidence intervals, sampling and standard error, to clustering, classification and the statistical pitfalls of each. The first course where a model is fitted to data. |
| 2 | [18.05 Introduction to Probability and Statistics](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/){ .external-link } | Spring 2022 | Combinatorics, random variables, Bayesian inference, hypothesis testing, confidence intervals and linear regression, with readings for every class and problem sets with solutions. The studio sessions are in R; redoing them in pandas and SciPy is the exercise. |
| 2 | [18.650 Statistics for Applications](https://ocw.mit.edu/courses/18-650-statistics-for-applications-fall-2016/){ .external-link } | Fall 2016, Rigollet | The theory under 18.05, now with proofs. Maximum likelihood, the method of moments, hypothesis tests, goodness of fit, regression, Bayesian statistics, principal component analysis and generalized linear models. The course that answers "which test, and why". |
| 3 | [18.06 Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/){ .external-link } | Spring 2010, Strang | Vector spaces, projections and least squares, determinants, eigenvalues, symmetric and positive definite matrices, the singular value decomposition. Least squares is regression; the SVD is PCA. |
| 3 | [18.065 Matrix Methods in Data Analysis, Signal Processing, and Machine Learning](https://ocw.mit.edu/courses/18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018/){ .external-link } | Spring 2018, Strang | 18.06 applied to data. The SVD and PCA, weighted least squares, covariance and correlation matrices, matrix factorizations, gradient descent, neural nets and backpropagation, with large matrices in mind. Prerequisite 18.06. |
| 4 | [6.036 Introduction to Machine Learning](https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/){ .external-link } | Fall 2020, Kaelbling, Lozano-Pérez, Chuang, Boning | Machine learning from the modeling and prediction side. Perceptrons, features, logistic regression, gradient descent, neural networks, convolutional and sequential models, recommender systems, decision trees and nearest neighbours, with weekly exercises and labs. Prerequisites 6.0001 and single-variable calculus. |
| 5 | [15.071 The Analytics Edge](https://ocw.mit.edu/courses/15-071-the-analytics-edge-spring-2017/){ .external-link } | Spring 2017, Bertsimas, O'Hair | Linear and logistic regression, trees, clustering, text analytics, missing-data imputation and optimization, each through a real case such as Moneyball or the Framingham Heart Study. Taught in R; the cases are read for the modelling decisions and redone in pandas and scikit-learn. |

Stage 1 is the floor and stage 5 the first course that looks like the job. Stages 2 and 3 can run in parallel; 6.036 expects both.

---

## Why this order

**6.0002 before any statistics.** It teaches the two ideas that every later course assumes, that a simulation can stand in for a formula and that a fitted curve is a hypothesis to be tested on held-out data, and it does so in Python on small problems.

**18.05 before 18.650.** The first course builds the vocabulary, the second proves it. Taken the other way round the proofs have nothing to attach to.

**18.06 before 18.065, and both before 6.036.** Logistic regression, PCA and every neural net in 6.036 are matrix computations. The 18.06 lectures on projections, least squares and the SVD are the minimum; 18.065 is the same material pointed at data and is the better fit for a working data scientist, but it is written for someone who has seen 18.06.

**15.071 last.** It is the only course of the six built around cases rather than methods. Taken first its decisions look arbitrary; taken last each one lands on a method already learned.

---

## What each course feeds here

| guide page | courses behind it |
|---|---|
| [Clean-Up](clean-up.md) | 6.0001 for the Python; 15.071 for imputation and the cost of a dropped row. |
| [Analysis](analysis.md) | 6.0002 for sampling, standard error and confidence intervals; 18.05 for the tests behind a difference between two groups. |
| [Plot](plot.md) | 6.0002 and 15.071 for reading a distribution before trusting a mean. |
| [Model](model.md) | 6.036 for logistic regression, gradient descent and the split; 18.650 for what a coefficient and a p-value mean; 18.06 for least squares. |
| [Walkthrough](walkthrough.md) | All of the above, run on one table. |

---

## Working through a course

- **Read the syllabus and calendar first.** They give the session order and the problem set that belongs to each lecture; the lecture list alone does not.
- **One lecture, its reading, its problem set, then the next.** A lecture watched without the problem set is entertainment. The solutions are posted; the rule is to write the attempt before opening them.
- **Keep the code.** Every problem set that fits a model is a notebook, and the notebook follows the order of the [Walkthrough](walkthrough.md) page, so that the course work and the practice work accumulate in one place.
- **Translate, do not skip, the R.** 18.05 and 15.071 use R for the hands-on parts. The statistics are the same; the translation into pandas, SciPy and scikit-learn is where the methods become usable.
- **The textbooks are optional, except one.** 6.0001 and 6.0002 follow Guttag, *Introduction to Computation and Programming Using Python*, second edition, MIT Press 2016, and the lectures are written to it. Strang's *Linear Algebra and Learning from Data* (Wellesley-Cambridge Press 2019) is the book of 18.065 but the lectures stand alone.

---

## The MITx track

The same ground is taught on edX as the [MITx MicroMasters in Statistics and Data Science](https://micromasters.mit.edu/ds/){ .external-link }, four courses in a fixed order, 6.431x Probability (the science of uncertainty and data), 18.6501x Fundamentals of Statistics, 6.86x Machine Learning with Python, and 14.310x Data Analysis for Social Scientists. Each can be audited free of charge; the graded track, the proctored exams and the credential are paid. 18.6501x is 18.650 by its newer name, and 6.86x covers the 6.036 material in Python with autograded projects. The edX courses run on a calendar with deadlines, which suits some people better than the self-paced OCW archive; the content is the same, so the choice is about pacing, not substance.

---

## What is not here

MIT publishes more. 6.041 Probabilistic Systems Analysis and Applied Probability is a deeper 18.05; 6.867 Machine Learning is the graduate 6.036; 6.S191 Introduction to Deep Learning is a one-week bootcamp on neural nets, published on its own site rather than on OCW. None of them is needed before the five stages above are done, and the five stages are a year of evenings.
