### Standard Bug Fix
```text
fix(parser): handle empty strings in json decoder

Previously, empty strings caused a runtime panic. Now returns null as expected.
Closes #142
```
