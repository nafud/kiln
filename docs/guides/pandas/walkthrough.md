# Walkthrough

One table taken from the first `read_csv` to a cross-validated score, thirty-four cells in notebook order, each with its code, the output it printed, and what every call does. The file is an employee attrition table of 3540 rows, published at [employees.csv](../../assets/pandas/employees.csv) so every output below can be reproduced from the URL in cell 1.

---

## Essentials

```python
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, recall_score, roc_auc_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("https://nafud.github.io/kiln/assets/pandas/employees.csv")
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)
df = df.drop_duplicates().reset_index(drop=True)
df["monthly_salary"] = pd.to_numeric(df["monthly_salary"], errors="coerce")
df["department"] = df["department"].str.strip().str.lower()
df["hire_date"] = pd.to_datetime(df["hire_date"])
df = df.drop(columns=["employee_id"])
X = df.drop(columns=["attrition", "hire_date"])
y = df["attrition"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
num_cols = X.select_dtypes(include="number").columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]
num_pipe = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
cat_pipe = Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))])
pre = ColumnTransformer([("num", num_pipe, num_cols), ("cat", cat_pipe, cat_cols)])
model = Pipeline([("pre", pre), ("clf", LogisticRegression(max_iter=1000))]).fit(X_train, y_train)
pred = model.predict(X_test)
proba = model.predict_proba(X_test)[:, 1]
round(accuracy_score(y_test, pred), 3), round(f1_score(y_test, pred), 3), round(roc_auc_score(y_test, proba), 3)
cross_val_score(model, X, y, cv=5, scoring="roc_auc").round(3)
```

---

## The rule behind every cell

Look, fix, assign, check. Print what a column contains before changing it, change it, assign the result back (pandas methods return a new object and leave the original alone), then print the shape or the counts again to confirm the change did what was meant and nothing more.

The outputs below come from pandas 3.0.5 and scikit-learn 1.9.1. On pandas 2.x two things print differently and nothing else changes. Text columns show as `object` instead of `str`, and dates show as `datetime64[ns]` instead of `datetime64[us]`.

---

## Load and look

### Cell 1. Load

```python
import pandas as pd
import numpy as np

df = pd.read_csv("https://nafud.github.io/kiln/assets/pandas/employees.csv")
df.shape
```

```text
(3540, 12)
```

`read_csv` reads the first line as the header and infers one dtype per column from the values below it. A column becomes `int64` only if every value parses as an integer, `float64` if any value has decimals or is missing (NaN is a float), and text otherwise. `shape` is an attribute, not a method, so no parentheses. The two numbers are the reference every later shape is compared against.

### Cell 2. First look

```python
df.head()
```

```text
  Employee ID   Hire Date  Age   Department   Job Role Education  Years at Company Monthly Salary  Over-Time Hours  Satisfaction Score  Distance-km  Attrition
0      E10791  2019-01-15   53  ENGINEERING    Manager    Master                10           7700             33.5                 3.1         24.2          0
1      E13210  2016-07-27   39  Engineering    Analyst       PhD                14           5000              4.6                 3.0          7.6          0
2      E11334  2020-09-23   60      Support    Manager    Master                 0           4610              7.3                 3.3         19.3          0
3      E10169  2023-10-20   39      Support  Associate  Bachelor                14          10160              3.9                 2.7          3.6          0
4      E11239  2015-09-09   30  ENGINEERING  Associate    Master                12           7990              4.8                 3.3         25.3          0
```

Five rows are enough to see the shape of each column. Already visible are column names with spaces and a hyphen, dates in ISO year-month-day order (so no `dayfirst` question later), `Department` in two spellings of the same word in rows 0 and 1, and an integer target in the last column. Nothing is fixed yet. This cell only says what to check.

### Cell 3. Types and missing counts

```python
df.info()
```

