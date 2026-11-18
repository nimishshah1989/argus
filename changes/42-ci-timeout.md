# CI — the test timeout

The domain suite now carries the seeded forecast/lab simulations; on a loaded CI runner unrelated millisecond tests were timing out at 20 s. The suite timeout is 60 s (assertions unchanged) so load cannot fail an unrelated test.
