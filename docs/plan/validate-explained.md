# Differences that are explained

One line per difference `pnpm validate:full` prints, with its cause: `- <id> - <cause>`. An id may end in `*` only as
whole segments followed by a colon and the star, like `coverage:*`: a bare `*`, or a star inside a segment
(`coverage:WR*`), is refused and the command stops. A difference listed here counts as explained; nothing is listed yet.