```text
<class 'pandas.DataFrame'>
RangeIndex: 3540 entries, 0 to 3539
Data columns (total 12 columns):
 #   Column              Non-Null Count  Dtype
---  ------              --------------  -----
 0   Employee ID         3540 non-null   str
 1   Hire Date           3540 non-null   str
 2   Age                 3540 non-null   int64
 3   Department          3540 non-null   str
 4   Job Role            3540 non-null   str
 5   Education           3540 non-null   str
 6   Years at Company    3540 non-null   int64
 7   Monthly Salary      3540 non-null   str
 8   Over-Time Hours     3540 non-null   float64
 9   Satisfaction Score  3415 non-null   float64
 10  Distance-km         3540 non-null   float64
 11  Attrition           3540 non-null   int64
dtypes: float64(3), int64(3), str(6)
memory usage: 332.0 KB
```

`info` prints itself, so no `print` around it. Two findings. `Monthly Salary` is text although it looks like a number in `head`, which means at least one value in it is not a number, and that is the first thing to hunt. `Satisfaction Score` has 3415 non-null values out of 3540, so 125 are missing already. Empty cells in the CSV were turned into NaN by `read_csv` because the empty string is in its default list of missing markers.

### Cell 4. Numeric summary

```python
df.describe().round(2)
```

```text
           Age  Years at Company  Over-Time Hours  Satisfaction Score  Distance-km  Attrition
count  3540.00           3540.00          3540.00             3415.00      3540.00    3540.00
mean     41.56             10.05             7.97                3.40        13.88       0.15
std      11.56              6.02             5.50                0.78         9.88       0.36
min      22.00              0.00             0.10                1.00         0.00       0.00
25%      31.00              5.00             3.90                2.90         6.60       0.00
50%      42.00             10.00             7.00                3.40        11.80       0.00
75%      52.00             15.00            10.60                3.90        18.80       0.00
max      61.00             20.00            38.90                5.00        85.50       1.00
```

`describe` summarises numeric columns only, which is why salary is absent again. `min` and `max` are read against common sense. Ages 22 to 61, tenure 0 to 20 years, satisfaction on a 1 to 5 scale, distance up to 85.5 km with a 75th percentile of 18.8, a long but believable tail. No impossible values, so no range rule is needed on this file. The `Attrition` mean of 0.15 is the share of leavers, the first number of the written result.

### Cell 5. Text summary

```python
df.describe(exclude="number")
```

```text
       Employee ID   Hire Date   Department Job Role Education Monthly Salary
count         3540        3540         3540     3540      3540           3540
unique        3500        2249           20        5         4              815
top         E12508  2016-04-30  Engineering  Analyst  Bachelor                ?
freq             2           6         1062     1099      1724               62
```

`exclude="number"` works on both pandas 2 and 3 (`include="object"` warns on pandas 3). This one table finds three problems at once. `Employee ID` has 3500 unique values in 3540 rows, so 40 rows repeat an identifier, almost certainly exact duplicates. `Department` has 20 unique values where five departments exist, so spelling variants. `Monthly Salary` has `?` as its most frequent value, 62 times, which is the placeholder that made the column text. `Hire Date` with 2249 unique values is a date column that `read_csv` left as text, to be converted later.

---

## Clean

### Cell 6. Column names

```python
df.columns.tolist()
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)
df.columns.tolist()
```

```text
['Employee ID', 'Hire Date', 'Age', 'Department', 'Job Role', 'Education', 'Years at Company', 'Monthly Salary', 'Over-Time Hours', 'Satisfaction Score', 'Distance-km', 'Attrition']
['employee_id', 'hire_date', 'age', 'department', 'job_role', 'education', 'years_at_company', 'monthly_salary', 'over_time_hours', 'satisfaction_score', 'distance_km', 'attrition']
```

`df.columns` is an Index, and `.str` gives it the string methods. `strip` removes leading and trailing whitespace, `lower` makes the case uniform, and the regular expression `[\s-]+` matches a run of one or more whitespace characters or hyphens and replaces the whole run with a single underscore (`regex=True` is required, otherwise the pattern is taken literally). The result is assigned back to `df.columns`. The methods return a new Index and change nothing by themselves. Snake-case names mean no quoting of spaces in every later line and no typo between `Over-Time` and `Over Time`.

### Cell 7. Duplicates

