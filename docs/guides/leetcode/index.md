# LeetCode

Sixty easy to medium problems on arrays, strings and dictionaries, grouped by the pattern each one reuses, each in the form LeetCode's Python3 editor expects so the block pastes and runs as is. Every solution passes the problem's published examples.

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

### 205. Isomorphic Strings

```python
class Solution:
    def isIsomorphic(self, s, t):
        return len(set(s)) == len(set(t)) == len(set(zip(s, t)))
```

### 290. Word Pattern

```python
class Solution:
    def wordPattern(self, pattern, s):
        words = s.split()
        if len(words) != len(pattern):
            return False
        return len(set(pattern)) == len(set(words)) == len(set(zip(pattern, words)))
```

### 219. Contains Duplicate II

```python
class Solution:
    def containsNearbyDuplicate(self, nums, k):
        last = {}
        for i, x in enumerate(nums):
            if x in last and i - last[x] <= k:
                return True
            last[x] = i
        return False
```

### 409. Longest Palindrome

```python
from collections import Counter

class Solution:
    def longestPalindrome(self, s):
        odd = sum(c % 2 for c in Counter(s).values())
        return len(s) - odd + (1 if odd else 0)
```

### 128. Longest Consecutive Sequence

```python
class Solution:
    def longestConsecutive(self, nums):
        seen = set(nums)
        best = 0
        for x in seen:
            if x - 1 not in seen:
                n = 1
                while x + n in seen:
                    n += 1
                best = max(best, n)
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

### 27. Remove Element

```python
class Solution:
    def removeElement(self, nums, val):
        w = 0
        for x in nums:
            if x != val:
                nums[w] = x
                w += 1
        return w
```

### 680. Valid Palindrome II

```python
class Solution:
    def validPalindrome(self, s):
        i, j = 0, len(s) - 1
        while i < j:
            if s[i] != s[j]:
                a, b = s[i + 1:j + 1], s[i:j]
                return a == a[::-1] or b == b[::-1]
            i += 1
            j -= 1
        return True
```

### 11. Container With Most Water

```python
class Solution:
    def maxArea(self, height):
        i, j = 0, len(height) - 1
        best = 0
        while i < j:
            best = max(best, (j - i) * min(height[i], height[j]))
            if height[i] < height[j]:
                i += 1
            else:
                j -= 1
        return best
```

### 15. 3Sum

```python
class Solution:
    def threeSum(self, nums):
        nums.sort()
        out = []
        for i in range(len(nums) - 2):
            if i and nums[i] == nums[i - 1]:
                continue
            lo, hi = i + 1, len(nums) - 1
            while lo < hi:
                s = nums[i] + nums[lo] + nums[hi]
                if s < 0:
                    lo += 1
                elif s > 0:
                    hi -= 1
                else:
                    out.append([nums[i], nums[lo], nums[hi]])
                    lo += 1
                    while lo < hi and nums[lo] == nums[lo - 1]:
                        lo += 1
        return out
```

### 75. Sort Colors

```python
class Solution:
    def sortColors(self, nums):
        lo, mid, hi = 0, 0, len(nums) - 1
        while mid <= hi:
            if nums[mid] == 0:
                nums[lo], nums[mid] = nums[mid], nums[lo]
                lo += 1
                mid += 1
            elif nums[mid] == 2:
                nums[mid], nums[hi] = nums[hi], nums[mid]
                hi -= 1
            else:
                mid += 1
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

### 485. Max Consecutive Ones

```python
class Solution:
    def findMaxConsecutiveOnes(self, nums):
        best = run = 0
        for x in nums:
            run = run + 1 if x == 1 else 0
            best = max(best, run)
        return best
```

### 122. Best Time to Buy and Sell Stock II

```python
class Solution:
    def maxProfit(self, prices):
        return sum(max(0, prices[i] - prices[i - 1]) for i in range(1, len(prices)))
```

### 56. Merge Intervals

```python
class Solution:
    def merge(self, intervals):
        intervals.sort()
        out = []
        for a, b in intervals:
            if out and a <= out[-1][1]:
                out[-1][1] = max(out[-1][1], b)
            else:
                out.append([a, b])
        return out
```

### 560. Subarray Sum Equals K

```python
from collections import defaultdict

class Solution:
    def subarraySum(self, nums, k):
        seen = defaultdict(int)
        seen[0] = 1
        total = count = 0
        for x in nums:
            total += x
            count += seen[total - k]
            seen[total] += 1
        return count
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

### 1047. Remove All Adjacent Duplicates In String

```python
class Solution:
    def removeDuplicates(self, s):
        stack = []
        for ch in s:
            if stack and stack[-1] == ch:
                stack.pop()
            else:
                stack.append(ch)
        return "".join(stack)
```

### 739. Daily Temperatures

```python
class Solution:
    def dailyTemperatures(self, temperatures):
        out = [0] * len(temperatures)
        stack = []
        for i, t in enumerate(temperatures):
            while stack and temperatures[stack[-1]] < t:
                j = stack.pop()
                out[j] = i - j
            stack.append(i)
        return out
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

### 746. Min Cost Climbing Stairs

```python
class Solution:
    def minCostClimbingStairs(self, cost):
        a = b = 0
        for c in cost:
            a, b = b, min(a, b) + c
        return min(a, b)
```

### 198. House Robber

```python
class Solution:
    def rob(self, nums):
        prev = cur = 0
        for x in nums:
            prev, cur = cur, max(cur, prev + x)
        return cur
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

### 35. Search Insert Position

```python
class Solution:
    def searchInsert(self, nums, target):
        lo, hi = 0, len(nums)
        while lo < hi:
            mid = (lo + hi) // 2
            if nums[mid] < target:
                lo = mid + 1
            else:
                hi = mid
        return lo
```

### 338. Counting Bits

```python
class Solution:
    def countBits(self, n):
        out = [0] * (n + 1)
        for i in range(1, n + 1):
            out[i] = out[i >> 1] + (i & 1)
        return out
```
