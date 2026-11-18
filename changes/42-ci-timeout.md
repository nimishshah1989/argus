# CI — the test timeout

The domain suite now carries the seeded forecast/lab simulations; on a loaded CI runner unrelated millisecond tests were timing out at 20 s. The suite timeout is 60 s (assertions unchanged) so load cannot fail an unrelated test.

Second pass: even 60 s was not enough on the loaded runner (a trivial A6 test hit it while the simulation files ran), so the ceiling is 120 s. Still a fail-later ceiling; no assertion changed.
