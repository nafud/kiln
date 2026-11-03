# LeetCode

Forty easy to medium problems on arrays, strings and dictionaries, grouped by the pattern each one reuses, each in the form LeetCode's Python3 editor expects so the block pastes and runs as is. Every solution passes the problem's published examples.

## Dictionary and set

### 1. Two Sum

```python
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
        return []
```

### 217. Contains Duplicate

```python
class Solution:
    def containsDuplicate(self, nums):
        return len(set(nums)) != len(nums)
```

### 242. Valid Anagram

```python
from collections import Counter

class Solution:
    def isAnagram(self, s, t):
        return Counter(s) == Counter(t)
```

### 169. Majority Element

```python
from collections import Counter

class Solution:
    def majorityElement(self, nums):
        return Counter(nums).most_common(1)[0][0]
```

### 136. Single Number

```python
from collections import Counter

class Solution:
    def singleNumber(self, nums):
        for x, c in Counter(nums).items():
            if c == 1:
                return x
```

### 268. Missing Number

```python
class Solution:
    def missingNumber(self, nums):
        n = len(nums)
        return n * (n + 1) // 2 - sum(nums)
```

### 387. First Unique Character in a String

```python
from collections import Counter

class Solution:
    def firstUniqChar(self, s):
        c = Counter(s)
        for i, ch in enumerate(s):
            if c[ch] == 1:
                return i
        return -1
```

### 350. Intersection of Two Arrays II

```python
from collections import Counter

class Solution:
    def intersect(self, nums1, nums2):
        c = Counter(nums1)
        out = []
        for x in nums2:
            if c[x] > 0:
                out.append(x)
                c[x] -= 1
        return out
```

### 383. Ransom Note

```python
from collections import Counter

class Solution:
    def canConstruct(self, ransomNote, magazine):
        have = Counter(magazine)
        for ch in ransomNote:
            if have[ch] == 0:
                return False
            have[ch] -= 1
        return True
```

### 202. Happy Number

```python
class Solution:
    def isHappy(self, n):
        seen = set()
        while n != 1 and n not in seen:
            seen.add(n)
            n = sum(int(d) ** 2 for d in str(n))
        return n == 1
```

### 347. Top K Frequent Elements

```python
from collections import Counter

class Solution:
    def topKFrequent(self, nums, k):
        return [x for x, _ in Counter(nums).most_common(k)]
```

### 49. Group Anagrams

```python
from collections import defaultdict

class Solution:
    def groupAnagrams(self, strs):
        groups = defaultdict(list)
        for w in strs:
            groups["".join(sorted(w))].append(w)
        return list(groups.values())
```

### 3. Longest Substring Without Repeating Characters

```python
class Solution:
    def lengthOfLongestSubstring(self, s):
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

### 125. Valid Palindrome

```python
class Solution:
    def isPalindrome(self, s):
        t = [ch.lower() for ch in s if ch.isalnum()]
        return t == t[::-1]
```

### 344. Reverse String

```python
class Solution:
    def reverseString(self, s):
        i, j = 0, len(s) - 1
        while i < j:
            s[i], s[j] = s[j], s[i]
            i += 1
            j -= 1
```

### 283. Move Zeroes

```python
class Solution:
    def moveZeroes(self, nums):
        w = 0
        for x in nums:
            if x != 0:
                nums[w] = x
                w += 1
        for i in range(w, len(nums)):
            nums[i] = 0
```

### 26. Remove Duplicates from Sorted Array

```python
class Solution:
    def removeDuplicates(self, nums):
        w = 1
        for i in range(1, len(nums)):
            if nums[i] != nums[i - 1]:
                nums[w] = nums[i]
                w += 1
        return w
```

### 167. Two Sum II, Input Array Is Sorted

```python
class Solution:
    def twoSum(self, numbers, target):
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

### 977. Squares of a Sorted Array

```python
class Solution:
    def sortedSquares(self, nums):
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

### 88. Merge Sorted Array

```python
class Solution:
    def merge(self, nums1, m, nums2, n):
        i, j, k = m - 1, n - 1, m + n - 1
        while j >= 0:
            if i >= 0 and nums1[i] > nums2[j]:
                nums1[k] = nums1[i]
                i -= 1
            else:
                nums1[k] = nums2[j]
                j -= 1
            k -= 1
