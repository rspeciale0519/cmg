# Blockers

Items that cannot be resolved in code and need the owner to supply something.

---

## 1. Photography for the two `ImageSlot` placeholders (owner-supplied)

**Status:** open — blocks a major-brand read on `/` and `/about`.

**What's blocked**

Two `ImageSlot` components ship as visible placeholders because no photographs
exist for them:

| Route    | File                                | Placeholder label            |
| -------- | ----------------------------------- | ---------------------------- |
| `/`      | `src/app/(marketing)/page.tsx:160`   | "Storm damage inspection"    |
| `/about` | `src/app/(marketing)/about/page.tsx:121` | "The CMG field team"     |

Each renders a bordered 4:3 box with corner ticks and a centred caption — a
labelled empty frame, not a photograph.

**Why it is owner-level, not a code problem**

The prototypes (`design/prototypes/Home.dc.html`, `About.dc.html`) specify an
`<image-slot>` in both positions with the instruction "Drop a photo — storm
damage or an inspection; dark backgrounds blend best". The slot is the design;
the asset is the missing input. Nothing in the codebase can produce a
photograph of CMG's field team or of a real inspection, and substituting stock
imagery would misrepresent the business — the About slot in particular is
captioned as CMG's own staff.

**Assessment from the craft review**

Named "the single most damaging element against a major-brand read", and the
root cause of the right-hand voids on those two sections: each placeholder
sits in the right-hand column of a two-column band, so the band's second
anchor is currently an empty frame.

**Exact unblock step**

1. Owner supplies two photographs:
   - **Home:** storm damage or an adjuster inspecting a property. Landscape,
     4:3 or wider, min 1600px on the long edge. Dark or low-key images sit
     best on the `#26292c` canvas.
   - **About:** the CMG field team (or the licensed adjuster on site). Same
     format constraints.
2. Drop them in `public/images/`.
3. Change each call site from the label-only form to the image form — the
   component already supports it and needs no edit:

   ```tsx
   // src/app/(marketing)/page.tsx
   <ImageSlot src="/images/storm-inspection.jpg" alt="Storm damage inspection" />

   // src/app/(marketing)/about/page.tsx
   <ImageSlot src="/images/cmg-field-team.jpg" alt="The CMG field team" />
   ```

   `ImageSlot`'s prop types (`src/components/ui/image-slot.tsx`) already
   require `alt` whenever `src` is given, so the swap cannot ship without
   alt text.

**Damage reduction applied in the meantime**

None beyond what the layout already does. The two bands are `items-center`
two-column grids that collapse to a single column below 300px track width, so
the pages hold without the imagery — but on desktop the placeholder is
unavoidably visible. Removing the slots entirely was rejected: it would
delete a prototype-specified structure, and the sections would then have no
second anchor at all.