```python
df.duplicated().sum()
df = df.drop_duplicates().reset_index(drop=True)
df.shape
```

```text
40
(3500, 12)
```

`duplicated()` returns a boolean per row, True for every row that is an exact copy of an earlier row (all twelve columns equal), and `sum` counts the Trues because True counts as 1. `drop_duplicates()` keeps the first occurrence and drops the later copies. The 40 matches the 40 surplus identifiers from cell 5, which confirms these are whole-row copies and not two people sharing an ID. The dropped rows leave gaps in the index labels, and `reset_index(drop=True)` renumbers them from 0 again. Without `drop=True` the old labels come back as a new column named `index`, which later lands in the model as a meaningless numeric feature. The shape check confirms exactly 40 rows went and no column changed.

### Cell 8. Missing values

```python
df.isna().sum()
```

```text
employee_id             0
hire_date               0
age                     0
department              0
job_role                0
education               0
years_at_company        0
monthly_salary          0
over_time_hours         0
satisfaction_score    120
distance_km             0
attrition               0
dtype: int64
```

`isna()` is a True/False table the same shape as the frame, and `sum` counts per column. Satisfaction is down from 125 missing to 120 because five of the missing values sat in duplicated rows. Salary shows zero missing, which is wrong in spirit. The `?` values are present as text, so pandas does not count them. That is the next cell.

### Cell 9. Disguised missing values

```python
df.isin(["", " ", "?", "NA", "N/A", "null", "None"]).sum()
```

```text
employee_id            0
hire_date              0
age                    0
department             0
job_role               0
education              0
years_at_company       0
monthly_salary        60
over_time_hours        0
satisfaction_score     0
distance_km            0
attrition              0
dtype: int64
```

`isin` tests every cell against a list of the usual placeholders. Sixty `?` remain in salary after deduplication (62 before, two of them were in the dropped copies). This cell runs on every new file. A placeholder that survives into the model becomes either a crash (text in a numeric column) or a silent category called `?`.

### Cell 10. What exactly fails to parse

```python
bad = df.loc[pd.to_numeric(df["monthly_salary"], errors="coerce").isna(), "monthly_salary"]
bad.value_counts(dropna=False)
```

```text
monthly_salary
?    60
Name: count, dtype: int64
```

Before converting a column, look at what the conversion will destroy. `pd.to_numeric` with `errors="coerce"` returns the parsed numbers with NaN where parsing failed, `isna()` on that result is a mask of the failures, and `df.loc[mask, "monthly_salary"]` pulls the original text at those rows. Only `?` appears, so coercing loses nothing that could have been rescued. A value like `7,700` or `$7700` would have been fixable with a string replacement first.

### Cell 11. Salary to numeric

```python
df["monthly_salary"] = pd.to_numeric(df["monthly_salary"], errors="coerce")
df["monthly_salary"].dtype, df["monthly_salary"].isna().sum()
df["monthly_salary"].describe().round(1)
```

```text
float64 60
count     3440.0
mean      6201.7
std       1922.0
min       1860.0
25%       4850.0
50%       6015.0
75%       7310.0
max      16580.0
Name: monthly_salary, dtype: float64
```

Now the conversion is assigned back. The dtype is `float64` rather than `int64` because NaN cannot live in an integer column. Sixty missing salaries, exactly the sixty `?`, so the check closes the loop with cell 9. The range 1860 to 16580 is plausible for a monthly salary, nothing to clip. The missing values stay missing here. They are filled inside the model pipeline in cell 29, so the fill value is learned from the training rows only.

### Cell 12. Department spellings

```python
df["department"].value_counts()
df["department"] = df["department"].str.strip().str.lower()
df["department"].value_counts()
```

```text
department
Engineering      1054
Sales             808
Support           637
Marketing         308
Finance           295
ENGINEERING        95
 Engineering       51
SALES              47
SUPPORT            44
 Sales             41
 Support           36
FINANCE            22
 Finance           18
 Marketing         18
MARKETING          15
 ENGINEERING        4
 SUPPORT            3
 SALES              2
 MARKETING          1
 FINANCE            1
Name: count, dtype: int64
department
engineering    1204
sales           898
support         720
marketing       342
finance         336
Name: count, dtype: int64
```

