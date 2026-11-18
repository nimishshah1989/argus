# 42 — docs

Ticket 42's figures are on `main`: A9 bottleneck (#344–#346) and the Forecast Lab (#347) equal their answer keys
whole, including the September row and the seeded 2,000/1,000-run simulations. The **A9 and Lab screens remain** (42e).
The plan review's findings and the September membership rule are in `docs/slices/42-forecast.md`; the CI timeout was
raised to 60 s (#348) because the seeded suite loaded the runners, with no test or assertion changed.
