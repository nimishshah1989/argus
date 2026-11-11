# Tag System Design

Controlled tag vocabulary for Argus. No ad-hoc tags.

## Tag Categories

| Category          | Purpose                 | Values                                                            |
| ----------------- | ----------------------- | ----------------------------------------------------------------- |
| Criticality       | Ticket urgency          | Critical, High, Medium, Low                                       |
| Machine Condition | Operational state       | Running, Stopped, Degraded, Maintenance                           |
| Machine Type      | Asset category          | Production, Auxiliary, Utility, Safety                            |
| Classification    | Ticket/machine grouping | Electrical, Mechanical, Hydraulic, Pneumatic, Control, Structural |
| Vendor            | Supplier reference      | Vendor name (controlled list)                                     |
| Follow-up Type    | Next action class       | Parts, Quote, Inspection, Vendor, Schedule                        |
| Work Request      | Work origin             | Preventive, Corrective, Improvement                               |

## Semantic Colours (Accessible Palette)

| Category          | Value       | Background | Text      | Border    | Contrast |
| ----------------- | ----------- | ---------- | --------- | --------- | -------- |
| Criticality       | Critical    | `#fef2f2`  | `#991b1b` | `#fecaca` | 8.6:1    |
| Criticality       | High        | `#fff7ed`  | `#c2410c` | `#fed7aa` | 7.2:1    |
| Criticality       | Medium      | `#fefce8`  | `#a16207` | `#fef08a` | 6.8:1    |
| Criticality       | Low         | `#f0fdf4`  | `#166534` | `#bbf7d0` | 7.8:1    |
| Machine Condition | Running     | `#ffffff`  | `#6e6e73` | `#d2d2d7` | 5.1:1    |
| Machine Condition | Stopped     | `#fef2f2`  | `#991b1b` | `#fecaca` | 8.6:1    |
| Machine Condition | Degraded    | `#fff7ed`  | `#c2410c` | `#fed7aa` | 7.2:1    |
| Machine Condition | Maintenance | `#eff6ff`  | `#1d4ed8` | `#bfdbfe` | 6.9:1    |
| Machine Type      | Production  | `#ffffff`  | `#0d9488` | `#99f6e4` | 5.8:1    |
| Machine Type      | Auxiliary   | `#ffffff`  | `#0891b2` | `#a5f3fc` | 5.4:1    |
| Machine Type      | Utility     | `#ffffff`  | `#6366f1` | `#c7d2fe` | 5.6:1    |
| Machine Type      | Safety      | `#fef2f2`  | `#991b1b` | `#fecaca` | 8.6:1    |
| Classification    | Electrical  | `#ffffff`  | `#6e6e73` | `#e8e8ed` | 5.1:1    |
| Classification    | Mechanical  | `#ffffff`  | `#6e6e73` | `#e8e8ed` | 5.1:1    |
| Classification    | (all)       | `#ffffff`  | `#6e6e73` | `#e8e8ed` | 5.1:1    |
| Vendor            | (any)       | `#f5f5f7`  | `#48484a` | `#d2d2d7` | 5.9:1    |
| Follow-up         | Parts       | `#eff6ff`  | `#1d4ed8` | `#bfdbfe` | 6.9:1    |
| Follow-up         | Quote       | `#f5f5f7`  | `#48484a` | `#d2d2d7` | 5.9:1    |
| Follow-up         | Inspection  | `#ffffff`  | `#6e6e73` | `#e8e8ed` | 5.1:1    |
| Follow-up         | Vendor      | `#faf5ff`  | `#7c3aed` | `#ddd6fe` | 6.2:1    |
| Follow-up         | Schedule    | `#f0fdf4`  | `#166534` | `#bbf7d0` | 7.8:1    |
| Work Request      | Preventive  | `#f0fdf4`  | `#166534` | `#bbf7d0` | 7.8:1    |
| Work Request      | Corrective  | `#fff7ed`  | `#c2410c` | `#fed7aa` | 7.2:1    |
| Work Request      | Improvement | `#eff6ff`  | `#1d4ed8` | `#bfdbfe` | 6.9:1    |

**Deep-teal action accent**: `#0d9488` (buttons, links, primary actions)
**White body**: `#ffffff` canvas, `#f5f5f7` secondary surfaces

## Lucide Icon Mapping

| Category          | Icon (16px)                                                |
| ----------------- | ---------------------------------------------------------- |
| Criticality       | `alert-circle`, `alert-triangle`, `minus-circle`, `circle` |
| Machine Condition | `play`, `square`, `alert-triangle`, `wrench`               |
| Machine Type      | `cog`, `plug`, `droplet`, `shield`                         |
| Classification    | `zap`, `settings`, `droplet`, `wind`, `cpu`, `home`        |
| Vendor            | `building-2`                                               |
| Follow-up         | `package`, `file-text`, `search`, `building-2`, `calendar` |
| Work Request      | `calendar-check`, `wrench`, `trending-up`                  |

## Pill Geometry

- Height: 28px (touch target contained in 52px hit area)
- Radius: 14px (full pill)
- Padding: 8px horizontal, 4px vertical
- Font: 13px system-ui, weight 500
- Icon: 16px, left-aligned, 4px gap to label
- Min-width: content + 16px padding

## Interaction States

| State         | Background      | Border              | Shadow                           |
| ------------- | --------------- | ------------------- | -------------------------------- |
| Default       | Category colour | Category border     | none                             |
| Hover         | Darken 5%       | Darken 10%          | none                             |
| Selected      | Darken 10%      | Deep-teal `#0d9488` | `0 0 0 2px rgba(13,148,136,0.3)` |
| Focus-visible | Category colour | Deep-teal `#0d9488` | `0 0 0 2px rgba(13,148,136,0.5)` |
| Disabled      | `#f5f5f7`       | `#e8e8ed`           | none, opacity 0.5                |

Hover/selected transitions: 150ms ease-out

## Tag Matrix (Examples)

| Context             | Tags Displayed                                  |
| ------------------- | ----------------------------------------------- |
| Floor ticket list   | Criticality (pill)                              |
| Floor ticket detail | Criticality, Work Request, Classification       |
| Desk open list      | Criticality, Machine Condition                  |
| Desk working ticket | Criticality, Machine Condition, Classification  |
| Desk follow-up      | Follow-up Type, Vendor name                     |
| Board tile          | Criticality, Machine Condition                  |
| Machine sheet       | Machine Type, Condition, Classification, Vendor |
| Work request form   | Work Request (selectable)                       |

## Accessibility Notes

- All colour pairs meet WCAG 2.1 AA (≥4.5:1 for text)
- Tags never convey meaning by colour alone (always paired with label)
- Focus-visible ring is deep-teal, 2px, offset 2px
- Icon + label pairing ensures semantic meaning without colour
- Screen readers announce: "{category}: {value}" (e.g., "Criticality: High")
- Reduced motion: disable colour transitions, use instant colour change
- Touch targets: 52px minimum (pill can be smaller if nested in larger hit area)

## Controlled Vocabulary Enforcement

- Tags render from predefined lists only
- No free-text tags in UI
- New tag values require design-system review
- Vendor list seeded from master data, no runtime additions
- All tags have fixed colour/icon mapping (no per-instance override)