`value_counts` lists each distinct value with its frequency, most common first. The twenty variants are five names in different case, some with a leading space. The same two string methods as on the column names fix them, and the second `value_counts` shows five clean categories whose counts add up to 3500. Left as is, the one-hot encoder in cell 29 would have produced twenty department columns and the groupby in cell 18 twenty rows.

### Cell 13. The other text columns

```python
for c in ["job_role", "education"]:
    print(df[c].value_counts(dropna=False), "\n")
```

```text
job_role
Analyst      1086
Engineer     1014
Associate     697
Manager       538
Director      165
Name: count, dtype: int64

education
Bachelor       1709
Master         1034
High school     557
PhD             200
Name: count, dtype: int64
```

Every category column gets the same look, even when `describe` showed a sensible number of unique values. `dropna=False` makes a missing category show up as its own row instead of being hidden. Both columns are clean, so they are left in their original case. What matters is that each real category has exactly one spelling.

### Cell 14. Numeric ranges after cleaning

```python
df[["age", "years_at_company", "over_time_hours", "satisfaction_score", "distance_km"]].agg(["min", "max"])
```

```text
     age  years_at_company  over_time_hours  satisfaction_score  distance_km
min   22                 0              0.1                 1.0          0.0
max   61                20             38.9                 5.0         85.5
```

A compact repeat of the range check from cell 4, now on the deduplicated table. `agg` with a list of function names applies each to every column. Had a value been impossible (age 140, a negative distance), the fix would be a mask such as `df.loc[~df["age"].between(18, 70), "age"] = np.nan`, which turns the bad values into missing so the imputer handles them later. None is needed here.

### Cell 15. Hire date

```python
df["hire_date"] = pd.to_datetime(df["hire_date"])
df["hire_date"].dtype, df["hire_date"].isna().sum()
df["hire_date"].min(), df["hire_date"].max()
```

```text
datetime64[us] 0
2015-01-01 00:00:00 2024-12-27 00:00:00
```

`to_datetime` parses the text into real timestamps so that `.dt.year` and date arithmetic work. The strings are ISO year-month-day, which is unambiguous, so no `dayfirst` is needed. Two checks follow every date conversion. The count of NaT (not-a-time, the missing marker for dates) must be near zero, and the `min` and `max` must be sensible. A NaT count close to the row count means the layout was misread and the call needs `dayfirst=True`. Here it is zero and the range is ten clean years.

### Cell 16. Drop the identifier

```python
df = df.drop(columns=["employee_id"])
df.shape
df.dtypes
```

```text
(3500, 11)
hire_date             datetime64[us]
age                            int64
department                       str
job_role                         str
education                        str
years_at_company               int64
monthly_salary               float64
over_time_hours              float64
satisfaction_score           float64
distance_km                  float64
attrition                      int64
dtype: object
```

An identifier is unique per row, so it carries no pattern a model can learn, and one-hot encoding it would add 3500 columns. It was needed until cell 7 to confirm the duplicates were whole-row copies. After that it goes. The final `dtypes` is the state worth a Markdown cell. Eleven columns, one date, six numeric features, three categories, one integer target, 60 missing salaries and 120 missing satisfaction scores left for the pipeline.

---

## Questions

### Cell 17. Attrition rate

```python
df["attrition"].value_counts()
round(df["attrition"].mean(), 4)
```

```text
attrition
0    2954
1     546
Name: count, dtype: int64
0.156
```

The mean of a 0/1 column is the share of ones, so 15.6 percent of employees left. The `value_counts` beside it shows the raw counts, 546 leavers against 2954 stayers. This ratio drives two later decisions. The split must be stratified, and accuracy will be a weak metric because always predicting "stayed" already scores 84.4 percent.

### Cell 18. Attrition by department

```python
df.groupby("department")["attrition"].mean().round(3).sort_values()
```

```text
department
engineering    0.134
marketing      0.149
support        0.149
finance        0.155
sales          0.195
Name: attrition, dtype: float64
```

