---
status: complete
---
# Summary
Updated JS search logic to use regex to reliably extract the dossier Year, Category, and Sequence. This bypasses issues where the backend may not have restarted to sanitize the code, and ensures that user's reverse search always works securely.
