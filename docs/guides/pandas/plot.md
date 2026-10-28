# Plot

Six chart shapes for a cleaned frame, each one line on pandas or scikit-learn, with a title and one sentence of reading after it.

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

```python
import matplotlib.pyplot as plt          # pandas draws through matplotlib; plt.show() renders the figure, plt.tight_layout() before it fixes clipped labels
```

---

## Histogram

```python
df["amount"].plot(kind="hist", bins=30, title="Amount")        # one numeric column; bins is the number of bars, NaN skipped
plt.xlabel("amount")
plt.show()
```

---

## Bar

```python
df.groupby("category")["target"].mean().plot(kind="bar", title="Target rate by category")   # a groupby result is already the bar heights
plt.ylabel("rate")
plt.show()

df["category"].value_counts().plot(kind="bar", title="Rows per category")                  # counts per label, largest first
plt.show()
```

---

## Line

```python
df.set_index("event_date")["amount"].resample("ME").mean().plot(title="Monthly mean amount")   # a datetime index; "ME" month end, "W" week, "QE" quarter end
plt.show()

df["event_date"].dt.to_period("M").value_counts().sort_index().plot(kind="line", title="Rows per month")   # count per month without setting the index
plt.show()
```

---

## Scatter

```python
df.plot(kind="scatter", x="duration", y="amount", alpha=0.3, title="Amount vs duration")   # two numeric columns; alpha shows density where points overlap
plt.show()
```

---

## Box

```python
df.boxplot(column="amount", by="category")       # one box per group; median line, box is the middle half, points beyond the whiskers are candidates for range validation
plt.title("Amount by category")
plt.suptitle("")                                 # drop the automatic "Boxplot grouped by" line
plt.show()
```

---

## Classifier quality

```python
from sklearn.metrics import RocCurveDisplay, ConfusionMatrixDisplay

RocCurveDisplay.from_estimator(pipe, X_test, y_test)             # the fitted pipeline and the test split; the legend prints the AUC
plt.show()

ConfusionMatrixDisplay.from_estimator(pipe, X_test, y_test)      # rows are true classes, columns are predicted, at the default 0.5 threshold
plt.show()
```

---

## Reading the chart

- One sentence after every figure, the shape and what it means for the task. A right-skewed histogram points to the median for imputation. A bar that stands out names the risk group. A scatter with no pattern says the correlation is near zero.
- Title on every chart, axis labels when the column name is not self-explanatory. Nothing else is graded.
- A chart answers a question that was asked. Unrequested charts cost time and are read as padding.
