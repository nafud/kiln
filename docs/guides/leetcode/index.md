# LeetCode

Forty easy to medium problems on arrays, strings and dictionaries, grouped by the pattern each one reuses, with the solution and nothing else. Every function passes the problem's published examples.

The counting solutions use `from collections import Counter, defaultdict`.

## Dictionary and set

### Two Sum

```python
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []
```

### Contains Duplicate

```python
def contains_duplicate(nums):
    return len(set(nums)) != len(nums)
```

### Valid Anagram

```python
def is_anagram(s, t):
    return Counter(s) == Counter(t)
```

### Majority Element

```python
def majority_element(nums):
    return Counter(nums).most_common(1)[0][0]
```

### Single Number

```python
def single_number(nums):
    return next(x for x, c in Counter(nums).items() if c == 1)
```

### Missing Number

```python
def missing_number(nums):
    n = len(nums)
    return n * (n + 1) // 2 - sum(nums)
```

### First Unique Character

```python
def first_uniq_char(s):
    c = Counter(s)
    for i, ch in enumerate(s):
        if c[ch] == 1:
            return i
    return -1
```

### Intersection of Two Arrays II

```python
def intersect(nums1, nums2):
    c = Counter(nums1)
    out = []
    for x in nums2:
        if c[x] > 0:
            out.append(x)
            c[x] -= 1
    return out
```

### Ransom Note

```python
def can_construct(ransom, magazine):
    have = Counter(magazine)
    for ch in ransom:
        if have[ch] == 0:
            return False
        have[ch] -= 1
    return True
```

### Happy Number

```python
def is_happy(n):
    seen = set()
    while n != 1 and n not in seen:
        seen.add(n)
        n = sum(int(d) ** 2 for d in str(n))
    return n == 1
```

### Top K Frequent Elements

```python
def top_k_frequent(nums, k):
    return [x for x, _ in Counter(nums).most_common(k)]
```

### Group Anagrams

```python
def group_anagrams(strs):
    groups = defaultdict(list)
    for w in strs:
        groups["".join(sorted(w))].append(w)
    return list(groups.values())
```

### Longest Substring Without Repeating Characters

```python
def length_of_longest_substring(s):
    seen = set()
    left = 0
    best = 0
    for right in range(len(s)):
        while s[right] in seen:
            seen.remove(s[left])
            left += 1
        seen.add(s[right])
        best = max(best, right - left + 1)
    return best
```

## Two pointers

### Valid Palindrome

```python
def is_palindrome(s):
    t = [ch.lower() for ch in s if ch.isalnum()]
    return t == t[::-1]
```

### Reverse String

```python
def reverse_string(s):
    i, j = 0, len(s) - 1
    while i < j:
        s[i], s[j] = s[j], s[i]
        i, j = i + 1, j - 1
    return s
```

### Move Zeroes

```python
def move_zeroes(nums):
    w = 0
    for x in nums:
        if x != 0:
            nums[w] = x
            w += 1
    for i in range(w, len(nums)):
        nums[i] = 0
    return nums
```

### Remove Duplicates from Sorted Array

```python
def remove_duplicates(nums):
    if not nums:
        return 0
    w = 1
    for i in range(1, len(nums)):
        if nums[i] != nums[i - 1]:
            nums[w] = nums[i]
            w += 1
    return w
```

### Two Sum II, sorted input

```python
def two_sum_sorted(numbers, target):
    i, j = 0, len(numbers) - 1
    while i < j:
        s = numbers[i] + numbers[j]
        if s == target:
            return [i + 1, j + 1]
        if s < target:
            i += 1
        else:
            j -= 1
    return []
```

### Squares of a Sorted Array

```python
def sorted_squares(nums):
    out = [0] * len(nums)
    i, j = 0, len(nums) - 1
    for k in range(len(nums) - 1, -1, -1):
        if abs(nums[i]) > abs(nums[j]):
            out[k] = nums[i] ** 2
            i += 1
        else:
            out[k] = nums[j] ** 2
            j -= 1
    return out
```

### Merge Sorted Array

```python
def merge_sorted(nums1, m, nums2, n):
    i, j, k = m - 1, n - 1, m + n - 1
    while j >= 0:
        if i >= 0 and nums1[i] > nums2[j]:
            nums1[k] = nums1[i]
            i -= 1
        else:
            nums1[k] = nums2[j]
            j -= 1
        k -= 1
    return nums1
```

### Is Subsequence

```python
def is_subsequence(s, t):
    i = 0
    for ch in t:
        if i < len(s) and s[i] == ch:
            i += 1
    return i == len(s)
```

## Running value

### Best Time to Buy and Sell Stock

```python
def max_profit(prices):
    lo, best = float("inf"), 0
    for p in prices:
        lo = min(lo, p)
        best = max(best, p - lo)
    return best
```

### Maximum Subarray

```python
def max_subarray(nums):
    cur = best = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best
```

### Running Sum of 1d Array

```python
def running_sum(nums):
    out, total = [], 0
    for x in nums:
        total += x
        out.append(total)
    return out
```

### Find Pivot Index

```python
def pivot_index(nums):
    total, left = sum(nums), 0
    for i, x in enumerate(nums):
        if left == total - left - x:
            return i
        left += x
    return -1
```

### Product of Array Except Self

```python
def product_except_self(nums):
    n = len(nums)
    out = [1] * n
    left = 1
    for i in range(n):
        out[i] = left
        left *= nums[i]
    right = 1
    for i in range(n - 1, -1, -1):
        out[i] *= right
        right *= nums[i]
    return out
```

### Length of Last Word

```python
def length_of_last_word(s):
    return len(s.split()[-1])
```

### Longest Common Prefix

```python
def longest_common_prefix(strs):
    prefix = strs[0]
    for w in strs[1:]:
        while not w.startswith(prefix):
            prefix = prefix[:-1]
    return prefix
```

## Stack

### Valid Parentheses

```python
def is_valid_parentheses(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack
```

## Each value from the previous ones

### Climbing Stairs

```python
def climb_stairs(n):
    a, b = 1, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b
```

### Fibonacci Number

```python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

### Pascal's Triangle

```python
def pascal(num_rows):
    rows = []
    for r in range(num_rows):
        row = [1] * (r + 1)
        for i in range(1, r):
            row[i] = rows[r - 1][i - 1] + rows[r - 1][i]
        rows.append(row)
    return rows
```

## Numbers, digits and bits

### Fizz Buzz

```python
def fizz_buzz(n):
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(str(i))
    return out
```

### Palindrome Number

```python
def is_palindrome_number(x):
    return x >= 0 and str(x) == str(x)[::-1]
```

### Roman to Integer

```python
def roman_to_int(s):
    v = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    for i, ch in enumerate(s):
        if i + 1 < len(s) and v[ch] < v[s[i + 1]]:
            total -= v[ch]
        else:
            total += v[ch]
    return total
```

### Plus One

```python
def plus_one(digits):
    for i in range(len(digits) - 1, -1, -1):
        if digits[i] < 9:
            digits[i] += 1
            return digits
        digits[i] = 0
    return [1] + digits
```

### Power of Two

```python
def is_power_of_two(n):
    return n > 0 and n & (n - 1) == 0
```

### Number of 1 Bits

```python
def hamming_weight(n):
    return bin(n).count("1")
```

### Sqrt(x)

```python
def my_sqrt(x):
    lo, hi = 0, x
    while lo <= hi:
        mid = (lo + hi) // 2
        if mid * mid <= x:
            lo = mid + 1
        else:
            hi = mid - 1
    return hi
```

### Binary Search

```python
def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```