`groupby("department")` splits the frame into one group per department, `["attrition"]` selects the column to aggregate, and `mean()` gives the share of leavers per group. Sales loses nearly one in five, engineering about one in seven. This is the question cell 12 protected. With the raw spellings the answer would have been twenty rows with `ENGINEERING` and ` Engineering` reported separately.

### Cell 19. Median over-time by outcome

```python
df.groupby("attrition")["over_time_hours"].median()
```

```text
attrition
0    6.6
1    8.9
Name: over_time_hours, dtype: float64
```

Same pattern, grouped by the target this time. The median is used rather than the mean because over-time is right-skewed (cell 4, median 7.0, max 38.9), and a median is not pulled by the tail. Leavers worked about two more hours of over-time than stayers, a difference the coefficients confirm in cell 33.

### Cell 20. Job role with the most leavers

```python
df.loc[df["attrition"] == 1, "job_role"].value_counts()
df.loc[df["attrition"] == 1, "job_role"].value_counts().idxmax()
```

```text
job_role
Analyst      187
Engineer     144
Associate    114
Manager       74
Director      27
Name: count, dtype: int64
Analyst
```

`df.loc[mask, column]` filters rows by a boolean mask and keeps one column. `value_counts` ranks the roles among leavers, and `idxmax` returns the label of the largest count. The question asks for the most leavers in absolute terms. Analysts are also the largest role overall (cell 13), so the highest count is not the highest rate, and the two readings are kept apart when the result is reported.

### Cell 21. Engineers with more than five years

```python
mask = (df["years_at_company"] > 5) & (df["department"] == "engineering")
mask.sum()
```

```text
882
```

Two conditions combined with `&`. Each side needs its own parentheses because `&` binds tighter than `>` and `==` in Python. Without them the expression raises or silently compares the wrong things. The string must match the cleaned spelling, lowercase, which is why cleaning comes before questions.

### Cell 22. Tenure bands

```python
df["tenure_band"] = pd.cut(df["years_at_company"], bins=[-1, 2, 7, 30], labels=["0-2", "3-7", "8+"])
df["tenure_band"].value_counts().sort_index()
df.groupby("tenure_band", observed=True)["attrition"].mean().round(3)
```

```text
tenure_band
0-2     500
3-7     792
8+     2208
Name: count, dtype: int64
tenure_band
0-2    0.250
3-7    0.176
8+     0.128
Name: attrition, dtype: float64
```

`pd.cut` assigns each value to a bin. Bins are right-inclusive by default, so `(-1, 2]` holds 0, 1 and 2, `(2, 7]` holds 3 to 7, and `(7, 30]` holds 8 and above. The lower edge is -1 rather than 0 so that a tenure of exactly 0 is inside the first bin instead of falling out as NaN. Three labels need four edges. `observed=True` in the groupby silences the pandas warning about categorical groupers and drops empty bins. The pattern is monotone. A quarter of new hires leave, one in eight of the long-tenured.

### Cell 23. Hires per year

```python
df["hire_date"].dt.year.value_counts().sort_index()
```

```text
hire_date
2015    358
2016    324
2017    359
2018    366
2019    329
2020    381
2021    337
2022    343
2023    349
2024    354
Name: count, dtype: int64
```

`.dt` is the accessor for datetime columns, available only because cell 15 converted the column. On a text column it raises `AttributeError: Can only use .dt accessor with datetimelike values`. `value_counts` sorts by frequency, so `sort_index` is added to put the years in order.

### Cell 24. Correlation

```python
round(df["years_at_company"].corr(df["monthly_salary"]), 3)
```

```text
0.471
```

Pearson correlation between two Series, missing salaries skipped pairwise. A moderate positive relationship, longer tenure and higher pay, as expected. The number is reported with its sign and a plain reading, never alone.

---

## Model

```python
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, recall_score, roc_auc_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
```

Seven imports, one cell, run before anything else. Each name is used below exactly where its module suggests. `compose` combines column groups, `impute` fills, `metrics` scores, `model_selection` splits and cross-validates, `pipeline` chains, `preprocessing` encodes and scales.

