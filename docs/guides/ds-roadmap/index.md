# DS Roadmap

A 26-week path to interview-ready data science for a programmer whose Python is rusty and whose statistics is new, built on free MIT courses and a LeetCode set every week, with every step linked and tickable.

<div class="kiln-widget" data-widget="ds-roadmap" hidden></div>

## The plan

The plan is 26 weeks at 15 to 16 hours a week, about 370 hours in total. A week holds three to four lectures or chapters, one LeetCode set, and the topics the week leaves behind, and from week 5 most weeks add two or three short videos. Weeks 13 and 26 are catch-up weeks. Week numbers are relative, and week 1 is the week the work begins.

| course | run | weeks | hours |
|---|---|---|---|
| The Python Tutorial, chapters 3 to 9, and two reference pages | python.org | 1 to 2 | 6.5 |
| 18.01SC Single Variable Calculus, 20 of 101 sessions | MIT OCW Scholar, Fall 2010 | 1 to 3 | 20 |
| 18.02SC Multivariable Calculus, 13 of 102 sessions | MIT OCW Scholar, Fall 2010 | 4, 7, 14 | 13 |
| CS50 SQL, weeks 0 and 1 | Harvard | 3 to 4 | 8 |
| Python for Data Analysis, six chapters and part of an appendix, and Project 1 | McKinney, open edition | 2, 3, 5 to 12 | 26.5 |
| 18.05 Introduction to Probability and Statistics, 20 classes | MIT OCW, Spring 2022 | 5 to 12 | 69 |
| RES.18-010 and 18.06SC Linear Algebra, 10 lectures | MIT OCW | 14 to 22 | 24.5 |
| 6.036 Introduction to Machine Learning, 5 of 13 weeks and one lecture | MIT Open Learning Library | 15 to 21 | 41.5 |
| An Introduction to Statistical Learning with Python, six chapters | James, Witten, Hastie, Tibshirani, Taylor | 15 to 21 | 31.5 |
| scikit-learn user guide, five readings | scikit-learn.org | 19 to 22 | 3.5 |
| 6.S191 Introduction to Deep Learning, one lecture | MIT | 20 | 1 |
| Capstone | own project | 20 to 25 | 26.5 |
| StatQuest, 48 videos | Josh Starmer | 5 to 12, 15 to 24 | 12 |
| LeetCode, 106 algorithm, 50 SQL and 15 pandas problems | leetcode.com | every week | 75 |
| Review, case studies and a mock exam | | 23 to 25 | 14 |

Every hour figure is an estimate. MIT states about 150 hours for the whole of 18.01SC, of 18.02SC and of 18.06SC, at "an hour or more" a session, and 12 hours a week for 6.036, where 8 are planned here without the labs. Every selection of sessions, classes, lectures and weeks is this roadmap's, not MIT's. The calculus and the linear algebra are cut to what 18.05, 6.036 and the book use, so neither stands in for its full course.

## The courses

