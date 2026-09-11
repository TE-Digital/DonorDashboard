# Design Review: Donor Sponsorship (plus School Calendar and Bilingual Donor Card)

Reviewed against: design/donor-sponsorship/DESIGN_BRIEF.md and design/thai-calendar-and-field-alignment/DESIGN_BRIEF.md
Philosophy: Lumen (calm, functional admin tool; Dieter Rams leaning)
Date: 11 Sep 2026

## Screenshots Captured

Captured with Playwright (Chromium) against a production build. A fake admin session was used and every Supabase request was stubbed. No real data was read or written, and each capture reported 0 overflow, 0 console errors and 0 writes.

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-school-calendar-desktop-1280.png` | Desktop | Calendar settings with school year preview card |
| `screenshots/review-school-calendar-tablet-768.png` | Tablet | Same |
| `screenshots/review-school-calendar-mobile-375.png` | Mobile | Same, sticky footer |
| `screenshots/review-email-templates-desktop-1280.png` | Desktop | Template library, welcome and report groups |
| `screenshots/review-email-templates-mobile-375.png` | Mobile | Same |
| `screenshots/review-email-template-editor-desktop-1280.png` | Desktop | Editor drawer with live "How it reads" preview |
| `screenshots/review-email-template-editor-mobile-375.png` | Mobile | Editor drawer, stacked |
| `screenshots/review-student-donors-tab-desktop-1280.png` | Desktop | Student page Donors tab table |
| `screenshots/review-student-donors-tab-tablet-768.png` | Tablet | Card layout |
| `screenshots/review-student-donors-tab-mobile-375.png` | Mobile | Card layout |
| `screenshots/review-student-donors-tab-more-open-mobile-375.png` | Mobile | Card with "More" details open |
| `screenshots/review-assign-from-student-desktop-1280.png` | Desktop | Assign drawer opened from a student |
| `screenshots/review-assign-from-student-mobile-375.png` | Mobile | Same |
| `screenshots/review-assign-from-donor-desktop-1280.png` | Desktop | Assign drawer opened from a donor, fit badges |
| `screenshots/review-assign-from-donor-selected-desktop-1280.png` | Desktop | Students selected, live balance |
| `screenshots/review-assign-from-donor-mobile-375.png` | Mobile | Same, step flow |
| `screenshots/review-needs-decision-panel-desktop-1280.png` | Desktop | Decision panel, Renew blocked with reason |
| `screenshots/review-needs-decision-panel-mobile-375.png` | Mobile | Same |
| `screenshots/review-welcome-dialog-desktop-1280.png` | Desktop | Welcome email, write and preview |
| `screenshots/review-welcome-dialog-mobile-375.png` | Mobile | Welcome email, Thai |
| `screenshots/review-students-directory-desktop-1280.png` | Desktop | Students list with Donors column and filter |
| `screenshots/review-donor-profile-tab-desktop-1280.png` | Desktop | Bilingual donor card, English |
| `screenshots/review-donor-profile-tab-mobile-375.png` | Mobile | Same |
| `screenshots/review-donor-profile-tab-thai-desktop-1280.png` | Desktop | Thai card with Thai word wrap |
| `screenshots/review-dashboard-today-desktop-1280.png` | Desktop | Not usable: stuck on the loading spinner (stub gap, see below) |

> All screenshots are in `design/donor-sponsorship/screenshots/`.

## Summary

The brief's core promises show up clearly on screen:

- Money is only ever described as given or allocated. Nothing reads as promised.
- Each donor's fit is stated in words, for example "Fully covered to 31 Mar 2027" or "Covers 6 of 7 months".
- Blocked actions say why, for example "Acme Foundation is ฿2,500 short. Record their next payment first, then renew."

The review found three real bugs. All three are fixed in this pass:

- a wrongly capitalised button label
- a mobile dialog footer running off the screen
- a duplicated word in the Thai welcome email

What's left is mostly layout polish. The main item is the desktop Donors table hiding its action columns at 1280px.

## Must Fix

1. **Fixed: the assign button read "Assign A donor"** when you open the drawer from a student and haven't picked a donor yet. It filled the donor-name slot with the placeholder "A donor". See `screenshots/review-assign-from-student-desktop-1280.png`. _Fixed: a new `sponsorship.assign.submitNone` string ("Assign a donor" / "เลือกผู้บริจาค") is used until a donor is picked, in [AssignSponsorDrawer.tsx](../../src/modules/sponsorship/AssignSponsorDrawer.tsx)._
2. **Fixed: the welcome dialog footer ran off the screen at 375px.** "Send welcome to Khun Somchai" pushed "Skip welcome" off the left edge, so it showed as "welcome". See `screenshots/review-welcome-dialog-mobile-375.png`. _Fixed: the button now says "Send welcome" / "ส่งอีเมลต้อนรับ". The dialog title already names the donor._
3. **Fixed: the Thai welcome email said "school" twice** ("โรงเรียนโรงเรียนบ้านห้วย"), because Thai school names already start with โรงเรียน. _Fixed: a `thaiSchool()` helper in [send-welcome/template.ts](../../supabase/functions/send-welcome/template.ts) only adds the prefix when it's missing._
4. **Open: the Thai greeting can show the title twice.** The Thai template opens with "เรียน คุณ{donor_name}", and some donor names already include "Khun", so it reads "เรียน คุณKhun Somchai". _Fix: either drop "คุณ" from the seeded Thai template, or add a separate name-only field for donors. This needs a decision on how donor names are stored._

## Should Fix

1. **The desktop Donors table hides its action columns at 1280px.** The email, renews, welcome and actions columns sit behind a sideways scroll, so Decide, Edit and End can't be seen without scrolling. See `screenshots/review-student-donors-tab-desktop-1280.png`. _Fix: keep the actions column pinned to the right, or use the card layout up to about 1280px._
2. **The decision panel's Renew button isn't pinned on mobile.** It's meant to stay visible at the bottom, but on a phone it scrolls away with the rest of the drawer. See `screenshots/review-needs-decision-panel-mobile-375.png`. _Fix: make it sticky inside the drawer's scrolling area, not the page._
3. **The calendar's sticky footer covers fields, and its button icons overlap the text on mobile.** See `screenshots/review-school-calendar-mobile-375.png`. _Fix: add bottom padding to the form that matches the footer height, and stop the icons from being positioned on top of the labels in the footer buttons._
4. **Stacked template editor fields have no space between them.** The "Name" box touches the "When to use it" label, on desktop and mobile. See `screenshots/review-email-template-editor-desktop-1280.png`. _Fix: put the two fields in a Stack with the standard gap._
5. **The summary tiles cut off their numbers.** "1 a…", "U." and a missing count on "Reports overdue" all appear on the student page and the students list. This is an existing KpiRow problem, not new work, but these pages rely on the Donors tile. See `screenshots/review-students-directory-desktop-1280.png` and `screenshots/review-donor-profile-tab-thai-desktop-1280.png`. _Fix: give the number space that never shrinks, and cut the caption short instead._
6. **A donor who already funds this student is offered again.** In `screenshots/review-assign-from-student-desktop-1280.png`, Khun Somchai is listed as available even though they already actively fund Mali. _Fix: remove, or show as already assigned, any donor who has an active sponsorship for the same student._
7. **The card's Edit and End icon buttons look smaller than 44px on mobile.** See `screenshots/review-student-donors-tab-more-open-mobile-375.png`. _Fix: raise the minimum tap size of those icon buttons to 44px._

## Could Improve

1. **"฿0 goes back to their free balance"** on the decision panel is technically true but confusing. _Suggestion: when nothing is left, say "Nothing is left to return" and put this option below the others._
2. **The dashboard Today rail wasn't captured.** The page stayed on its loading spinner because one request wasn't stubbed. The new Today items (waiting on a decision, welcome to send) haven't had a visual check. _Suggestion: add the missing stub and capture it again._
3. **Template library cards on desktop** leave a lot of empty space on the right. _Suggestion: move the "English written · Thai not written" status to the right side of the card._
4. **The assign drawer from a student** leaves a large empty area below short lists. _Suggestion: show the donor's balance in the header, or fit the drawer's height to its content._

## What Works Well

- **Fit in plain words.** Labels like "Fully covered to 31 Mar 2027" and "Covers 6 of 7 months" answer the admin's real question without any sums. Keep this pattern everywhere money appears.
- **Blocked means explained.** The disabled Renew button carries its reason ("฿2,500 short. Record their next payment first"). Blocked students are listed with a reason rather than hidden.
- **The decision panel reads like a decision.** It opens with a one-line summary of what happened, then a small facts table, then four options, each with its effect in one sentence.
- **The calendar preview card** turns day and month pickers into a sentence you can check: "Runs from 16 May 2026 to 31 Mar 2027 … Reports are due by 31 Oct 2026."
- **The template editor preview** fills in real names beside the fields as you type, and shows a placeholder for the student block, so admins can see exactly what's fixed and what they can edit.
- **Thai looks right.** The Thai donor card wraps at word boundaries and uses the Thai font. The Thai welcome dialog, tabs and labels all fit.
- **Tablet and mobile get a different layout, not a squeezed one.** The Donors tab switches to cards, with secondary details behind "More".
- **Consistent use of the design system.** Only Lumen tokens and components are used. Status colours are consistent: amber for "No donor yet" and "Needs a decision", green for Active. No one-off colours.
