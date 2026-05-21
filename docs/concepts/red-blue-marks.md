# Red And Blue Marks

Typai uses mark color to communicate correction state.

Red marks are unresolved spelling or token suggestions. The original text is
still present, and the user can inspect or act on suggestions.

Blue marks are applied correction transactions. Typai changed the text and kept
a transaction so the user can revert exactly.

Accepted completion is different. A completion acceptance inserts ghost text as
a completion transaction; it is not a blue correction mark.
