# Gujarati glossary (ticket 24)

The term list every `packages/shared/src/i18n/*.gu.ts` string follows. One line per term: English, Gujarati, source.

**What Bhavin's app gave us.** Its screens are English only; Gujarati appears in two places: the voice-input language
and the parts glossary (`docs/discovery/bhavin-v3/glossary-2026-11-09.json`), which maps what people type in Gujarati
script to English. That glossary shows the plant writes English technical words in Gujarati script (સ્પિન્ડલ, મોટર,
એલાર્મ, પેરામીટર), so app and maintenance words here are English loanwords in Gujarati script, and everyday
verbs and states are plain Gujarati. "Bhavin" below means the spelling comes from that glossary; "ours" means we chose
it. A native-speaker review is a later pass (`gujarati-review.csv`), not a blocker.

**Rules.** Digits stay 0 to 9, as the app formats numbers, times and machine codes. Every `{{placeholder}}` stays;
word order may move it. Brand and code words stay in Latin letters: Uptimo, WhatsApp, SLA, S1 to S4, criticality A
to C, machine codes such as VC-17. A ticket is feminine (ખુલ્લી, સોંપાઈ). "By a person" is `{{name}} દ્વારા`, never
the `એ` suffix, because a placeholder cannot take it. Durations inside `{{time}}` are still formatted in English
("12 min ago") by the web app; that is a follow-up, not a catalogue string.

## Plant and maintenance words

- spindle, સ્પિન્ડલ, Bhavin
- bearing, બેરિંગ, Bhavin
- machine, મશીન, ours (loanword, as Bhavin's register)
- breakdown, બ્રેકડાઉન, ours (loanword)
- maintenance, મેન્ટેનન્સ, ours (loanword)
- downtime, ડાઉનટાઇમ, ours (loanword)
- response (time), રિસ્પોન્સ, ours (loanword)
- repair, રિપેર, ours (loanword)
- spare, સ્પેર, ours (loanword)
- shift, શિફ્ટ, ours (loanword)
- category, કેટેગરી, ours (loanword)
- maintenance code, મેન્ટેનન્સ કોડ, ours
- machine ID, મશીન કોડ, ours (the value is a code such as VC-17)
- group (of machines), ગ્રુપ, ours (loanword)
- cell, સેલ, ours (loanword)
- vendor, વેન્ડર, ours (loanword)
- follow-up, ફોલો-અપ, ours (loanword)
- fabrication, ફેબ્રિકેશન, ours (loanword)
- shifting (moving equipment), શિફ્ટિંગ, ours (loanword)
- inspection, ઇન્સ્પેક્શન, ours (loanword)

## Machine and ticket states

- stopped / down (machine), બંધ, ours
- machine has stopped, મશીન બંધ થઈ ગયું છે, ours
- running, ચાલુ, ours
- running again, ફરી ચાલુ, ours
- needs support, સપોર્ટ જોઈએ, ours
- support (kind, role), સપોર્ટ, ours (loanword)
- open (ticket), ખુલ્લી, ours
- in progress, કામ ચાલુ, ours
- waiting, રાહમાં, ours (label "Waiting" as a figure: રાહ)
- paused, થોભાવેલું, ours
- transferred, સોંપાઈ, ours
- closed (ticket), ક્લોઝ, ours (loanword, so it never reads as બંધ, the stopped machine)
- cancelled, રદ, ours
- done, પૂરું, ours
- pending, બાકી, ours
- overdue / late, મોડું, ours
- on time, સમયસર, ours
- due soon, સમય નજીક, ours
- stopped (an SLA clock), અટક્યું, ours (not બંધ: the clock, not the machine)
- booked (floor's word), નોંધાયું, ours
- fixed (floor's word), રિપેર થયું, ours
- idle (board tile), ખાલી, ours

## Actions

- report a problem, સમસ્યાની જાણ કરો, ours
- report (nav tab), જાણ કરો, ours
- reported, નોંધાયું, ours
- my complaints, મારી ફરિયાદો, ours
- start work, કામ શરૂ કરો, ours
- pick up, હાથમાં લો, ours
- resume, ફરી શરૂ કરો, ours
- pause, થોભાવો, ours
- transfer / hand over, સોંપો, ours
- handover (noun), સોંપણી, ours
- close (ticket), ક્લોઝ કરો, ours
- close (a sheet or panel), બંધ કરો, ours
- cancel (ticket or complaint), રદ કરો, ours
- join, જોડાઓ, ours
- leave, છોડો, ours
- fill (report), ભરો, ours
- file (report), જમા કરો, ours
- mark done, પૂરું કર્યું, ours
- restore (a cancelled ticket), પાછી લાવો, ours
- restore (SLA target), રિસ્ટોર, ours (loanword, heads and admins only)
- acknowledge, સ્વીકાર, ours
- correct (a ticket), સુધારો, ours
- send, મોકલો, ours
- save, સેવ કરો, ours (loanword verb, as phones say it)
- edit, બદલો, ours
- add, ઉમેરો, ours
- try again, ફરી પ્રયાસ કરો, ours
- back, પાછા, ours
- continue, આગળ વધો, ours
- choose / select, પસંદ કરો, ours
- switch on / off, ચાલુ કરો / બંધ કરો, ours

## Things and people

- ticket, ટિકિટ, ours (loanword)
- report (breakdown report), રિપોર્ટ, ours (loanword)
- problem, સમસ્યા, ours
- work request, કામની વિનંતી, ours
- other work (not a machine), બીજું કામ, ours
- task (left after a breakdown), બાકી કામ, ours
- Work tab (work requests), વિનંતી, ours
- urgent, અર્જન્ટ, ours (loanword)
- severity, ગંભીરતા, ours
- criticality, મહત્વ, ours
- note, નોંધ, ours
- reason, કારણ, ours
- role, ભૂમિકા, ours
- lead, લીડ, ours (loanword)
- primary, મુખ્ય, ours
- crew / team, ટીમ, ours
- operator, ઓપરેટર, ours (loanword)
- technician, ટેકનિશિયન, ours (loanword)
- supervisor, સુપરવાઇઝર, ours (loanword)
- head, હેડ, ours (loanword)
- plant head, પ્લાન્ટ હેડ, ours (loanword)
- admin, એડમિન, ours (loanword)
- desk, ડેસ્ક, ours (loanword)
- live board, લાઇવ બોર્ડ, ours (loanword)
- settings, સેટિંગ્સ, ours (loanword)
- notifications, નોટિફિકેશન, ours (loanword)
- sign in / sign out, સાઇન ઇન / સાઇન આઉટ, ours
- username, યુઝરનેમ, ours
- password, પાસવર્ડ, ours
- offline / online, ઓફલાઇન / ઓનલાઇન, ours
- update (a post), અપડેટ, ours
- timeline, સમયરેખા, ours
- figures, આંકડા, ours
- minutes, મિનિટ, ours
- hour, કલાક, ours
- day, દિવસ, ours
- e.g., દા.ત., ours
