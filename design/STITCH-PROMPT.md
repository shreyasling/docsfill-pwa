# DocFill — Google Stitch prompt (Wallet-style UI prototype)

Paste the block below into **Google Stitch**. Optionally attach the 4 Google Wallet
screenshots (event ticket / boarding pass / loyalty card / vaccine record) as **style
references** — that's exactly the look we want. Generate a **mobile app**, portrait.

---

**Paste this into Stitch:**

> Design a mobile app called **DocFill** — a personal "document wallet" that stores a
> user's identity documents and autofills any web form by scanning its QR code. The
> visual style should look like **Google Wallet**: a soft light-grey background, tall
> rounded **pass cards** (radius ~20px) with generous padding, subtle shadows, bold
> colored card headers, clean Material-3 typography, and a bottom navigation bar.
> Primary brand color **#2563EB (blue)**; use accent colors per category. Mobile
> only, portrait, PWA-style, thumb-friendly.
>
> **Bottom nav (3 items):** Wallet (documents), a center circular **Scan** button
> (raised, blue, QR icon), and Profile.
>
> **Screen 1 — Sign in.** Centered app logo (a document glyph with a check in a
> rounded blue tile), app name "DocFill", a one-line tagline "Your documents, filled
> in one tap.", three trust bullets ("Files stay in your Google Drive", "We never
> store your files", "You approve every field"), and a white "Continue with Google"
> button with the Google logo. Small footnote: "We only request drive.file access."
>
> **Screen 2 — Wallet (home).** Title "Document vault" with a progress subtitle
> "8 of 11 added". Documents shown as **Google-Wallet-style pass cards**, grouped
> into labeled sections: **Government IDs**, **Education**, **Photo & Signature**,
> **Address proof**. Each pass card has: a colored top strip with the document name
> and a small type icon, the file name, an "Added" green check badge or a "Missing"
> amber badge, and a mini QR/patterned motif on the right like a wallet pass. Missing
> items show a dashed "＋ Add" card. Cards are stacked vertically with slight overlap
> at the section header, like a wallet stack. Category colors: Government IDs = deep
> blue, Education = teal, Photo = purple, Address = amber.
>
> **Screen 3 — Document detail (tap a pass).** Full-screen pass card: large colored
> header with the document label, a preview area (image thumbnail or PDF glyph), key
> fields (file name, added date, "Saved in your Google Drive"), a big QR/pass motif,
> and actions: "View in Drive", "Replace", "Remove". Looks like opening a boarding
> pass in Google Wallet.
>
> **Screen 4 — Add document sheet.** A bottom sheet with three big options as tiles:
> **Pick from Drive**, **Upload file** (PDF/PNG/JPG), **Take photo**. Show an upload
> **progress bar** state ("Uploading to your Drive… 63%").
>
> **Screen 5 — Scan.** Full-bleed dark camera view with a rounded square scan frame
> in the center, a flashlight toggle top-right, close button top-left, helper text
> "Point at the form's QR code", and a small "paste link" fallback field at the
> bottom.
>
> **Screen 6 — Autofill request (the magic moment).** Title "Autofill request",
> subtitle "College Admission Form is requesting the following." A **checklist of
> pass chips**: each required item as a compact card with a green check (satisfied,
> shows the value/file) or amber alert (missing, with an "Add" button). Example rows:
> "Full name — Jane Doe ✓", "PAN number — ABCDE1234F ✓", "12th marksheet —
> 12th.pdf ✓", "Age — 24 (auto-calculated) ✓". A sticky bottom primary button
> **"Approve & Send"**, disabled until all green, with helper text "You approve
> before anything is shared." Then a success screen: big green check, "Sent — your
> details filled the form automatically."
>
> **Screen 7 — Profile.** Sections as cards: **Personal** (Full name, Father's name,
> Date of birth with an auto-computed "Age: 24" chip), **Identity numbers** (PAN,
> Aadhaar with format hints), **Addresses** (Current, Permanent with a "same as
> current" toggle), and a **Settings** card ("Drive upload folder — DocFill folder,
> Change"; "Signed in as user@gmail.com", Sign out). Clean labeled inputs, a sticky
> "Save profile" button.
>
> **Components & polish:** rounded pills, soft shadows, category color chips, empty
> states, loading spinners, and a QR/pass motif reused across cards so the whole app
> feels like a wallet of documents. Include both light theme primarily; keep spacing
> airy and touch targets large.

---

## Notes for you
- Stitch works best if you generate **one screen at a time** — paste the global style
  paragraph + a single screen block, iterate, then move to the next.
- Attach the Wallet screenshots per screen where relevant (e.g. the boarding pass for
  the Document-detail screen).
- When you like the result, export and I can port the exact look into the real PWA
  (Vault cards, detail sheet, autofill checklist).
