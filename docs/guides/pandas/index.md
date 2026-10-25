# Pandas

A data-cleaning procedure for a fresh CSV, from load to the point where the frame is ready to split. Each step looks before it changes anything, assigns the result back, and checks that the change landed. The example is a telecom churn table with a `churned` target.

## Setup

```python
import pandas as pd
import numpy as np

df = pd.read_csv("datasets/churn.csv")
raw = df.copy()
```

`raw` is never modified. It answers what a value was before a conversion turned it into `NaN`, and it is the fallback when a step goes wrong.

---

## Deduplication

```python
df.duplicated().sum()                      # look
df = df.drop_duplicates()                  # fix + assign
df.shape                                   # check
```

`drop_duplicates` returns a new frame and leaves `df` as it was until the result is assigned back. The same holds for every fix below.

---

## Column-name normalisation

```python
df.columns.tolist()                        # look
df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")   # fix
df.columns.tolist()                        # check
```

Lowercase names without spaces or padding spare the quoting and the guesswork in every later line.

---

## Type inspection

```python
df.dtypes
df.head()
```

A column is judged by what it holds, not by its label. Amounts stored as text, dates stored as text, and identifiers stored as integers are the usual mismatches. pandas 3 reports text columns as `str` rather than `object`.

---

## Hidden-missing scan

```python
df.isna().sum()                            # missing pandas already recognises
df.isin([" ", "", "?", "N/A"]).sum()       # missing values disguised as text
```

Runs before any conversion. `read_csv` already maps the markers in its default `na_values` list (an empty field, `NA`, `N/A`, `NaN`, `null`) to `NaN`; a single space, a question mark, or a dash survive as text and would otherwise block a numeric conversion. The count found here is what the coercion step is expected to turn into `NaN`.

---

## Type coercion, numeric

```python
df["total_charges"] = pd.to_numeric(df["total_charges"], errors="coerce")        # fix
df["total_charges"].isna().sum()                                                 # check
raw.loc[df.index[df["total_charges"].isna()], "total_charges"].value_counts()    # what the NaN used to be
```

`errors="coerce"` turns every value that does not parse into `NaN` instead of raising. The new `NaN` count is compared with the sentinel count from the scan; a difference means a format the scan did not list. The `raw` lookup goes through index labels, which survive `drop_duplicates`, so it works after rows have been removed. Indexing `raw` with the boolean mask itself raises once `df` is shorter than `raw` (pandas 3.0.5).

---

## Type coercion, datetime

```python
df["signup_date"] = pd.to_datetime(df["signup_date"], errors="coerce")      # fix
df["signup_date"].isna().sum(), df["signup_date"].min(), df["signup_date"].max()   # check NaT and range
df["signup_year"] = df["signup_date"].dt.year                               # extract
df["signup_month"] = df["signup_date"].dt.month
df = df.drop(columns=["signup_date"])                                       # drop raw datetime
```

Unparseable dates become `NaT`. The minimum and maximum expose a swapped day and month or a placeholder year before they become features. Models take numbers, not timestamps, so the date is reduced to the parts that carry signal and the timestamp column is dropped.

---

## Categorical-label normalisation

```python
df["contract"].value_counts()                                   # look
df["contract"] = df["contract"].str.strip().str.lower()         # fix + assign
df["contract"].value_counts()                                   # check
```

`value_counts` lists every spelling as its own row; stripping and lowercasing merges the ones that differ only in case or padding. A spelling that differs in more than that needs an explicit `replace` afterwards.

---

## Missing-value audit

```python
df.isna().sum()
```

After the conversions every missing value, declared or disguised, is a `NaN`, so this one count is the complete picture and sets the imputation work.

---

## Imputation

```python
df[["tenure_months", "total_charges"]].describe()                                     # mean vs 50%
df["tenure_months"] = df["tenure_months"].fillna(df["tenure_months"].median())        # symmetric -> median (= mean here)
df["total_charges"] = df["total_charges"].fillna(df["monthly_charges"] * df["tenure_months"])   # reconstructable
df.isna().sum()                                                                       # check: all zero
```

The fill depends on the column. When `mean` and `50%` agree the distribution is symmetric and either works; when they diverge the median is the robust choice, since a long tail drags the mean. A column that is a function of others is reconstructed from them rather than guessed, which is why `tenure_months` is filled first (the reconstruction of `total_charges` reads it). A categorical column takes its mode or an explicit `"missing"` label.

---

## Range validation

```python
df.describe().T
```

Minimum and maximum of every numeric column against what is physically possible. A negative tenure or an age of 200 is an error to fix or drop; a large but possible value is an outlier and stays, since clipping or a log transform is a modelling decision rather than a cleaning one. `.T` transposes the display only and leaves `df` as it is.

---

## Feature pruning

```python
df.nunique()                               # look
df = df.drop(columns=["customer_id"])      # fix + assign
df.shape                                   # check
```

A `nunique` equal to the row count marks an identifier, a `nunique` of 1 marks a constant; neither carries signal. A column that is only known after the target is decided (a leak) goes with them.

---

## Final verification

```python
print(df.shape)
print(df.dtypes)
print(df.isna().sum().sum())
print(df["churned"].mean().round(3))
```

A notebook cell displays only its last expression, hence one `print` per line. Four facts are confirmed before the split. The shape is the planned one, no column that should be numeric is still `str`, the missing count is zero, and the target rate matches the raw file (a changed rate means rows were lost unevenly). `mean()` returns a NumPy float, which has a `round` method; a plain Python float, such as the value a scikit-learn metric returns, does not and takes the built-in `round(x, 3)` instead.
