# MIT Roadmap

A self-study sequence through the free MIT courses behind the Pandas guides, from the Python base to probability, statistics, linear algebra and machine learning, with the archived run, instructors and content of each course and the reason for the order.

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
