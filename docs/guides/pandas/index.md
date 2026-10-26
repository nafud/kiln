# Pandas

A data-cleaning procedure for a fresh CSV, from load to the point where the frame is ready to split, followed by the analysis idioms that answer questions about the cleaned frame. Each cleaning step looks before it changes anything, assigns the result back, and checks that the change landed. The example is a telecom churn table with a `churned` target.

## Clean-Up

Thirteen steps in a fixed order. Each one is a look, a fix that assigns back to `df`, and a check.

### Setup

```python
import pandas as pd
import numpy as np

df = pd.read_csv("datasets/churn.csv")
raw = df.copy()
```

`raw` is never modified. It answers what a value was before a conversion turned it into `NaN`, and it is the fallback when a step goes wrong.

---

### Deduplication

```python
df.duplicated().sum()                      # look
df = df.drop_duplicates()                  # fix + assign
df.shape                                   # check
```

`drop_duplicates` returns a new frame and leaves `df` as it was until the result is assigned back. The same holds for every fix below.

---

### Column-name normalisation

```python
df.columns.tolist()                        # look
df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")   # fix
df.columns.tolist()                        # check
```

Lowercase names without spaces or padding spare the quoting and the guesswork in every later line.

---

### Type inspection

```python
df.dtypes
df.head()
```

A column is judged by what it holds, not by its label. Amounts stored as text, dates stored as text, and identifiers stored as integers are the usual mismatches. pandas 3 reports text columns as `str` rather than `object`.

---

### Hidden-missing scan

```python
df.isna().sum()                            # missing pandas already recognises
df.isin([" ", "", "?", "N/A"]).sum()       # missing values disguised as text
```

Runs before any conversion. `read_csv` already maps the markers in its default `na_values` list (an empty field, `NA`, `N/A`, `NaN`, `null`) to `NaN`; a single space, a question mark, or a dash survive as text and would otherwise block a numeric conversion. The count found here is what the coercion step is expected to turn into `NaN`.

---

### Type coercion, numeric

```python
df["total_charges"] = pd.to_numeric(df["total_charges"], errors="coerce")        # fix
df["total_charges"].isna().sum()                                                 # check
raw.loc[df.index[df["total_charges"].isna()], "total_charges"].value_counts()    # what the NaN used to be
```

`errors="coerce"` turns every value that does not parse into `NaN` instead of raising. The new `NaN` count is compared with the sentinel count from the scan; a difference means a format the scan did not list. The `raw` lookup goes through index labels, which survive `drop_duplicates`, so it works after rows have been removed. Indexing `raw` with the boolean mask itself raises once `df` is shorter than `raw` (pandas 3.0.5).

---

### Type coercion, datetime

```python
df["signup_date"] = pd.to_datetime(df["signup_date"], errors="coerce")      # fix
df["signup_date"].isna().sum(), df["signup_date"].min(), df["signup_date"].max()   # check NaT and range
df["signup_year"] = df["signup_date"].dt.year                               # extract
df["signup_month"] = df["signup_date"].dt.month
df = df.drop(columns=["signup_date"])                                       # drop raw datetime
```

Unparseable dates become `NaT`. The minimum and maximum expose a swapped day and month or a placeholder year before they become features. Models take numbers, not timestamps, so the date is reduced to the parts that carry signal and the timestamp column is dropped.

---

### Categorical-label normalisation

```python
df["contract"].value_counts()                                   # look
df["contract"] = df["contract"].str.strip().str.lower()         # fix + assign
df["contract"].value_counts()                                   # check
```

`value_counts` lists every spelling as its own row; stripping and lowercasing merges the ones that differ only in case or padding. A spelling that differs in more than that needs an explicit `replace` afterwards.

---

### Missing-value audit

```python
df.isna().sum()
```

After the conversions every missing value, declared or disguised, is a `NaN`, so this one count is the complete picture and sets the imputation work.

---

### Imputation

```python
df[["tenure_months", "total_charges"]].describe()                                     # mean vs 50%
df["tenure_months"] = df["tenure_months"].fillna(df["tenure_months"].median())        # symmetric -> median (= mean here)
df["total_charges"] = df["total_charges"].fillna(df["monthly_charges"] * df["tenure_months"])   # reconstructable
df.isna().sum()                                                                       # check: all zero
```

The fill depends on the column. When `mean` and `50%` agree the distribution is symmetric and either works; when they diverge the median is the robust choice, since a long tail drags the mean. A column that is a function of others is reconstructed from them rather than guessed, which is why `tenure_months` is filled first (the reconstruction of `total_charges` reads it). A categorical column takes its mode or an explicit `"missing"` label.

---

### Range validation

```python
df.describe().T
```

Minimum and maximum of every numeric column against what is physically possible. A negative tenure or an age of 200 is an error to fix or drop; a large but possible value is an outlier and stays, since clipping or a log transform is a modelling decision rather than a cleaning one. `.T` transposes the display only and leaves `df` as it is.

---

### Feature pruning

```python
df.nunique()                               # look
df = df.drop(columns=["customer_id"])      # fix + assign
df.shape                                   # check
```

