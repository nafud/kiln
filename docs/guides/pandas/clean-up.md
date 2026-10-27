# Clean-Up

A cleaning procedure for a fresh CSV, from load to the point where the frame is ready to split. Every step has the same rhythm, look, fix and assign, check.

---

## Setup

```python
import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")
raw = df.copy()                            # untouched copy for lookups; two lines now, the only way back once coercion has run
```

---

## Deduplication

```python
df.duplicated().sum()                      # look
df = df.drop_duplicates()                  # fix + assign
df.shape                                   # check
```

---

## Column-name normalisation

```python
df.columns.tolist()                                                                  # look
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)   # fix
raw.columns = df.columns                                                             # keep the lookup copy aligned
df.columns.tolist()                                                                  # check
```

The regex step is not optional. A name that keeps a space or a hyphen rules out attribute access, and `df.query("unit-amount > 20")` reads the hyphen as a subtraction. Every later cell names columns, so the rename comes before any of them.

---

## Missing-value scan

```python
df.isna().sum()                            # missing pandas already recognises; read_csv maps N/A, NA, null, None to NaN on load
df.isin([" ", "", "?", "-"]).sum()         # missing disguised as text, markers outside that default list
```

Both lines detect and change nothing. The second count is the number numeric coercion must reproduce, and the two counts together are what imputation must resolve. Rows are not dropped here. Missingness is rarely random, and the disguised values are still text, so they cannot be treated as missing until coercion turns them into NaN.

---

## Type inspection

```python
df.dtypes                                  # pandas 3 reports text as str
df.head()
```

The signal is a mismatch between what a column holds and what pandas reports. Numbers reporting `str` means text is hiding among them; dates reporting `str` means they are not parsed yet.

---

## Type coercion, numeric

```python
for c in df.columns[df.dtypes == "str"]:                                   # look: which text columns parse as numbers
    conv = pd.to_numeric(df[c], errors="coerce")
    print(c, conv.notna().sum(), conv.isna().sum() - df[c].isna().sum())   # parsed, new NaN

df["amount"] = pd.to_numeric(df["amount"], errors="coerce")        # fix, by name; unparseable -> NaN
df["amount"].isna().sum()                                          # check against the scan count
raw.loc[df.index[df["amount"].isna()], "amount"].value_counts()    # what the NaN used to be; the lookup that matters when the counts differ
```

The loop names the columns worth coercing, those where nearly everything parses. A column where half parses is a mess to inspect, not to coerce, and coercing the whole frame would turn every genuine text column into NaN. Other shapes need a strip before the coercion.

```python
pd.to_numeric(df["price"].str.replace(r"[^\d.\-]", "", regex=True), errors="coerce")   # "$1,200" -> 1200.0
df["flag"].str.strip().str.lower().map({"yes": 1, "no": 0})                            # yes/no text -> 0/1
pd.read_csv("data.csv", na_values=["?", " "])                                          # alternative once the markers are known: reload, the column arrives numeric
```

---

## Type coercion, datetime

```python
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")      # fix; unparseable -> NaT; dayfirst=True for 31/12/2023
df["event_date"].isna().sum(), df["event_date"].min(), df["event_date"].max()   # check NaT and range
df["event_year"] = df["event_date"].dt.year                               # extract
df["event_month"] = df["event_date"].dt.month
df = df.drop(columns=["event_date"])                                      # drop raw datetime
```

---

## Categorical-label normalisation

```python
for c in df.columns[df.dtypes == "str"]:                                   # look: which text columns change under strip + lower
    print(c, df[c].nunique(), df[c].str.strip().str.lower().nunique())

df["category"].value_counts()                                   # look
df["category"] = df["category"].str.strip().str.lower()         # fix + assign, by name
df["category"].value_counts()                                   # check
```

Fix by name rather than lowercasing every text column, which would also rewrite ids and case-bearing labels such as `USD` that were fine. Synonyms (`north` against `north region`) escape the loop and surface only in `value_counts()` of the low-cardinality columns that `nunique()` points out.

---

## Imputation

```python
df.isna().sum()                                                                 # complete picture after coercion; new NaN appeared there
df[["duration", "amount"]].describe()                                           # mean vs 50%
df["duration"] = df["duration"].fillna(df["duration"].median())                 # skewed -> median
df["amount"] = df["amount"].fillna(df["rate"] * df["duration"])                 # reconstructable -> compute
df.isna().sum()                                                                 # check: all zero
```

Filling is a data decision and it has two possible homes. Here, which is fast, or inside the model pipeline as a `SimpleImputer` after the split, which keeps the training median out of the test rows. Dropping the rows instead is rarely safe, since missingness tends to correlate with the target. Skipping the step is not an option, a frame with NaN is not ready to split and scikit-learn refuses to fit it.

---

## Range validation

```python
df.describe().T                            # min and max against what is possible, one column at a time
(df["end_date"] < df["start_date"]).sum()  # cross-column rule describe cannot see; report it, do not silently fix
```

---

## Feature pruning

```python
df.nunique()                               # look; = row count is an id, = 1 is a constant, a handful is categorical
df = df.drop(columns=["record_id"])        # fix + assign
df.shape                                   # check
```

---

## Final verification

```python
print(df.shape)
print(df.dtypes)
print(df.isna().sum().sum())               # zero
print(df.duplicated().sum())               # zero; label fixes can turn near-duplicates into exact ones the first check missed
print(df["target"].mean().round(3))        # rate unchanged from the raw file
```
