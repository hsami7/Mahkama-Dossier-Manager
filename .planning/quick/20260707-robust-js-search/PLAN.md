# Robust Regex-based Reverse Search

## Objectives
1. Make reverse search in `main.js` bulletproof by extracting Year, Category, and Sequence using Regex instead of simple `split('/')`.
2. This ensures that even if the backend didn't sanitize the code (e.g. `(محال للإختصاص)2026-7205-5`), the Javascript will correctly identify the 3 parts and match the user's `5/7205/2026` query perfectly.
3. Replace `-` with `/` in queries to handle different typing styles.