A `nunique` equal to the row count marks an identifier, a `nunique` of 1 marks a constant; neither carries signal. A column that is only known after the target is decided (a leak) goes with them.

---

### Final verification

```python
print(df.shape)
print(df.dtypes)
print(df.isna().sum().sum())
print(df["churned"].mean().round(3))
```

A notebook cell displays only its last expression, hence one `print` per line. Four facts are confirmed before the split. The shape is the planned one, no column that should be numeric is still `str`, the missing count is zero, and the target rate matches the raw file (a changed rate means rows were lost unevenly). `mean()` returns a NumPy float, which has a `round` method; a plain Python float, such as the value a scikit-learn metric returns, does not and takes the built-in `round(x, 3)` instead.

---

## Analysis

Answering questions about the cleaned table. Every question is one of five patterns, each a short chain of methods on `df`.

---

### The five patterns

| pattern | question shape | idiom |
|---|---|---|
| aggregate | one number for the whole table | `df["col"].mean()` |
| group | one number per category | `df.groupby("key")["col"].mean()` |
| filter | rows that satisfy a condition | `df.loc[mask, "col"]` |
| derive | a new column from an old one | `pd.cut`, `pd.to_datetime`, `.dt`, `.str` |
| relate | how two columns move together | `df["a"].corr(df["b"])` |

---

### Aggregate

```python
df["churned"].mean()                      # share of 1s in a 0/1 column, the rate
df["monthly_charges"].median()            # middle value, robust to outliers
df["col"].sum() / .min() / .max() / .std() / .nunique()
```

The mean of a 0/1 column is a proportion. `mean()` returns a NumPy float, so `.round(4)` works on it.

---

### Group

```python
df.groupby("contract")["churned"].mean().round(3).sort_values()
```

Split the rows into one pile per distinct value of the key, apply the calculation to the chosen column of each pile, combine the results into a Series indexed by the key. Three slots vary, the key, the column, the calculation.

```python
df.groupby("churned")["monthly_charges"].median()           # another key, column, calculation
df.groupby("contract")["churned"].agg(["mean", "count"])    # several calculations
df.groupby("tenure_band", observed=True)["churned"].mean()  # category key, drop empty bands
```

`df.groupby("key")` alone is a plan, not a result. The column selection and the calculation turn it into numbers. `sort_values()` orders by value ascending, `sort_index()` by label.

---

### Filter

```python
mask = (df["tenure_months"] > 24) & (df["internet_service"] == "Fiber optic")
mask.sum()                                   # count of matching rows
df.loc[mask]                                 # the matching rows
df.loc[mask, "payment_method"]               # one column of the matching rows
df.loc[df["churned"] == 1, "payment_method"].value_counts()
```

A comparison on a column returns a Series of True and False, the mask. `loc` takes rows first and columns second, both by label, and keeps the rows where the mask is True. `sum()` on a mask counts the True values.

**Combining conditions.**

| operator | meaning |
|---|---|
| `&` | and |
| `\|` | or |
| `~` | not |

Each condition sits in its own parentheses. The words `and`, `or`, `not` raise an error on columns. A misspelled or wrongly cased string returns zero rows with no error, so check spellings with `value_counts()` first.

```python
df["payment_method"].value_counts()          # tally, largest first
df["payment_method"].value_counts().idxmax() # label of the largest
```

---

### Derive

**Number to category.**

```python
df["tenure_band"] = pd.cut(df["tenure_months"],
                           bins=[-1, 12, 36, 100],
                           labels=["0-12", "13-36", "37+"])
```

`bins` are the fence posts, one more than the labels. Each interval excludes its left edge and includes its right one, so the first post sits below the minimum. Values outside every interval, and NaN, become NaN.

**Text to date.**

```python
df["signup_date"] = pd.to_datetime(df["signup_date"], errors="coerce")
df["signup_date"].dt.year.value_counts().sort_index()
```

`to_datetime` is the date twin of `to_numeric`, and unparseable text becomes NaT. `.dt` opens the date parts, `year`, `month`, `day`, `dayofweek`, `quarter`, and works only after the conversion. `.str` opens text methods the same way, `strip`, `lower`, `contains`, `replace`.

---

### Relate

```python
round(df["tenure_months"].corr(df["total_charges"]), 3)   # two Series, a float
df[["tenure_months", "total_charges"]].corr()             # matrix, answer at .iloc[0, 1]
df.select_dtypes("number").corr()                         # all numeric pairs
```

Pearson by default, from -1 to 1, measuring the strength of a straight-line relation. Rows with NaN in either column are skipped. The two-Series form returns a Python float, so use `round(x, 3)` rather than `.round(3)`.

---

### Reading a result

A rate is a share of the rows in that pile. A median is the typical row, a mean is the balance point. A correlation says how much, not why. A count depends on what happened to the NaN upstream, so state it.

---

### Notebook habits

- One check per cell, or `print()` each one. A cell shows only its last expression.
- Numbered Markdown answers, the number, the value, one clause of interpretation.
- Restart Kernel and Run All before writing up. A result from a deleted cell is not reproducible.