### Cell 25. Features and target

```python
X = df.drop(columns=["attrition", "hire_date", "tenure_band"])
y = df["attrition"]
X.shape, y.shape
X.columns.tolist()
```

```text
(3500, 9) (3500,)
['age', 'department', 'job_role', 'education', 'years_at_company', 'monthly_salary', 'over_time_hours', 'satisfaction_score', 'distance_km']
```

Three columns leave the feature table for three different reasons. `attrition` is the target, and leaving it in `X` would give a perfect, useless model. `hire_date` is a timestamp, which the imputer and scaler cannot process, and its information is already in `years_at_company`. `tenure_band` was derived from `years_at_company` in cell 22, so it would be the same information twice. Nine features remain, six numeric and three categorical.

### Cell 26. Split

```python
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
X_train.shape, X_test.shape
round(y_train.mean(), 4), round(y_test.mean(), 4)
```

```text
(2800, 9) (700, 9)
0.1561 0.1557
```

The four outputs come back in this fixed order, train features, test features, train target, test target. `test_size=0.2` holds out 700 rows. `stratify=y` makes the split keep the class ratio, which the two means confirm at 15.6 percent each. Without it a random split could land the test set at 13 or 18 percent and shift every metric. `random_state=42` makes the split reproducible so the numbers here can be matched. From here on the test set is untouched until cell 30.

### Cell 27. Baseline

```python
round(max(y_test.mean(), 1 - y_test.mean()), 3)
```

```text
0.844
```

The accuracy of always predicting the majority class on the test set. `y_test.mean()` is the share of ones, `1 - y_test.mean()` the share of zeros, and the larger of the two is what a model that ignores the features would score. Any model has to beat 0.844 on accuracy to be worth anything, and this single number is why accuracy will not be the headline metric.

### Cell 28. Column lists

```python
num_cols = X.select_dtypes(include="number").columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]
num_cols
cat_cols
```

```text
['age', 'years_at_company', 'monthly_salary', 'over_time_hours', 'satisfaction_score', 'distance_km']
['department', 'job_role', 'education']
```

`select_dtypes(include="number")` picks every integer and float column, so it works on both pandas versions regardless of whether text shows as `object` or `str`. The categorical list is defined as everything else, so no column can be forgotten. Salary is numeric now because cell 11 converted it. Had that step been skipped it would land in `cat_cols` and be one-hot encoded into 815 columns.

### Cell 29. Preprocessing and model

```python
num_pipe = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
cat_pipe = Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                     ("onehot", OneHotEncoder(handle_unknown="ignore"))])
pre = ColumnTransformer([("num", num_pipe, num_cols), ("cat", cat_pipe, cat_cols)])
model = Pipeline([("pre", pre), ("clf", LogisticRegression(max_iter=1000))])
model.fit(X_train, y_train)
model.named_steps["pre"].get_feature_names_out().tolist()
```

```text
['num__age', 'num__years_at_company', 'num__monthly_salary', 'num__over_time_hours', 'num__satisfaction_score', 'num__distance_km', 'cat__department_engineering', 'cat__department_finance', 'cat__department_marketing', 'cat__department_sales', 'cat__department_support', 'cat__job_role_Analyst', 'cat__job_role_Associate', 'cat__job_role_Director', 'cat__job_role_Engineer', 'cat__job_role_Manager', 'cat__education_Bachelor', 'cat__education_High school', 'cat__education_Master', 'cat__education_PhD']
```

Four objects, built inside out.

The numeric pipeline first fills missing values with the column median (robust to the skew seen in cell 4) and then standardises each column to mean 0 and standard deviation 1. Scaling matters for logistic regression because its solver converges faster on comparable scales and its coefficients become comparable across features. It would be pointless for a tree model.

The categorical pipeline fills a missing category with the most frequent one and then one-hot encodes, one 0/1 column per category. `handle_unknown="ignore"` means a category seen at prediction time but not during fitting becomes all zeros instead of an error. It costs nothing and prevents a crash on the test set or on new data.

