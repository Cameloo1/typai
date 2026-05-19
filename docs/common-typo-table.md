# Common Typo Table

Status: Prompt 103 approved conservative table.

Typai's automatic correction table is project-owned and deliberately small. The
source for the Prompt 103 expansion is the Prompt 99 baseline sample group plus
the Prompt 103 candidate list, reviewed against these rules:

- the typo must be a non-word in Typai's supported English scope
- the correction must be unambiguous without document context
- valid-word traps are excluded
- names, proper nouns, and technical terms are excluded
- delete-index/edit-distance candidates are not promoted unless they are listed
  here

No third-party typo corpus is embedded in this table.

| Typo | Correction | Autocorrect | Notes |
| --- | --- | --- | --- |
| teh | the | yes | original deterministic table |
| adn | and | yes | original deterministic table |
| recieve | receive | yes | original deterministic table |
| becuase | because | yes | original deterministic table |
| thier | their | yes | original deterministic table |
| adress | address | yes | Prompt 99/103 baseline |
| speling | spelling | yes | Prompt 99/103 baseline |
| corection | correction | yes | Prompt 99/103 baseline |
| seperate | separate | yes | Prompt 99/103 baseline |
| definitly | definitely | yes | Prompt 99/103 baseline |
| accomodate | accommodate | yes | Prompt 99/103 baseline |
| occured | occurred | yes | Prompt 99/103 baseline |
| untill | until | yes | Prompt 99/103 baseline |
| tommorow | tomorrow | yes | Prompt 99/103 baseline |
| goverment | government | yes | Prompt 99/103 baseline |
| enviroment | environment | yes | Prompt 99/103 baseline |
| arguement | argument | yes | Prompt 99/103 baseline |
| calender | calendar | yes | Prompt 99/103 baseline |
| embarass | embarrass | yes | Prompt 99/103 baseline |
| publically | publicly | yes | Prompt 99/103 baseline |
| neccessary | necessary | yes | Prompt 99/103 baseline |

Suggestions-only cases remain outside the autocorrect table:

| Token | Suggestion | Reason |
| --- | --- | --- |
| reciept | receipt | delete-index candidate; left suggestion-only |
| dont | don't | contraction repair; no automatic expansion |
| it;s | it's | punctuation/contraction repair; no automatic rewrite |
| adresss | address, addresses | plural ambiguity |

Review gate for future additions:

- Add one row per typo.
- Add a golden-corpus autocorrect case.
- Add a false-positive/protected-token test if the entry resembles a valid word,
  proper noun, product name, identifier, or technical command.
- Do not use production dictionary frequency, SymSpell rank, or edit distance as
  an autocorrect gate by itself.
