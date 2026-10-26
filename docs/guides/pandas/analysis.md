# Analysis

Answering questions about the cleaned table. Every question is one of five patterns, each a short chain of methods on `df`.

---

## The five patterns

| pattern | question shape | idiom |
|---|---|---|
| aggregate | one number for the whole table | `df["col"].mean()` |
| group | one number per category | `df.groupby("key")["col"].mean()` |
| filter | rows that satisfy a condition | `df.loc[mask, "col"]` |
| derive | a new column from an old one | `pd.cut`, `pd.to_datetime`, `.dt`, `.str` |
| relate | how two columns move together | `df["a"].corr(df["b"])` |

---

## Aggregate

```python
df["churned"].mean()                      # share of 1s in a 0/1 column, the rate
df["monthly_charges"].median()            # middle value, robust to outliers
df["col"].sum() / .min() / .max() / .std() / .nunique()
```

The mean of a 0/1 column is a proportion. `mean()` returns a NumPy float, so `.round(4)` works on it.

---

## Group

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

## Filter

```python
mask = (df["tenure_months"] > 24) & (df["internet_service"] == "Fiber optic")
mask.sum()                                   # count of matching rows
df.loc[mask]                                 # the matching rows
df.loc[mask, "payment_method"]               # one column of the matching rows
df.loc[df["churned"] == 1, "payment_method"].value_counts()
```

A comparison on a column returns a Series of True and False, the mask. `loc` takes rows first and columns second, both by label, and keeps the rows where the mask is True. `sum()` on a mask counts the True values.

**Combining conditions.** `&` is and, `|` is or, `~` is not. Each condition sits in its own parentheses. The words `and`, `or`, `not` raise an error on columns. A misspelled or wrongly cased string returns zero rows with no error, so check spellings with `value_counts()` first.

```python
df["payment_method"].value_counts()          # tally, largest first
df["payment_method"].value_counts().idxmax() # label of the largest
```

---

## Derive

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

## Relate

```python
round(df["tenure_months"].corr(df["total_charges"]), 3)   # two Series, a float
df[["tenure_months", "total_charges"]].corr()             # matrix, answer at .iloc[0, 1]
df.select_dtypes("number").corr()                         # all numeric pairs
```

Pearson by default, from -1 to 1, measuring the strength of a straight-line relation. Rows with NaN in either column are skipped. The two-Series form returns a Python float, so use `round(x, 3)` rather than `.round(3)`.

---

## Reading a result

A rate is a share of the rows in that pile. A median is the typical row, a mean is the balance point. A correlation says how much, not why. A count depends on what happened to the NaN upstream, so state it.

---

## Notebook habits

- One check per cell, or `print()` each one. A cell shows only its last expression.
- Numbered Markdown answers, the number, the value, one clause of interpretation.
- Restart Kernel and Run All before writing up. A result from a deleted cell is not reproducible.