```

### 392. Is Subsequence

```python
class Solution:
    def isSubsequence(self, s, t):
        i = 0
        for ch in t:
            if i < len(s) and s[i] == ch:
                i += 1
        return i == len(s)
```

## Running value

### 121. Best Time to Buy and Sell Stock

```python
class Solution:
    def maxProfit(self, prices):
        lo = prices[0]
        best = 0
        for p in prices:
            lo = min(lo, p)
            best = max(best, p - lo)
        return best
```

### 53. Maximum Subarray

```python
class Solution:
    def maxSubArray(self, nums):
        cur = nums[0]
        best = nums[0]
        for x in nums[1:]:
            cur = max(x, cur + x)
            best = max(best, cur)
        return best
```

### 1480. Running Sum of 1d Array

```python
class Solution:
    def runningSum(self, nums):
        out = []
        total = 0
        for x in nums:
            total += x
            out.append(total)
        return out
```

### 724. Find Pivot Index

```python
class Solution:
    def pivotIndex(self, nums):
        total = sum(nums)
        left = 0
        for i, x in enumerate(nums):
            if left == total - left - x:
                return i
            left += x
        return -1
```

### 238. Product of Array Except Self

```python
class Solution:
    def productExceptSelf(self, nums):
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

### 58. Length of Last Word

```python
class Solution:
    def lengthOfLastWord(self, s):
        return len(s.split()[-1])
```

### 14. Longest Common Prefix

```python
class Solution:
    def longestCommonPrefix(self, strs):
        prefix = strs[0]
        for w in strs[1:]:
            while not w.startswith(prefix):
                prefix = prefix[:-1]
        return prefix
```

## Stack

### 20. Valid Parentheses

```python
class Solution:
    def isValid(self, s):
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

### 70. Climbing Stairs

```python
class Solution:
    def climbStairs(self, n):
        a, b = 1, 1
        for _ in range(n - 1):
            a, b = b, a + b
        return b
```

### 509. Fibonacci Number

```python
class Solution:
    def fib(self, n):
        a, b = 0, 1
        for _ in range(n):
            a, b = b, a + b
        return a
```

### 118. Pascal's Triangle

```python
class Solution:
    def generate(self, numRows):
        rows = []
        for r in range(numRows):
            row = [1] * (r + 1)
            for i in range(1, r):
                row[i] = rows[r - 1][i - 1] + rows[r - 1][i]
            rows.append(row)
        return rows
```

## Numbers, digits and bits

### 412. Fizz Buzz

```python
class Solution:
    def fizzBuzz(self, n):
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

### 9. Palindrome Number

```python
class Solution:
    def isPalindrome(self, x):
        return x >= 0 and str(x) == str(x)[::-1]
```

### 13. Roman to Integer

```python
class Solution:
    def romanToInt(self, s):
        v = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
        total = 0
        for i in range(len(s)):
            if i + 1 < len(s) and v[s[i]] < v[s[i + 1]]:
                total -= v[s[i]]
            else:
                total += v[s[i]]
        return total
```

### 66. Plus One

```python
class Solution:
    def plusOne(self, digits):
        for i in range(len(digits) - 1, -1, -1):
            if digits[i] < 9:
                digits[i] += 1
                return digits
            digits[i] = 0
        return [1] + digits
```

### 231. Power of Two

```python
class Solution:
    def isPowerOfTwo(self, n):
        return n > 0 and n & (n - 1) == 0
```

### 191. Number of 1 Bits

```python
class Solution:
    def hammingWeight(self, n):
        return bin(n).count("1")
```

### 69. Sqrt(x)

```python
class Solution:
    def mySqrt(self, x):
        lo, hi = 0, x
        while lo <= hi:
            mid = (lo + hi) // 2
            if mid * mid <= x:
                lo = mid + 1
            else:
                hi = mid - 1
        return hi
```

### 704. Binary Search

```python
class Solution:
    def search(self, nums, target):
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
