# Design

Nimish's preference: Apple's design principles. The installer writes this file once; edit it for this product.

## Principles
- **Clarity.** Text is legible at every size, icons are precise, and the one thing a screen is for is obvious at a glance.
- **Deference.** The interface steps back so the content leads: no decoration that doesn't help someone act or understand.
- **Depth.** Layers and motion explain where you are and what just happened; they are never there for show.

## Rules that follow from them
- Colour is restrained: one accent colour for actions; everything else is neutral. Colour never carries meaning alone.
- Space is generous: when in doubt, more white space and fewer items per screen.
- Type is the system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`), with a short scale and clear weight contrast.
- One primary action per screen. Secondary actions look secondary.
- Motion is short and purposeful (under 300 ms) and respects reduced-motion settings.
- Every screen works at phone width, has visible focus states, and passes an accessibility check.

## How to apply it
Use the `impeccable` skill for any screen; it reads this file. Its "Operate" and "Read" modes (precision and restraint) fit these principles; don't use its bolder modes unless Nimish asks.