`ColumnTransformer` routes each column list to its pipeline and concatenates the results. A column named in neither list is dropped. The outer `Pipeline` chains the preprocessor and the classifier, so `fit` learns the medians, the scaler's means, the category lists and the regression weights from the training rows only, and `predict` applies the same learned values to new rows. `max_iter=1000` removes the convergence warning the default of 100 sometimes triggers.

The feature names show what the model sees. Six scaled numbers and fourteen indicator columns, twenty in total, each prefixed by the transformer that produced it.

### Cell 30. Predictions

```python
pred = model.predict(X_test)
proba = model.predict_proba(X_test)[:, 1]
pred[:10]
proba[:5].round(3)
pred.mean().round(4), y_test.mean().round(4)
```

```text
[0 0 0 0 0 0 0 0 0 0]
[0.135 0.137 0.142 0.322 0.313]
0.0114 0.1557
```

`predict` returns the class, which is 1 when the probability of class 1 is at least 0.5. `predict_proba` returns one column per class in class order, so `[:, 1]` is the probability of attrition. The third line is the diagnosis. The model predicts a leaver for 1.1 percent of the test rows while 15.6 percent actually leave. Probabilities around 0.13 to 0.32 rarely cross 0.5, so the default threshold almost never fires, and that is the reason the metrics in the next cell look the way they do.

### Cell 31. Metrics at the default threshold

```python
print("accuracy", round(accuracy_score(y_test, pred), 3))
print("f1      ", round(f1_score(y_test, pred), 3))
print("auc     ", round(roc_auc_score(y_test, proba), 3))
confusion_matrix(y_test, pred)
```

```text
accuracy 0.847
f1       0.085
auc      0.69
[[588   3]
 [104   5]]
```

Accuracy 0.847 against a baseline of 0.844. The model is barely better than guessing "stayed" for everyone, and the confusion matrix explains why. Rows are the truth (0 then 1), columns the prediction (0 then 1). 588 stayers correctly kept, 3 stayers wrongly flagged, 104 leavers missed, 5 leavers caught. Recall is 5 of 109, under 5 percent, and F1, the harmonic mean of precision and recall, follows it down to 0.085. AUC is the one metric that uses `proba` instead of `pred`, so it does not depend on the threshold. 0.69 says the model ranks a random leaver above a random stayer 69 percent of the time, modest but clearly above the 0.5 of a coin. Accuracy and F1 take the hard labels, AUC takes the probabilities. Passing `pred` to `roc_auc_score` is a common mistake that silently gives a worse number.

### Cell 32. Threshold 0.3

```python
pred03 = (proba >= 0.3).astype(int)
print("recall  ", round(recall_score(y_test, pred03), 3))
print("f1      ", round(f1_score(y_test, pred03), 3))
print("accuracy", round(accuracy_score(y_test, pred03), 3))
confusion_matrix(y_test, pred03)
```

```text
recall   0.239
f1       0.301
accuracy 0.827
[[553  38]
 [ 83  26]]
```

A new label vector is made by comparing the probabilities with 0.3 and converting the booleans to integers. Nothing is refitted, only the cut point moves. Recall rises from 0.046 to 0.239 (26 of 109 leavers caught instead of 5), F1 more than triples to 0.301, and accuracy drops two points because 38 stayers are now flagged. That trade is the point of a threshold. When missing a leaver costs more than a false alarm, as in retention work, the lower threshold is the better model even though its accuracy is lower. The sentence for the written result is that at threshold 0.3 the model catches 24 percent of leavers at the cost of flagging 6 percent of stayers.

### Cell 33. Coefficients

```python
names = model.named_steps["pre"].get_feature_names_out()
coef = pd.Series(model.named_steps["clf"].coef_[0], index=names).sort_values()
coef.round(3)
```

