- Settings → Translations is new: an admin or head sees every key that still shows English in Gujarati mode, with
  its English and a box for the plant's own Gujarati. Saving stores one `i18n.overrides` setting (D17: no new
  table) and the value appears immediately, including on the menu entry it belongs to, and after a reload; nothing
  needs a rebuild. A blank box changes nothing, and a typo cannot be saved as a key. The floor's Gujarati is
  unchanged and complete: the catalogue test and the Gujarati floor journey still pass.