**Python.** [The Python Tutorial](https://docs.python.org/3/tutorial/index.html){ .external-link } "expects you to have a basic understanding of programming in general", which suits a return to the language.

**Calculus.** [18.01SC](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/){ .external-link } and [18.02SC](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/){ .external-link } are the OCW Scholar editions of Prof. David Jerison's and Prof. Denis Auroux's courses, "designed for independent study". A session has lecture clips, a recitation video, worked examples and problems with solutions, and every problem is attempted on paper before its solution is opened.

**SQL.** [CS50's Introduction to Databases with SQL](https://cs50.harvard.edu/sql/){ .external-link } is Harvard's free course, a lecture and a problem set per week, starting on SQLite. Weeks 0 and 1 teach querying and joins, and the LeetCode SQL sets carry the practice from there.

**pandas.** The text is the open edition of Wes McKinney's [Python for Data Analysis](https://wesmckinney.com/book/){ .external-link }, third edition. The book "has been updated for pandas 2.0.0 and Python 3.10" and the playground runs pandas 3, so where behaviour differs the [pandas 3.0 release notes](https://pandas.pydata.org/docs/whatsnew/v3.0.0.html){ .external-link } decide. The [Pandas](../pandas/index.md) guide on this site holds the idioms in condensed form. Project 1 is an exploratory analysis of a dataset from one's own field, and a labelled network-flow set such as [CIC-IDS2017](https://www.unb.ca/cic/datasets/ids-2017.html){ .external-link } fits.

**Probability and statistics.** [18.05](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/){ .external-link } is the Spring 2022 run taught by Dr. Jeremy Orloff and Dr. Jennifer French Kamrin, with no lecture videos. A class is a reading from the course's own notes, slides and in-class problems with solutions, all on one page, and the [Open Learning Library edition](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+18.05r_10+2022_Summer/about){ .external-link } adds reading questions with instant feedback. The reading comes first, then the in-class problems, and the [problem sets](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/problem-sets/){ .external-link } are the reserve for a topic that did not land. Classes 13 to 16, on Bayesian updating with continuous priors, and the R studios are skipped.

**Linear algebra.** [A 2020 Vision of Linear Algebra](https://ocw.mit.edu/courses/res-18-010-a-2020-vision-of-linear-algebra-spring-2020/){ .external-link } opens with six brief videos in which Prof. Gilbert Strang lays out the subject. [18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/){ .external-link } is the OCW Scholar edition of his course, where a session has a lecture video, a summary, a recitation video and problems with solutions.

**Machine learning.** [6.036](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/about){ .external-link } lives on the MIT Open Learning Library, is free, and can be used without enrolling, though a free account keeps the answers. It recommends "Computer programming (python); Calculus; Linear Algebra". Weeks 1 to 4 and 6 are taken, each as its lecture, exercises and homework, and of week 12 the lecture alone. Every step opens the same course outline. [An Introduction to Statistical Learning](https://www.statlearning.com/){ .external-link } is free as a PDF from its own site, in the Python edition published in 2023, with the authors' [video lectures](https://www.youtube.com/playlist?list=PLoROMvodv4rOzrYsAxzQyHb8n_RWNuS1e){ .external-link } and a [lab](https://github.com/intro-stat-learning/ISLP_labs/tree/stable){ .external-link } closing each chapter. A chapter is read or watched, then its lab is run. The labs use the `ISLP` package, which pins its own dependency versions and therefore gets an environment of its own.

**Capstone.** One end-to-end project on data from one's own field. The suggested subject is static malware detection on [EMBER2024](https://github.com/FutureComputing4AI/EMBER2024){ .external-link }, which holds features and labels for about 3.2 million malicious and benign files across Win32, Win64, .NET, APK, ELF and PDF under Apache-2.0, on a subsample that fits in memory.

**LeetCode.** A problem counts once it is solved unaided and can be explained aloud. The sets are easy through week 5 and turn to mediums from week 6. The [LeetCode](../leetcode/index.md) guide on this site holds a solution to fifty of the problems in weeks 1 to 10, opened only after an attempt.

**StatQuest.** Josh Starmer's [StatQuest](https://statquest.org/video_index.html){ .external-link } videos give the intuition for a week's statistics or machine learning topic in a few minutes each, and they are watched before the reading. Some outline methods the courses here leave out, which are support vector machines, principal component analysis, clustering and gradient boosting with XGBoost.

**scikit-learn and 6.S191.** Five short readings from the [scikit-learn user guide](https://scikit-learn.org/stable/user_guide.html){ .external-link } and its examples fix the vocabulary of metrics, cross-validation, preprocessing, support vector machines and the reading of coefficients, in the words of the library the labs and the capstone use. One lecture of MIT's [Introduction to Deep Learning](https://introtodeeplearning.com/){ .external-link }, in its 2026 edition, covers autoencoders.

**Support.** The lectures of [6.006 Introduction to Algorithms](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/video_galleries/lecture-videos/){ .external-link } (hashing, binary trees, binary heaps, breadth-first and depth-first search, dynamic programming) are optional and serve a LeetCode pattern that does not land.

---

## Week 1

- `setup`{ data-step=set-01 } [uv](https://docs.astral.sh/uv/){ .external-link } installed, the playground cloned, `uv sync` run, and `uv run python tools/check_env.py` ending in `environment ok`.
- `python`{ data-step=py-01 } The Python Tutorial, chapters [3](https://docs.python.org/3/tutorial/introduction.html){ .external-link }, [4](https://docs.python.org/3/tutorial/controlflow.html){ .external-link } and [5](https://docs.python.org/3/tutorial/datastructures.html){ .external-link }. An informal introduction to Python, control flow tools, data structures.
- `18.01SC`{ data-step=ca-01 } [Unit 1, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/1.-differentiation/part-a-definition-and-basic-rules/){ .external-link }, sessions 1 to 3, 6 and 9 to 11. The derivative, its calculation, the product, quotient and chain rules.
- `leetcode`{ data-step=lc-01 } Dictionary and set. [1. Two Sum](https://leetcode.com/problems/two-sum/), [217. Contains Duplicate](https://leetcode.com/problems/contains-duplicate/), [242. Valid Anagram](https://leetcode.com/problems/valid-anagram/), [169. Majority Element](https://leetcode.com/problems/majority-element/), [136. Single Number](https://leetcode.com/problems/single-number/), [268. Missing Number](https://leetcode.com/problems/missing-number/), [387. First Unique Character in a String](https://leetcode.com/problems/first-unique-character-in-a-string/). All easy.

**After this week.** Python's built-in data structures and control flow. The derivative as a rate of change, and the product, quotient and chain rules. A dictionary or set lookup in place of a nested loop.

## Week 2

- `python`{ data-step=py-02 } The Python Tutorial, chapters [6](https://docs.python.org/3/tutorial/modules.html){ .external-link }, [7](https://docs.python.org/3/tutorial/inputoutput.html){ .external-link }, [8](https://docs.python.org/3/tutorial/errors.html){ .external-link } and [9](https://docs.python.org/3/tutorial/classes.html){ .external-link }. Modules, input and output, errors and exceptions, classes.
- `python`{ data-step=py-03 } [Truth Value Testing](https://docs.python.org/3/builtins/stdtypes.html#truth-value-testing){ .external-link } and [map and filter](https://docs.python.org/3/builtins/functions.html#map){ .external-link } in the library reference, and in the [Programming FAQ](https://docs.python.org/3/faq/programming.html){ .external-link } the entries on default values shared between objects and on copying an object.
- `pandas`{ data-step=pd-01 } [Chapter 4](https://wesmckinney.com/book/numpy-basics){ .external-link }, NumPy Basics. The ndarray, universal functions, array-oriented programming.
- `18.01SC`{ data-step=ca-02 } Session 12 in [Unit 1, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/1.-differentiation/part-a-definition-and-basic-rules/){ .external-link }, sessions 16 and 17 in [Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/1.-differentiation/part-b-implicit-differentiation-and-inverse-functions/){ .external-link }. Higher derivatives, the exponential function and its inverse.
- `18.01SC`{ data-step=ca-03 } Unit 2, session 23 in [Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/part-a-approximation-and-curve-sketching/){ .external-link }, 29 in [Part B](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/part-b-optimization-related-rates-and-newtons-method/){ .external-link }, 37 and 38 in [Part C](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-2-applications-of-differentiation/part-c-mean-value-theorem-antiderivatives-and-differential-equations/){ .external-link }. Linear approximation, optimization, antiderivatives, integration by substitution.
- `leetcode`{ data-step=lc-02 } Dictionary and set. [350. Intersection of Two Arrays II](https://leetcode.com/problems/intersection-of-two-arrays-ii/), [383. Ransom Note](https://leetcode.com/problems/ransom-note/), [202. Happy Number](https://leetcode.com/problems/happy-number/), [205. Isomorphic Strings](https://leetcode.com/problems/isomorphic-strings/), [290. Word Pattern](https://leetcode.com/problems/word-pattern/), [219. Contains Duplicate II](https://leetcode.com/problems/contains-duplicate-ii/). All easy.

**After this week.** Modules, exceptions and classes in Python. NumPy arrays and element-wise operations. Second derivatives, the derivative of the exponential function and of the logarithm, maxima and minima, antiderivatives. The values Python treats as false, and a default argument shared between calls. Counts kept in a dictionary, and a mapping checked in both directions.

## Week 3

- `18.01SC`{ data-step=ca-04 } [Unit 3, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-3-the-definite-integral-and-its-applications/part-a-definition-of-the-definite-integral-and-first-fundamental-theorem/){ .external-link }, sessions 43, 45, 47 and 48. The definite integral, the fundamental theorem of calculus.
- `18.01SC`{ data-step=ca-05 } Session 62 in [Unit 3, Part C](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-3-the-definite-integral-and-its-applications/part-c-average-value-probability-and-numerical-integration/){ .external-link }, integrals and probability, and session 91 in [Unit 5, Part A](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/unit-5-exploring-the-infinite/part-a-lhospitals-rule-and-improper-integrals/){ .external-link }, improper integrals.
- `pandas`{ data-step=pd-07 } [Appendix A](https://wesmckinney.com/book/advanced-numpy){ .external-link }, Advanced NumPy, sections A.2 and A.3. Reshaping arrays, concatenating and splitting, broadcasting.
- `sql`{ data-step=sq-01 } CS50 SQL, [week 0](https://cs50.harvard.edu/sql/weeks/0/){ .external-link }, Querying. The lecture and its problem set. `SELECT`, `WHERE`, `LIKE`, `ORDER BY`, `LIMIT`, aggregate functions.
- `leetcode`{ data-step=lc-03 } Strings, then two pointers. [409. Longest Palindrome](https://leetcode.com/problems/longest-palindrome/), [14. Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/), [13. Roman to Integer](https://leetcode.com/problems/roman-to-integer/), [125. Valid Palindrome](https://leetcode.com/problems/valid-palindrome/), [283. Move Zeroes](https://leetcode.com/problems/move-zeroes/), [26. Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/), [977. Squares of a Sorted Array](https://leetcode.com/problems/squares-of-a-sorted-array/), [88. Merge Sorted Array](https://leetcode.com/problems/merge-sorted-array/). All easy.
- `leetcode`{ data-step=lq-01 } SQL, selecting and filtering. [1757. Recyclable and Low Fat Products](https://leetcode.com/problems/recyclable-and-low-fat-products/), [584. Find Customer Referee](https://leetcode.com/problems/find-customer-referee/), [595. Big Countries](https://leetcode.com/problems/big-countries/). All easy.

**After this week.** The definite integral as an area, the fundamental theorem of calculus, a probability as the integral of a density, integrals over an infinite range. NumPy arrays reshaped, joined and broadcast against each other. Two pointers moving over an array or a string. Single-table SQL queries with filtering, sorting and aggregation.

## Week 4

- `18.02SC`{ data-step=ca-06 } [Unit 2, Part A](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/2.-partial-derivatives/part-a-functions-of-two-variables-tangent-approximation-and-optimization/){ .external-link }, sessions 24 to 26, 28 and 29. Functions of two variables, contour plots, partial derivatives, optimization, least squares.
- `18.02SC`{ data-step=ca-07 } [Unit 2, Part B](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/2.-partial-derivatives/part-b-chain-rule-gradient-and-directional-derivatives/){ .external-link }, sessions 32, 35 and 38. The chain rule, the gradient, directional derivatives.
- `sql`{ data-step=sq-02 } CS50 SQL, [week 1](https://cs50.harvard.edu/sql/weeks/1/){ .external-link }, Relating. The lecture and its problem set. Keys, subqueries, `JOIN`, sets, groups.
- `leetcode`{ data-step=lc-04 } Two pointers, then a running value and bits. [392. Is Subsequence](https://leetcode.com/problems/is-subsequence/), [680. Valid Palindrome II](https://leetcode.com/problems/valid-palindrome-ii/), [121. Best Time to Buy and Sell Stock](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/), [724. Find Pivot Index](https://leetcode.com/problems/find-pivot-index/), [191. Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/), [338. Counting Bits](https://leetcode.com/problems/counting-bits/). All easy.
- `leetcode`{ data-step=lq-02 } SQL, filtering and sorting. [1148. Article Views I](https://leetcode.com/problems/article-views-i/), [1683. Invalid Tweets](https://leetcode.com/problems/invalid-tweets/), [620. Not Boring Movies](https://leetcode.com/problems/not-boring-movies/). All easy.

**After this week.** Partial derivatives, the gradient and its relation to level curves, directional derivatives, least squares as a minimization. A running minimum and a prefix sum carried through one pass. Joins, subqueries and grouping in SQL.

## Week 5

- `18.05`{ data-step=st-01 } [Classes 1 to 3](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Counting and sets, probability basics, conditional probability, independence, Bayes' theorem.
- `statquest`{ data-step=sv-01 } Videos. [Conditional Probability](https://youtu.be/_IgyaD7vOOA){ .external-link }, [Bayes' Theorem](https://youtu.be/9wCnvr7Xw4E){ .external-link }.
- `pandas`{ data-step=pd-02 } [Chapter 5](https://wesmckinney.com/book/pandas-basics){ .external-link }, Getting Started with pandas. Series and DataFrame, essential functionality, descriptive statistics.
- `leetcode`{ data-step=lc-05 } Binary search, then a stack. [704. Binary Search](https://leetcode.com/problems/binary-search/), [35. Search Insert Position](https://leetcode.com/problems/search-insert-position/), [69. Sqrt(x)](https://leetcode.com/problems/sqrtx/), [20. Valid Parentheses](https://leetcode.com/problems/valid-parentheses/), [1047. Remove All Adjacent Duplicates In String](https://leetcode.com/problems/remove-all-adjacent-duplicates-in-string/). All easy.
- `leetcode`{ data-step=lq-03 } SQL, joins. [175. Combine Two Tables](https://leetcode.com/problems/combine-two-tables/), [1378. Replace Employee ID With The Unique Identifier](https://leetcode.com/problems/replace-employee-id-with-the-unique-identifier/). All easy.

**After this week.** Counting with permutations and combinations, conditional probability, independence, Bayes' theorem and the base rate fallacy. The pandas Series and DataFrame, selection and summary statistics. Binary search on a sorted array, and a stack for matching pairs. A join of two tables.

## Week 6

- `18.05`{ data-step=st-02 } [Classes 4, 5a and 5b](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Discrete random variables, expected value, variance, continuous random variables.
- `statquest`{ data-step=sv-02 } Videos. [The Main Ideas behind Probability Distributions](https://youtu.be/oI3hZJqXJuc){ .external-link }, [The Normal Distribution](https://youtu.be/rzFX5NWojp0){ .external-link }, [Expected Values](https://youtu.be/KLs_7b7SKi4){ .external-link }.
- `pandas`{ data-step=pd-03 } [Chapter 7](https://wesmckinney.com/book/data-cleaning){ .external-link }, Data Cleaning and Preparation. Missing data, data transformation, string manipulation, categorical data.
- `leetcode`{ data-step=lc-06 } Values built from the previous ones. [70. Climbing Stairs](https://leetcode.com/problems/climbing-stairs/), [118. Pascal's Triangle](https://leetcode.com/problems/pascals-triangle/), [746. Min Cost Climbing Stairs](https://leetcode.com/problems/min-cost-climbing-stairs/), [198. House Robber](https://leetcode.com/problems/house-robber/). Three easy, one medium.
- `leetcode`{ data-step=lq-04 } SQL, joins. [1068. Product Sales Analysis I](https://leetcode.com/problems/product-sales-analysis-i/), [1581. Customer Who Visited but Did Not Make Any Transactions](https://leetcode.com/problems/customer-who-visited-but-did-not-make-any-transactions/). Then pandas. [2877. Create a DataFrame from List](https://leetcode.com/problems/create-a-dataframe-from-list/), [2878. Get the Size of a DataFrame](https://leetcode.com/problems/get-the-size-of-a-dataframe/), [2879. Display the First Three Rows](https://leetcode.com/problems/display-the-first-three-rows/), [2880. Select Data](https://leetcode.com/problems/select-data/), [2881. Create a New Column](https://leetcode.com/problems/create-a-new-column/). All easy.

**After this week.** Discrete random variables with the Bernoulli, binomial and geometric distributions, expected value and variance, continuous random variables with the uniform, exponential and normal distributions. Missing values, recoding and string cleaning in pandas. A recurrence filled in from its first values, in a first medium problem. A join that keeps the rows without a match.

## Week 7

- `18.05`{ data-step=st-03 } [Classes 6a and 6b](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Expected value and variance of continuous variables, histograms, the law of large numbers, the central limit theorem.
- `statquest`{ data-step=sv-03 } Videos. [The Central Limit Theorem](https://youtu.be/YAlJCEDH2uY){ .external-link }, [Population and Estimated Parameters](https://youtu.be/vikkiwjQqfU){ .external-link }, [Estimating the Mean, Variance and Standard Deviation](https://youtu.be/SzZ6GpcfoQY){ .external-link }.
- `18.02SC`{ data-step=ca-08 } [Unit 3, Part A](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/3.-double-integrals-and-line-integrals-in-the-plane/part-a-double-integrals/){ .external-link }, sessions 47 and 48. Double integrals, which class 7 uses for joint distributions.
- `pandas`{ data-step=pd-04 } [Chapter 8](https://wesmckinney.com/book/data-wrangling){ .external-link }, Data Wrangling. Hierarchical indexing, combining and merging, reshaping and pivoting.
- `leetcode`{ data-step=lc-07 } Dictionary and set. [49. Group Anagrams](https://leetcode.com/problems/group-anagrams/), [347. Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/), [128. Longest Consecutive Sequence](https://leetcode.com/problems/longest-consecutive-sequence/), [3. Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/). All medium.
- `leetcode`{ data-step=lq-05 } SQL, self-joins. [181. Employees Earning More Than Their Managers](https://leetcode.com/problems/employees-earning-more-than-their-managers/), [197. Rising Temperature](https://leetcode.com/problems/rising-temperature/). Then pandas. [2882. Drop Duplicate Rows](https://leetcode.com/problems/drop-duplicate-rows/), [2883. Drop Missing Data](https://leetcode.com/problems/drop-missing-data/), [2884. Modify Columns](https://leetcode.com/problems/modify-columns/), [2885. Rename Columns](https://leetcode.com/problems/rename-columns/), [2886. Change Data Type](https://leetcode.com/problems/change-data-type/), [2887. Fill Missing Data](https://leetcode.com/problems/fill-missing-data/). All easy.

**After this week.** The law of large numbers, the central limit theorem and what it says about a sample mean, a population parameter against its estimate. A double integral over a region. Merging, concatenating and pivoting tables in pandas. Grouping by a computed key, and a first sliding window. A table joined to itself.

## Week 8

- `18.05`{ data-step=st-04 } [Class 7](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Joint distributions, independence, covariance, correlation.
- `18.05`{ data-step=st-05 } Class 8, the review, then [Exam 1](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/exams/){ .external-link }, closed book and timed.
- `statquest`{ data-step=sv-04 } Videos. [Covariance](https://youtu.be/qtaqvPAeEJY){ .external-link }, [Pearson's Correlation](https://youtu.be/xZ_z8KWkhXE){ .external-link }.
- `pandas`{ data-step=pd-05 } [Chapter 10](https://wesmckinney.com/book/data-aggregation){ .external-link }, Data Aggregation and Group Operations. Split-apply-combine, group transforms, pivot tables, cross-tabulation.
- `leetcode`{ data-step=lc-08 } Two pointers. [167. Two Sum II - Input Array Is Sorted](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/), [11. Container With Most Water](https://leetcode.com/problems/container-with-most-water/), [15. 3Sum](https://leetcode.com/problems/3sum/), [75. Sort Colors](https://leetcode.com/problems/sort-colors/). All medium.
- `leetcode`{ data-step=lq-06 } SQL, rows without a match. [183. Customers Who Never Order](https://leetcode.com/problems/customers-who-never-order/), [577. Employee Bonus](https://leetcode.com/problems/employee-bonus/). Then pandas. [2888. Reshape Data Concatenate](https://leetcode.com/problems/reshape-data-concatenate/), [2889. Reshape Data Pivot](https://leetcode.com/problems/reshape-data-pivot/), [2890. Reshape Data Melt](https://leetcode.com/problems/reshape-data-melt/), [2891. Method Chaining](https://leetcode.com/problems/method-chaining/). All easy.

**After this week.** Joint and marginal distributions, covariance and correlation, and the whole of probability under exam conditions. Group-by aggregation, pivot tables and cross-tabulation in pandas. Two pointers closing in from both ends. An outer join filtered for missing matches.

## Week 9

- `18.05`{ data-step=st-06 } [Classes 10 to 12](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Likelihood and maximum likelihood estimates, Bayesian updating with discrete priors, predictive probabilities, odds.
- `statquest`{ data-step=sv-05 } Videos. [Probability vs Likelihood](https://youtu.be/pYxNSUDSFH4){ .external-link }, [Maximum Likelihood](https://youtu.be/XepXtl9YKwc){ .external-link }, [Odds and Log(Odds)](https://youtu.be/ARfXDSkQf1Y){ .external-link }.
- `pandas`{ data-step=pd-06 } [Chapter 9](https://wesmckinney.com/book/plotting-and-visualization){ .external-link }, Plotting and Visualization. matplotlib, plotting with pandas and seaborn.
- `leetcode`{ data-step=lc-09 } Running value. [53. Maximum Subarray](https://leetcode.com/problems/maximum-subarray/), [122. Best Time to Buy and Sell Stock II](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/), [238. Product of Array Except Self](https://leetcode.com/problems/product-of-array-except-self/), [560. Subarray Sum Equals K](https://leetcode.com/problems/subarray-sum-equals-k/). All medium.
- `leetcode`{ data-step=lq-07 } SQL, aggregation. [1075. Project Employees I](https://leetcode.com/problems/project-employees-i/), [1251. Average Selling Price](https://leetcode.com/problems/average-selling-price/). All easy.

**After this week.** The difference between probability and likelihood, the maximum likelihood estimate, a prior updated to a posterior, odds and their logarithm. Line, bar, histogram and scatter plots from a DataFrame. Prefix sums kept in a dictionary. An average per group in SQL.

## Week 10

- `18.05`{ data-step=st-07 } [Classes 17 to 19](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Significance testing, rejection regions, the z-test, t-tests, chi-square tests, ANOVA.
- `statquest`{ data-step=sv-06 } Videos. [Hypothesis Testing and the Null Hypothesis](https://youtu.be/0oc49DyA3hU){ .external-link }, [p-values](https://youtu.be/vemZtEM63GY){ .external-link }, [How to Calculate p-values](https://youtu.be/JQc3yx0-Q9E){ .external-link }.
- `project`{ data-step=p1-01 } Project 1. A dataset from one's own field, loaded and cleaned.
- `leetcode`{ data-step=lc-10 } A stack, then intervals. [739. Daily Temperatures](https://leetcode.com/problems/daily-temperatures/), [155. Min Stack](https://leetcode.com/problems/min-stack/), [56. Merge Intervals](https://leetcode.com/problems/merge-intervals/). All medium.
- `leetcode`{ data-step=lq-08 } SQL, grouping. [596. Classes With at Least 5 Students](https://leetcode.com/problems/classes-with-at-least-5-students/), [1729. Find Followers Count](https://leetcode.com/problems/find-followers-count/). All easy.

**After this week.** The null hypothesis, the significance level and the p-value, the z-test, one-sample and two-sample t-tests, the chi-square test. A monotonic stack, and intervals merged after sorting. A count per group in SQL.

## Week 11

- `18.05`{ data-step=st-08 } [Classes 20, 22 and 23](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Bayesian and frequentist inference compared, confidence intervals for normal and for non-normal data.
- `statquest`{ data-step=sv-07 } Videos. [Confidence Intervals](https://youtu.be/TqOeMYtOc1w){ .external-link }, [Statistical Power](https://youtu.be/Rsc5znwR5FA){ .external-link }, [p-hacking](https://youtu.be/HDCOUXE3HMM){ .external-link }.
- `project`{ data-step=p1-02 } Project 1. Summaries and plots.
- `leetcode`{ data-step=lc-11 } Linked lists. [206. Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/), [21. Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/), [141. Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/), [19. Remove Nth Node From End of List](https://leetcode.com/problems/remove-nth-node-from-end-of-list/), [2. Add Two Numbers](https://leetcode.com/problems/add-two-numbers/). Three easy, two medium.
- `leetcode`{ data-step=lq-09 } SQL, grouping with a condition. [182. Duplicate Emails](https://leetcode.com/problems/duplicate-emails/), [586. Customer Placing the Largest Number of Orders](https://leetcode.com/problems/customer-placing-the-largest-number-of-orders/). All easy.

**After this week.** What a p-value and a confidence interval do and do not say, confidence intervals for a mean, statistical power, and how p-hacking produces false positives. A linked list reversed, merged and walked with two pointers. A group kept or dropped by its count in SQL.

## Week 12

- `18.05`{ data-step=st-09 } [Classes 24 and 26](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/classes-reading-and-in-class-materials/){ .external-link }. Bootstrap confidence intervals, linear and multiple regression.
- `statquest`{ data-step=sv-08 } Videos. [Bootstrapping](https://youtu.be/Xz0x-8-cgaQ){ .external-link }, [Linear Regression](https://youtu.be/7ArmBVF2dCs){ .external-link }, [R-squared](https://youtu.be/2AQKmw14mHM){ .external-link }.
- `project`{ data-step=p1-03 } Project 1 committed, with five findings a colleague could act on and no model.
- `leetcode`{ data-step=lc-12 } Binary trees. [104. Maximum Depth of Binary Tree](https://leetcode.com/problems/maximum-depth-of-binary-tree/), [226. Invert Binary Tree](https://leetcode.com/problems/invert-binary-tree/), [543. Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/), [102. Binary Tree Level Order Traversal](https://leetcode.com/problems/binary-tree-level-order-traversal/), [199. Binary Tree Right Side View](https://leetcode.com/problems/binary-tree-right-side-view/). Three easy, two medium.
- `leetcode`{ data-step=lq-10 } SQL, rates and percentages. [1211. Queries Quality and Percentage](https://leetcode.com/problems/queries-quality-and-percentage/), [1633. Percentage of Users Attended a Contest](https://leetcode.com/problems/percentage-of-users-attended-a-contest/). All easy.

**After this week.** The bootstrap, simple linear regression, the least squares fit and R-squared. A dataset taken from raw file to written findings. Depth-first and level-order traversal of a binary tree. A percentage computed per group in SQL.

## Week 13

A catch-up week with no new material. Whatever slipped is finished, and every LeetCode problem that needed its solution is solved again unaided.

## Week 14

- `18.02SC`{ data-step=ca-09 } [Unit 1, Part A](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/pages/1.-vectors-and-matrices/part-a-vectors-determinants-and-planes/){ .external-link }, sessions 1 to 3. Vectors, dot products, lengths and angles.
- `RES.18-010`{ data-step=la-01 } [A 2020 Vision of Linear Algebra](https://ocw.mit.edu/courses/res-18-010-a-2020-vision-of-linear-algebra-spring-2020/video_galleries/videos/){ .external-link }, the six videos of 2020. The column space, the big picture, orthogonal vectors, eigenvalues, singular values.
- `18.06SC`{ data-step=la-02 } [The geometry of linear equations](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/ax-b-and-the-four-subspaces/the-geometry-of-linear-equations/){ .external-link }, [elimination with matrices](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/ax-b-and-the-four-subspaces/elimination-with-matrices/){ .external-link }, [multiplication and inverse matrices](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/ax-b-and-the-four-subspaces/multiplication-and-inverse-matrices/){ .external-link }.
- `leetcode`{ data-step=lc-13 } Binary search trees, then binary search on a rotated array. [98. Validate Binary Search Tree](https://leetcode.com/problems/validate-binary-search-tree/), [235. Lowest Common Ancestor of a Binary Search Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/), [230. Kth Smallest Element in a BST](https://leetcode.com/problems/kth-smallest-element-in-a-bst/), [33. Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/), [153. Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/). All medium.
- `leetcode`{ data-step=lq-11 } SQL, joins with aggregation. [1280. Students and Examinations](https://leetcode.com/problems/students-and-examinations/), [1661. Average Time of Process per Machine](https://leetcode.com/problems/average-time-of-process-per-machine/). All easy.

**After this week.** Vectors and the dot product. A linear system read by rows and by columns, elimination, matrix multiplication, the inverse. The ordering inside a binary search tree, and binary search beyond a plain sorted array. A join followed by aggregation in SQL.

## Week 15

- `6.036`{ data-step=ml-01 } [Week 1](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }, Basics. The supervised learning setting, hypotheses, loss functions, training set error, linear classifiers.
- `ISLP`{ data-step=is-01 } Chapter 2, Statistical Learning. Regression models, model selection and the bias-variance trade-off, classification.
- `statquest`{ data-step=sv-09 } Videos. [A Gentle Introduction to Machine Learning](https://youtu.be/Gv9_4yMHFhI){ .external-link }, [Bias and Variance](https://youtu.be/EuBBz3bI-aA){ .external-link }, [Cross Validation](https://youtu.be/fSytzGwwBVw){ .external-link }.
- `leetcode`{ data-step=lc-14 } Grid and graph search. [733. Flood Fill](https://leetcode.com/problems/flood-fill/), [200. Number of Islands](https://leetcode.com/problems/number-of-islands/), [994. Rotting Oranges](https://leetcode.com/problems/rotting-oranges/), [207. Course Schedule](https://leetcode.com/problems/course-schedule/). One easy, three medium.
- `leetcode`{ data-step=lq-12 } SQL, conditional aggregation. [570. Managers with at Least 5 Direct Reports](https://leetcode.com/problems/managers-with-at-least-5-direct-reports/), [1934. Confirmation Rate](https://leetcode.com/problems/confirmation-rate/). All medium.

**After this week.** What a learning algorithm is given and what it returns, a loss function, training error against error on new data, a linear classifier as a hyperplane, the bias-variance trade-off, cross-validation in outline. Breadth-first and depth-first search on a grid and on a graph. Conditional aggregation in SQL.

## Week 16

- `6.036`{ data-step=ml-02 } [Week 2](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }, Perceptrons. The perceptron algorithm, validation, linear separability, the margin of a dataset, the convergence theorem.
- `18.06SC`{ data-step=la-03 } [Column space and nullspace](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/ax-b-and-the-four-subspaces/column-space-and-nullspace/){ .external-link }, [orthogonal vectors and subspaces](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/least-squares-determinants-and-eigenvalues/orthogonal-vectors-and-subspaces/){ .external-link }.
- `statquest`{ data-step=sv-10 } Videos. [The Confusion Matrix](https://youtu.be/Kdsp6soqA7o){ .external-link }, [Sensitivity and Specificity](https://youtu.be/vP06aMoz4v8){ .external-link }, [ROC and AUC](https://youtu.be/4jRBRDbJemM){ .external-link }.
- `leetcode`{ data-step=lc-15 } Sliding window. [643. Maximum Average Subarray I](https://leetcode.com/problems/maximum-average-subarray-i/), [209. Minimum Size Subarray Sum](https://leetcode.com/problems/minimum-size-subarray-sum/), [424. Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/), [567. Permutation in String](https://leetcode.com/problems/permutation-in-string/). One easy, three medium.
- `leetcode`{ data-step=lq-13 } SQL, dates and conditional sums. [1193. Monthly Transactions I](https://leetcode.com/problems/monthly-transactions-i/), [1174. Immediate Food Delivery II](https://leetcode.com/problems/immediate-food-delivery-ii/). All medium.

**After this week.** The perceptron algorithm, linear separability and the margin. The column space and the nullspace of a matrix, orthogonal subspaces. The confusion matrix, sensitivity and specificity, the ROC curve and its AUC. A window that grows and shrinks over an array. Sums by month and by condition in SQL.

## Week 17

- `6.036`{ data-step=ml-03 } [Week 3](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }, Features. Feature representation, the polynomial basis, features constructed by hand for real domains.
- `ISLP`{ data-step=is-02 } Chapter 3, Linear Regression. Simple and multiple regression, hypothesis tests and confidence intervals for coefficients, interaction terms, qualitative predictors, and in the lab residual plots, leverage and variance inflation factors.
- `statquest`{ data-step=sv-11 } Videos. [Multiple Regression](https://youtu.be/zITIFTsivN8){ .external-link }, [One-Hot, Label, Target and K-Fold Target Encoding](https://youtu.be/589nCGeWG1w){ .external-link }.
- `leetcode`{ data-step=lc-16 } Heaps. [703. Kth Largest Element in a Stream](https://leetcode.com/problems/kth-largest-element-in-a-stream/), [215. Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/), [973. K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/). One easy, two medium. The reference is [heapq](https://docs.python.org/3/library/heapq.html){ .external-link } in the Python library reference.
- `leetcode`{ data-step=lq-14 } SQL, subqueries. [550. Game Play Analysis IV](https://leetcode.com/problems/game-play-analysis-iv/), [1045. Customers Who Bought All Products](https://leetcode.com/problems/customers-who-bought-all-products/). All medium.

**After this week.** Feature transformations for a linear model, polynomial features, encodings for categorical data. A fitted regression read coefficient by coefficient, with its standard errors and p-values, its residual plots and its variance inflation factors. A heap for the k largest values. Subqueries in SQL.

## Week 18

- `6.036`{ data-step=ml-04 } [Week 4](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }, Margin Maximization. Logistic regression with the sigmoid and the negative log likelihood loss, regularization, gradient descent in one and in several dimensions, stochastic gradient descent.
- `18.06SC`{ data-step=la-04 } [Projections onto subspaces](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/least-squares-determinants-and-eigenvalues/projections-onto-subspaces/){ .external-link }, [projection matrices and least squares](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/least-squares-determinants-and-eigenvalues/projection-matrices-and-least-squares/){ .external-link }.
- `statquest`{ data-step=sv-12 } Videos. [Logistic Regression](https://youtu.be/yIYKR4sgzI8){ .external-link }, [Gradient Descent](https://youtu.be/sDv4f4s2SB8){ .external-link }, [Stochastic Gradient Descent](https://youtu.be/vMh0zPT0tLI){ .external-link }.
- `leetcode`{ data-step=lc-17 } Backtracking. [78. Subsets](https://leetcode.com/problems/subsets/), [46. Permutations](https://leetcode.com/problems/permutations/), [39. Combination Sum](https://leetcode.com/problems/combination-sum/), [17. Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/). All medium.
- `leetcode`{ data-step=lq-15 } SQL, the top row of a group. [176. Second Highest Salary](https://leetcode.com/problems/second-highest-salary/), [184. Department Highest Salary](https://leetcode.com/problems/department-highest-salary/). All medium.

**After this week.** Logistic regression as a linear classifier that returns a probability, its loss and its regularization, gradient descent and its stochastic form. Least squares as a projection onto the column space. Subsets, permutations and combinations generated by backtracking. The top row of each group in SQL.

## Week 19

- `ISLP`{ data-step=is-03 } Chapter 4, Classification. Logistic regression, discriminant analysis, naive Bayes, K-nearest neighbors, generalized linear models.
- `ISLP`{ data-step=is-04 } Chapter 5, Resampling Methods. The validation set, k-fold cross-validation, the bootstrap.
- `statquest`{ data-step=sv-13 } Videos. [K-Nearest Neighbors](https://youtu.be/HVXime0nQeI){ .external-link }, [Naive Bayes](https://youtu.be/O2L2Uv9pdDA){ .external-link }.
- `sklearn`{ data-step=sk-01 } User guide, [Classification metrics](https://scikit-learn.org/stable/modules/model_evaluation.html#classification-metrics){ .external-link }. The confusion matrix, accuracy and balanced accuracy on imbalanced classes, precision, recall and the F-measures, the ROC curve, then mean absolute and mean squared error under [Regression metrics](https://scikit-learn.org/stable/modules/model_evaluation.html#regression-metrics){ .external-link }, and the opening of [Nearest Neighbors Classification](https://scikit-learn.org/stable/modules/neighbors.html#nearest-neighbors-classification){ .external-link } for instance-based learning.
- `sklearn`{ data-step=sk-02 } User guide, [Cross validation iterators](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators){ .external-link }. K-fold, stratified K-fold and the time series split, then [Data leakage](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage){ .external-link } under Common pitfalls.
- `leetcode`{ data-step=lc-18 } Dynamic programming. [322. Coin Change](https://leetcode.com/problems/coin-change/), [300. Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/), [62. Unique Paths](https://leetcode.com/problems/unique-paths/). All medium.
- `leetcode`{ data-step=lq-16 } SQL, the latest row per key. [1164. Product Price at a Given Date](https://leetcode.com/problems/product-price-at-a-given-date/), [1341. Movie Rating](https://leetcode.com/problems/movie-rating/). All medium.

**After this week.** Logistic regression against discriminant analysis, naive Bayes and K-nearest neighbors on one dataset. Cross-validation done the right way, with every data-dependent step inside the fold, and the bootstrap. Accuracy against precision, recall and F1 on imbalanced classes, stratified and time-ordered splits, data leakage. A dynamic programming table filled from its smaller subproblems. The latest row per key in SQL.

## Week 20

- `6.036`{ data-step=ml-06 } [Week 6](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }, Neural Networks I. Units and layers, activation functions, back-propagation, weight initialization, loss functions for the output layer.
- `statquest`{ data-step=sv-14 } Videos. [Neural Networks Part 1](https://youtu.be/CqOfi41LfDw){ .external-link }, [Neural Networks Part 2](https://youtu.be/IN2XmBhILt4){ .external-link }, [Support Vector Machines](https://youtu.be/efR1C6CvhmE){ .external-link }.
- `6.S191`{ data-step=dl-01 } [Deep Generative Modeling](https://youtu.be/R8V8CbuxryI){ .external-link }, lecture 4 of MIT's Introduction to Deep Learning, up to the end of the variational autoencoders, with its [slides](https://introtodeeplearning.com/slides/6S191_MIT_DeepLearning_L4.pdf){ .external-link }. Supervised against unsupervised learning, outlier detection, latent variables, autoencoders and their reconstruction loss, variational autoencoders.
- `sklearn`{ data-step=sk-03 } User guide, Preprocessing data, [Standardization](https://scikit-learn.org/stable/modules/preprocessing.html#standardization-or-mean-removal-and-variance-scaling){ .external-link } and [Encoding categorical features](https://scikit-learn.org/stable/modules/preprocessing.html#encoding-categorical-features){ .external-link }. Standard scaling and the kernels and penalties that assume it, ordinal and one-hot encoding.
- `sklearn`{ data-step=sk-05 } User guide, Support Vector Machines, [Kernel functions](https://scikit-learn.org/stable/modules/svm.html#kernel-functions){ .external-link } and [Tips on Practical Use](https://scikit-learn.org/stable/modules/svm.html#tips-on-practical-use){ .external-link }. The linear, polynomial and RBF kernels, the parameters C and gamma, scaling the data first.
- `project`{ data-step=cp-01 } Capstone. The question, stated before the data is opened, and a test set newer than the training set.
- `leetcode`{ data-step=lc-19 } Binary trees, a second set. [236. Lowest Common Ancestor of a Binary Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/), [437. Path Sum III](https://leetcode.com/problems/path-sum-iii/), [1448. Count Good Nodes in Binary Tree](https://leetcode.com/problems/count-good-nodes-in-binary-tree/). All medium.
- `leetcode`{ data-step=lq-17 } SQL, window functions. [178. Rank Scores](https://leetcode.com/problems/rank-scores/), [180. Consecutive Numbers](https://leetcode.com/problems/consecutive-numbers/). All medium. The reference is [Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html){ .external-link } in the PostgreSQL tutorial.

**After this week.** A neural network as layers of units with weights and activation functions, trained by back-propagation. An autoencoder as an encoder and a decoder trained to reconstruct its input, with the code between them as a compressed representation. The kernel of a support vector machine, and why its inputs are scaled. Standard scaling and one-hot encoding. A value carried down a tree and a result carried back up. A rank and a lagged value in SQL.

## Week 21

- `ISLP`{ data-step=is-05 } Chapter 6, Linear Model Selection and Regularization. Subset selection, ridge regression, the lasso, principal components regression.
- `ISLP`{ data-step=is-06 } Chapter 8, Tree-Based Methods. Decision trees, bagging, random forests, boosting.
- `statquest`{ data-step=sv-15 } Videos. [Ridge Regression](https://youtu.be/Q81RR3yKn30){ .external-link }, [Lasso Regression](https://youtu.be/NGf0voTMlcs){ .external-link }, [Decision and Classification Trees](https://youtu.be/_L39rN6gz7Y){ .external-link }, [Random Forests Part 1](https://youtu.be/J4Wdy0Wc_xQ){ .external-link }.
- `6.036`{ data-step=ml-07 } [Week 12](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/course/){ .external-link }, Recommender Systems, the lecture and its notes without the exercises. Content-based recommendations, collaborative filtering, alternating least squares, stochastic gradient descent.
- `leetcode`{ data-step=lc-20 } Grid and graph search, a second set. [695. Max Area of Island](https://leetcode.com/problems/max-area-of-island/), [547. Number of Provinces](https://leetcode.com/problems/number-of-provinces/), [210. Course Schedule II](https://leetcode.com/problems/course-schedule-ii/). All medium.
- `leetcode`{ data-step=lq-18 } SQL, running totals. [1204. Last Person to Fit in the Bus](https://leetcode.com/problems/last-person-to-fit-in-the-bus/), [1321. Restaurant Growth](https://leetcode.com/problems/restaurant-growth/). All medium.

**After this week.** Ridge against the lasso, and how the penalty is chosen. A decision tree, and why bagging, random forests and boosting improve on it. Content-based against collaborative filtering in a recommender system. Connected components counted by search, and a topological order. A running total and a moving average in SQL.

## Week 22

- `18.06SC`{ data-step=la-05 } [Eigenvalues and eigenvectors](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/least-squares-determinants-and-eigenvalues/eigenvalues-and-eigenvectors/){ .external-link }, [symmetric matrices and positive definiteness](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/symmetric-matrices-and-positive-definiteness/){ .external-link }, [the singular value decomposition](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/singular-value-decomposition/){ .external-link }.
- `statquest`{ data-step=sv-16 } Videos. [Principal Component Analysis](https://youtu.be/FgakZw6K1QQ){ .external-link }, [K-Means Clustering](https://youtu.be/4b5d3muPQmA){ .external-link }.
- `sklearn`{ data-step=sk-04 } Example, [Common pitfalls in the interpretation of coefficients of linear models](https://scikit-learn.org/stable/auto_examples/inspection/plot_linear_model_coefficient_interpretation.html){ .external-link }. Scale, correlated features, regularization, and why a coefficient is not a causal effect.
- `project`{ data-step=cp-02 } Capstone. Exploration, and a trivial baseline scored first.
- `leetcode`{ data-step=lc-21 } Sliding window, a second set, then weighted sampling. [438. Find All Anagrams in a String](https://leetcode.com/problems/find-all-anagrams-in-a-string/), [1004. Max Consecutive Ones III](https://leetcode.com/problems/max-consecutive-ones-iii/), [904. Fruit Into Baskets](https://leetcode.com/problems/fruit-into-baskets/), [528. Random Pick with Weight](https://leetcode.com/problems/random-pick-with-weight/). All medium.
- `leetcode`{ data-step=lq-19 } SQL, mixed. [177. Nth Highest Salary](https://leetcode.com/problems/nth-highest-salary/), [602. Friend Requests II Who Has the Most Friends](https://leetcode.com/problems/friend-requests-ii-who-has-the-most-friends/), [1907. Count Salary Categories](https://leetcode.com/problems/count-salary-categories/). All medium.

**After this week.** Eigenvalues and eigenvectors, symmetric and positive definite matrices, the singular value decomposition, principal component analysis, k-means clustering. Correlated features, and why a coefficient is not a causal effect. A baseline that every later model has to beat. A window of fixed and of variable size, and sampling in proportion to weights. SQL mediums with no pattern named in advance.

## Week 23

- `project`{ data-step=cp-03 } Capstone. At least two model families, one of them gradient-boosted trees, compared by cross-validation on precision and recall. The reading is [Histogram-Based Gradient Boosting](https://scikit-learn.org/stable/modules/ensemble.html#histogram-based-gradient-boosting){ .external-link } in the scikit-learn user guide, [Introduction to Boosted Trees](https://xgboost.readthedocs.io/en/stable/tutorials/model.html){ .external-link } in the XGBoost documentation and [Features](https://lightgbm.readthedocs.io/en/latest/Features.html){ .external-link } in the LightGBM documentation.
- `statquest`{ data-step=sv-17 } Videos. [Gradient Boost Part 1](https://youtu.be/3CC4N4z3GJc){ .external-link }, [XGBoost Part 1](https://youtu.be/OtD8wVaFm6E){ .external-link }, [XGBoost Part 4](https://youtu.be/oRrKeUCEbq8){ .external-link }.
- `review`{ data-step=rv-01 } The 18.05 [final exam](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/pages/exams/){ .external-link }, closed book, limited to the classes taken.
- `leetcode`{ data-step=lc-22 } Dynamic programming, a second set. [1143. Longest Common Subsequence](https://leetcode.com/problems/longest-common-subsequence/), [139. Word Break](https://leetcode.com/problems/word-break/), [416. Partition Equal Subset Sum](https://leetcode.com/problems/partition-equal-subset-sum/), [64. Minimum Path Sum](https://leetcode.com/problems/minimum-path-sum/). All medium.
- `leetcode`{ data-step=lq-20 } SQL, mixed. [585. Investments in 2016](https://leetcode.com/problems/investments-in-2016/), [626. Exchange Seats](https://leetcode.com/problems/exchange-seats/), [1158. Market Analysis I](https://leetcode.com/problems/market-analysis-i/). All medium.

**After this week.** Gradient boosting, and what XGBoost and LightGBM add to it in regularization, speed and the handling of categorical features. Model comparison on held-out data, with a metric chosen for the cost of each kind of error. Probability and statistics under exam conditions a second time. Dynamic programming over two sequences and over a grid.

## Week 24

- `project`{ data-step=cp-04 } Capstone. Error analysis.
- `statquest`{ data-step=sv-18 } Videos. [Hierarchical Clustering](https://youtu.be/7xHsRkOdVwo){ .external-link }.
- `review`{ data-step=rv-02 } Every line under After this week from weeks 15 to 22, explained aloud without notes. A gap sends its topic back to the chapter.
- `leetcode`{ data-step=lc-23 } Matrices, then design. [54. Spiral Matrix](https://leetcode.com/problems/spiral-matrix/), [48. Rotate Image](https://leetcode.com/problems/rotate-image/), [146. LRU Cache](https://leetcode.com/problems/lru-cache/), [380. Insert Delete GetRandom O(1)](https://leetcode.com/problems/insert-delete-getrandom-o1/). All medium.
- `leetcode`{ data-step=lq-21 } SQL, mixed. [608. Tree Node](https://leetcode.com/problems/tree-node/), [1070. Product Sales Analysis III](https://leetcode.com/problems/product-sales-analysis-iii/), [1393. Capital Gain/Loss](https://leetcode.com/problems/capital-gainloss/). All medium.

**After this week.** Where the model fails and why. Each model of the plan explained in plain words, with its assumptions and the way it is tuned. Hierarchical clustering in outline. A matrix walked in place, and a data structure built for constant-time operations.

## Week 25

- `project`{ data-step=cp-05 } Capstone. The report, stating what the model cannot do.
- `review`{ data-step=rv-04 } Three case studies, talked through aloud in fifteen minutes each and recorded. A fraud alert model, a customer churn model and an A/B test, each taken from the business question to the data, the target, the metric, the model, its validation, and the decision each possible outcome supports.
- `review`{ data-step=rv-05 } A timed multiple-choice mock exam on the plan's topics, at about 18 seconds a question, then every miss traced back to its week.
- `review`{ data-step=rv-03 } Two timed rehearsals, unaided. Two LeetCode mediums in 45 minutes and three SQL problems in 30, then the capstone presented in five minutes.
- `leetcode`{ data-step=lc-24 } Mixed, timed. [57. Insert Interval](https://leetcode.com/problems/insert-interval/), [398. Random Pick Index](https://leetcode.com/problems/random-pick-index/), [384. Shuffle an Array](https://leetcode.com/problems/shuffle-an-array/), [74. Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/). All medium.
- `leetcode`{ data-step=lq-22 } SQL, mixed, timed. [3220. Odd and Even Transactions](https://leetcode.com/problems/odd-and-even-transactions/), [3421. Find Students Who Improved](https://leetcode.com/problems/find-students-who-improved/), [3497. Analyze Subscription Conversion](https://leetcode.com/problems/analyze-subscription-conversion/). All medium.

**After this week.** A medium problem solved and explained inside twenty-five minutes. A multiple-choice question on any topic of the plan answered in under twenty seconds. A case taken aloud from the business question to the decision its outcome supports. A finished project defended end to end.

## Week 26

A catch-up week with no new material. Whatever slipped is finished, and every LeetCode problem that needed its solution is solved again unaided.

---

## After the plan

The parts cut here come first, which are the rest of 18.06SC, classes 13 to 16 of 18.05, weeks 5, 7 to 11 and 13 of 6.036 and the remaining chapters of the book. Then follow [18.650 Statistics for Applications](https://ocw.mit.edu/courses/18-650-statistics-for-applications-fall-2016/){ .external-link } for the theory under 18.05, [18.065 Matrix Methods in Data Analysis, Signal Processing, and Machine Learning](https://ocw.mit.edu/courses/18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018/){ .external-link } for linear algebra pointed at data, [6.S191 Introduction to Deep Learning](https://introtodeeplearning.com/){ .external-link }, [15.071 The Analytics Edge](https://ocw.mit.edu/courses/15-071-the-analytics-edge-spring-2017/){ .external-link } for case-driven modelling, and [RES.6-012 Introduction to Probability](https://ocw.mit.edu/courses/res-6-012-introduction-to-probability-spring-2018/){ .external-link } for deeper probability. The [MIT Roadmap](../pandas/mit-roadmap.md) page describes several of them.

---

## Sources

Every page below was read on 2026-11-17 or 2026-11-18, and quoted text is verbatim. MIT OpenCourseWare is free, needs no enrolment, grants no credit or certificate, and is licensed CC BY-NC-SA. The MIT Open Learning Library is free with optional enrolment. LeetCode refuses automated readers, so problem numbers, titles and difficulty come from a public mirror generated from its problem list.

| source | used for |
|---|---|
| [The Python Tutorial](https://docs.python.org/3/tutorial/index.html){ .external-link } | Python |
| [Python documentation](https://docs.python.org/3/){ .external-link } | Truth value testing and the programming FAQ |
| [MIT OCW 18.01SC, Fall 2010](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/){ .external-link } | Single-variable calculus |
| [MIT OCW 18.02SC, Fall 2010](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/){ .external-link } | Vectors, partial derivatives, double integrals |
| [CS50's Introduction to Databases with SQL](https://cs50.harvard.edu/sql/){ .external-link } | SQL |
| [PostgreSQL tutorial, Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html){ .external-link } | SQL window functions |
| [Python for Data Analysis, 3rd edition](https://wesmckinney.com/book/){ .external-link } | NumPy and pandas |
| [MIT OCW 18.05, Spring 2022](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/){ .external-link } | Probability and statistics |
| [MIT OCW RES.18-010](https://ocw.mit.edu/courses/res-18-010-a-2020-vision-of-linear-algebra-spring-2020/){ .external-link } | Linear algebra overview |
| [MIT OCW 18.06SC, Fall 2011](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/){ .external-link } | Linear algebra |
| [MIT OLL 6.036](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/about){ .external-link } | Machine learning |
| [An Introduction to Statistical Learning](https://www.statlearning.com/){ .external-link } | Applied machine learning |
| [doocs/leetcode](https://github.com/doocs/leetcode){ .external-link } | LeetCode problem numbers, titles and difficulty |
| [MIT OCW 6.006, Spring 2020](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/){ .external-link } | Algorithms behind the LeetCode patterns, on demand |
| [StatQuest video index](https://statquest.org/video_index.html){ .external-link } | The weekly videos on statistics and machine learning |
| [pandas documentation](https://pandas.pydata.org/docs/){ .external-link } | Reference |
| [scikit-learn documentation](https://scikit-learn.org/stable/){ .external-link } | Metrics, cross-validation, preprocessing, support vector machines, gradient boosting |
| [MIT 6.S191 Introduction to Deep Learning](https://introtodeeplearning.com/){ .external-link } | Autoencoders |
| [XGBoost documentation](https://xgboost.readthedocs.io/en/stable/){ .external-link } | Gradient boosting |
| [LightGBM documentation](https://lightgbm.readthedocs.io/en/latest/){ .external-link } | Gradient boosting |
| [uv documentation](https://docs.astral.sh/uv/){ .external-link } | Environment |
| [MIT OCW terms of use](https://ocw.mit.edu/pages/privacy-and-terms-of-use/){ .external-link } | Licence |
