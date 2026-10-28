# Plot

Six chart shapes for a cleaned frame, each one line on pandas or scikit-learn, with a title and one sentence of reading after it.

---

## Essentials

```python
import matplotlib.pyplot as plt
from sklearn.metrics import RocCurveDisplay, ConfusionMatrixDisplay

df["amount"].plot(kind="hist", bins=30, title="Amount")
df.groupby("category")["target"].mean().plot(kind="bar", title="Target rate by category")
df.set_index("event_date")["amount"].resample("ME").mean().plot(title="Monthly mean amount")
df.plot(kind="scatter", x="duration", y="amount", alpha=0.3, title="Amount vs duration")
df.boxplot(column="amount", by="category")
RocCurveDisplay.from_estimator(pipe, X_test, y_test)
ConfusionMatrixDisplay.from_estimator(pipe, X_test, y_test)
plt.show()
```

---

## Choosing the chart

| question shape | chart | idiom |
|---|---|---|
| distribution of one numeric column | histogram | `df["x"].plot(kind="hist", bins=30)` |
| one number per category | bar | `df.groupby("k")["y"].mean().plot(kind="bar")` |
| a value over time | line | `df.set_index("date")["y"].resample("ME").mean().plot()` |
| two numeric columns together | scatter | `df.plot(kind="scatter", x="a", y="b")` |
| a numeric column across groups | box | `df.boxplot(column="y", by="k")` |
| classifier quality | ROC curve, confusion matrix | `RocCurveDisplay.from_estimator(...)`, `ConfusionMatrixDisplay.from_estimator(...)` |

---

## Setup

pandas draws through matplotlib. `plt.show()` renders the figure, and `plt.tight_layout()` before it fixes clipped labels.

```python
import matplotlib.pyplot as plt
```

---

## Histogram

One numeric column, `bins` is the number of bars, NaN is skipped. A right-skewed shape points to the median for imputation.

```python
df["amount"].plot(kind="hist", bins=30, title="Amount")
plt.xlabel("amount")
plt.show()
```

---

## Bar

A groupby result is already the bar heights, and `sort_values()` before `plot` ranks them. `value_counts()` gives counts per label, largest first. The bar that stands out names the risk group.

```python
df.groupby("category")["target"].mean().sort_values().plot(kind="bar", title="Target rate by category")
plt.ylabel("rate")
plt.show()

df["category"].value_counts().plot(kind="bar", title="Rows per category")
plt.show()
```

---

## Line

`resample` needs a datetime index. `"ME"` is month end, `"W"` week, `"QE"` quarter end. The second form counts rows per month without setting the index.

```python
df.set_index("event_date")["amount"].resample("ME").mean().plot(title="Monthly mean amount")
plt.show()

df["event_date"].dt.to_period("M").value_counts().sort_index().plot(kind="line", title="Rows per month")
plt.show()
```

---

## Scatter

Two numeric columns. `alpha` shows density where points overlap. No visible pattern says the correlation is near zero.

```python
df.plot(kind="scatter", x="duration", y="amount", alpha=0.3, title="Amount vs duration")
plt.show()
```

---

## Box

One box per group. The line is the median, the box is the middle half, and points beyond the whiskers are candidates for range validation. `plt.suptitle("")` drops the automatic grouped-by line.

```python
df.boxplot(column="amount", by="category")
plt.title("Amount by category")
plt.suptitle("")
plt.show()
```

---

## Classifier quality

Both take the fitted pipeline and the test split. The ROC legend prints the AUC. In the confusion matrix rows are true classes and columns are predicted classes at the default 0.5 threshold.

```python
from sklearn.metrics import RocCurveDisplay, ConfusionMatrixDisplay

RocCurveDisplay.from_estimator(pipe, X_test, y_test)
plt.show()

ConfusionMatrixDisplay.from_estimator(pipe, X_test, y_test)
plt.show()
```