```text
num__satisfaction_score       -0.557
num__years_at_company         -0.466
cat__department_finance       -0.178
cat__job_role_Manager         -0.170
cat__department_marketing     -0.111
cat__job_role_Engineer        -0.102
cat__department_engineering   -0.094
cat__education_High school    -0.033
cat__education_PhD            -0.032
num__monthly_salary            0.007
cat__education_Master          0.012
cat__education_Bachelor        0.049
cat__job_role_Analyst          0.067
num__age                       0.068
cat__department_support        0.074
cat__job_role_Associate        0.079
cat__job_role_Director         0.122
num__distance_km               0.198
cat__department_sales          0.304
num__over_time_hours           0.396
dtype: float64
```

`named_steps` reaches into the pipeline by the names given in cell 29. The preprocessor provides the feature names in the order the classifier saw them, and `coef_[0]` is the weight vector for the single positive class. Pairing them in a Series and sorting gives a readable ranking. The coefficients are log-odds changes per unit of the transformed feature. Because the numeric features are scaled, one unit is one standard deviation, so their sizes are comparable with each other. One standard deviation more satisfaction lowers the log-odds of leaving by 0.56, one more of tenure by 0.47, one more of over-time raises it by 0.40. Indicator coefficients are compared within their own group. Sales is the department most associated with leaving, finance the least. Every sign agrees with cells 18, 19 and 22, which is the sanity check. A sign that contradicts the groupbys is the first place to suspect leakage or a column mix-up.

### Cell 34. Cross-validation

```python
cv = cross_val_score(model, X, y, cv=5, scoring="roc_auc")
cv.round(3), round(cv.mean(), 3), round(cv.std(), 3)
```

```text
[0.718 0.695 0.69  0.714 0.743] mean 0.712 std 0.019
```

A prediction is written down before this cell runs. The single test AUC of 0.69 came from one 700-row split, and with a leaver share of 15.6 percent roughly 109 leavers decide the number, so it should move by a few hundredths across folds. `cross_val_score` splits the full table into five folds, and for each fold refits the whole pipeline on the other four and scores on the held-out one. Because the imputer and scaler sit inside the pipeline, they are refitted per fold and no test rows leak into the training statistics. Five scores between 0.69 and 0.74, mean 0.71 with a standard deviation of 0.02, put the earlier 0.69 at the lower edge of normal variation. The number to report is 0.71 with its spread, not the single split.

---

## The written result

The last cell is Markdown, written before Restart and Run All, and it carries in this order the data (3540 rows loaded, 40 duplicates removed, 60 salary placeholders and 120 missing satisfaction scores imputed with the median inside the pipeline, five department spellings merged), the headline answers (attrition 15.6 percent, highest in sales at 19.5 percent, leavers work a median 8.9 over-time hours against 6.6, new hires leave at twice the rate of the long-tenured), the model (logistic regression on nine features, stratified 80/20 split, baseline accuracy 0.844), the result (AUC 0.71 by five-fold cross-validation, test AUC 0.69, at threshold 0.3 recall 0.24 and F1 0.30), the drivers (low satisfaction, short tenure and over-time push attrition up, the sales department too), and one limitation plus one next step (no date features beyond tenure were used; a gradient boosting model and a cost-based threshold are the next things to try).

---

## Common mistakes

| mistake | where it bites | the cell that prevents it |
|---|---|---|
| `reset_index()` without `drop=True` | an `index` column becomes a model feature | 7 |
| Trusting `isna()` alone | 60 `?` salaries reach the model as text | 9 and 10 |
| Converting without looking first | a fixable value is silently destroyed | 10 before 11 |
| Forgetting to assign the result back | the column looks fixed in the output but is not | 6, 11, 12, 15 |
| Not checking NaT after `to_datetime` | a misread date layout empties the column | 15 |
| Leaving the identifier in `X` | thousands of useless one-hot columns | 16 |
| Missing parentheses around `&` conditions | a wrong count or an error | 21 |
| Bins and labels off by one in `pd.cut` | a `ValueError` or rows lost as NaN | 22 |
| Passing `pred` instead of `proba` to AUC | a wrong, lower AUC | 31 |
| Reading accuracy without the baseline | 0.847 looks good, it is 0.003 above guessing | 27 and 31 |
| Reporting the single-split score | 0.69 instead of 0.71 with its spread | 34 |
