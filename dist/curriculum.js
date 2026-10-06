const RAW_WEEKS = [
    ["Week 1: Arrays and hashing", "Hash map for lookups, sets for duplicates, sort then scan, prefix sums.", "two-sum:E,contains-duplicate:E,valid-anagram:E,majority-element:E,group-anagrams:M,top-k-frequent-elements:M,product-of-array-except-self:M,valid-sudoku:M,longest-consecutive-sequence:M,subarray-sum-equals-k:M,merge-intervals:M,sort-colors:M"],
    ["Week 2: Two pointers and sliding window", "Pointers from both ends on sorted data. Window grows right, shrinks left while invalid.", "valid-palindrome:E,best-time-to-buy-and-sell-stock:E,two-sum-ii-input-array-is-sorted:M,3sum:M,container-with-most-water:M,longest-substring-without-repeating-characters:M,longest-repeating-character-replacement:M,permutation-in-string:M,minimum-size-subarray-sum:M,trapping-rain-water:H,minimum-window-substring:H,sliding-window-maximum:H"],
    ["Week 3: Stack and binary search", "Monotonic stack for next greater element. Binary search on a sorted range or on the answer.", "valid-parentheses:E,binary-search:E,min-stack:M,evaluate-reverse-polish-notation:M,daily-temperatures:M,car-fleet:M,search-a-2d-matrix:M,koko-eating-bananas:M,find-minimum-in-rotated-sorted-array:M,search-in-rotated-sorted-array:M,time-based-key-value-store:M,largest-rectangle-in-histogram:H"],
    ["Week 4: Linked list and heap", "Dummy head node, slow and fast pointers. In Go, write the container/heap boilerplate once and memorize it. Start weekly mocks.", "reverse-linked-list:E,merge-two-sorted-lists:E,linked-list-cycle:E,kth-largest-element-in-a-stream:E,reorder-list:M,remove-nth-node-from-end-of-list:M,add-two-numbers:M,lru-cache:M,kth-largest-element-in-an-array:M,k-closest-points-to-origin:M,merge-k-sorted-lists:H,find-median-from-data-stream:H"],
    ["Week 5: Trees", "Recursion on left and right, return what the parent needs. BFS with a queue for levels.", "invert-binary-tree:E,maximum-depth-of-binary-tree:E,diameter-of-binary-tree:E,balanced-binary-tree:E,same-tree:E,subtree-of-another-tree:E,lowest-common-ancestor-of-a-binary-search-tree:M,binary-tree-level-order-traversal:M,binary-tree-right-side-view:M,count-good-nodes-in-binary-tree:M,validate-binary-search-tree:M,kth-smallest-element-in-a-bst:M"],
    ["Week 6: Hard trees, trie, backtracking", "Backtracking: choose, recurse, undo. Skip duplicates by sorting first.", "implement-trie-prefix-tree:M,construct-binary-tree-from-preorder-and-inorder-traversal:M,subsets:M,combination-sum:M,permutations:M,subsets-ii:M,combination-sum-ii:M,word-search:M,palindrome-partitioning:M,letter-combinations-of-a-phone-number:M,binary-tree-maximum-path-sum:H,serialize-and-deserialize-binary-tree:H"],
    ["Week 7: Graphs", "Grid DFS and BFS, multi-source BFS, topological sort, union-find, Dijkstra with a heap.", "number-of-islands:M,max-area-of-island:M,clone-graph:M,pacific-atlantic-water-flow:M,surrounded-regions:M,rotting-oranges:M,course-schedule:M,course-schedule-ii:M,redundant-connection:M,number-of-provinces:M,network-delay-time:M,word-ladder:H"],
    ["Week 8: 1D dynamic programming", "Define the state, write the recurrence, then add memoization or a table.", "climbing-stairs:E,min-cost-climbing-stairs:E,house-robber:M,house-robber-ii:M,longest-palindromic-substring:M,decode-ways:M,coin-change:M,maximum-product-subarray:M,word-break:M,longest-increasing-subsequence:M,partition-equal-subset-sum:M,palindromic-substrings:M"],
    ["Week 9: 2D DP, greedy, intervals", "Grid and two-string DP tables. Greedy: sort, then prove the local choice is safe.", "unique-paths:M,longest-common-subsequence:M,coin-change-ii:M,target-sum:M,edit-distance:M,best-time-to-buy-and-sell-stock-with-cooldown:M,maximum-subarray:M,jump-game:M,jump-game-ii:M,gas-station:M,non-overlapping-intervals:M,insert-interval:M"],
    ["Week 10: Gaps and mock rounds", "8 new problems. Then redo your 4 worst misses cold. Finish with 2 full mocks: 2 problems in 60 minutes.", "single-number:E,counting-bits:E,rotate-image:M,spiral-matrix:M,set-matrix-zeroes:M,sort-an-array:M,design-twitter:M,reconstruct-itinerary:H"]
];
const SMALL_WORDS = {
    a: 1, an: 1, of: 1, in: 1, to: 1, and: 1, from: 1, with: 1, the: 1, on: 1, for: 1, is: 1
};
const ACRONYMS = { lru: "LRU", bst: "BST", ii: "II", "3sum": "3Sum" };
export function formatTitle(slug) {
    return slug
        .split("-")
        .map((word, index) => ACRONYMS[word] || (index && SMALL_WORDS[word] ? word : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ");
}
export function parseWeeks() {
    let totalProblems = 0;
    const weeks = RAW_WEEKS.map(([title, note, rawItems]) => {
        const problems = rawItems.split(",").map(item => {
            const [slug, difficulty] = item.split(":");
            return { slug, difficulty: difficulty };
        });
        totalProblems += problems.length;
        return { title, note, problems };
    });
    return { weeks, totalProblems };
}
