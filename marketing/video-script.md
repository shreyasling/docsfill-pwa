# DocFill — Video Scripts & Storyboards

Three ready-to-shoot scripts:
1. **Brand film** — the problem (queues, cyber centres, lost documents) → the DocFill fix. (~75s)
2. **Developer explainer** — how a coder integrates DocFill in 3 lines. (~50s)
3. **User walkthrough** — how a person uses the DocFill app end-to-end. (~70s)

Brand colours: DocFill Blue `#2563eb`, ink `#0f172a`. Font: Inter / system sans.
Tagline: **"Your documents. Your Drive. One scan away."**

---

## SCRIPT 1 — Brand Film (Problem → Solution) · ~75 seconds

**Goal:** make the pain visceral in 20s, then land the relief. Emotional, fast cuts.

| # | Time | Visual (shot) | On-screen text | Voiceover (VO) |
|---|------|---------------|----------------|----------------|
| 1 | 0:00–0:04 | Wide shot: long queue outside a government office, midday sun, people fanning themselves with paper files. | — | "Every form. Every office. The same story." |
| 2 | 0:04–0:09 | Close-up: a man frantically flipping through a torn folder — marksheets, Aadhaar photocopies spilling out. | *"Where's my 10th marksheet?"* | "You dig for documents you scanned months ago…" |
| 3 | 0:09–0:15 | Cyber-café counter: a stranger holds the customer's Aadhaar + PAN, photocopying them, casually saving files on a shared PC. | *"Your ID… on their computer."* | "…hand your most private IDs to a stranger at a cyber centre…" |
| 4 | 0:15–0:20 | Over-the-shoulder: a woman re-typing the same name, DOB, address into her 5th form today. Frustrated sigh. | *"Name. DOB. Address. Again."* | "…and type the same details, over and over." |
| 5 | 0:20–0:24 | Freeze-frame, desaturate the chaos. A blue phone-shaped light appears in the crowd. | **Enough.** | "There's a better way." |
| 6 | 0:24–0:30 | Clean cut to bright UI: DocFill "Wallet" screen — document cards (Aadhaar, PAN, 10th marksheet) neatly grouped. | **DocFill** | "DocFill keeps your documents where they belong — in *your* Google Drive." |
| 7 | 0:30–0:37 | Phone camera opens, scans a QR on a laptop admission form. Green scan-line sweeps. | *"Scan to fill."* | "Scan any form's code…" |
| 8 | 0:37–0:44 | Split screen: phone shows an approval checklist ("Full name ✓ PAN ✓ 12th marksheet ✓"), laptop form fills itself field by field. | *"You approve. It fills."* | "…approve what you share, and watch the form complete itself — text *and* files." |
| 9 | 0:44–0:50 | Close-up of a lock icon + "Encrypted on your device". The cyber-café shot from #3 briefly reappears with a red ✗. | *"No cyber centre. No oversharing."* | "Nothing is stored in the open. Your data is encrypted on your device — shared only when you say so." |
| 10 | 0:50–0:58 | The woman from #4 taps once, smiles, walks out past the queue. | *"One scan. Done."* | "No queues. No re-typing. No handing your identity to strangers." |
| 11 | 0:58–1:05 | Montage: student, job applicant, senior citizen — each scanning, each done in seconds. | *"For every form. For everyone."* | "College admissions, job applications, KYC — one vault for all of it." |
| 12 | 1:05–1:12 | Logo lockup on clean blue. QR pulses invitingly. | **DocFill** · *Your documents. Your Drive. One scan away.* | "DocFill. Your documents, your Drive, one scan away." |
| 13 | 1:12–1:15 | End card: app name + "Sign in with Google". | **Get started free** | — |

**Audio:** tense low pulse (0:00–0:20) → uplifting resolve on the cut at 0:20 → warm major-key bed to end.
**B-roll to capture:** real queue, hands with folders, cyber-café counter, laptop form, phone scan, relieved faces.

---

## SCRIPT 2 — Developer Explainer (~50 seconds)

**Goal:** convince a developer it's a 3-line drop-in. Screen-recording driven (use `developer-integration.html`).

| # | Time | Visual | On-screen text | VO |
|---|------|--------|----------------|-----|
| 1 | 0:00–0:06 | A plain HTML admission form in a code editor. Cursor blinks. | *"Your existing form."* | "You've already got a form. You don't want to rebuild it." |
| 2 | 0:06–0:14 | Type `data-docfill="identity.full_name"` onto each input — highlight the attribute. | **Step 1 — tag your fields** | "Step one: tag each field with what it is. Full name, PAN, marksheet — from a shared vocabulary." |
| 3 | 0:14–0:24 | Add the script tag + `new DocFill({ formId, pwaUrl }).mount('#qr')`. Three lines glow. | **Step 2 — drop in the SDK** | "Step two: drop in the SDK and mount it. That's three lines." |
| 4 | 0:24–0:32 | Browser preview: a QR code renders on the form automatically. | *"A QR appears."* | "A secure, one-time QR appears on your page." |
| 5 | 0:32–0:42 | User scans with phone (inset), approves; the form's fields fill live, including a file input showing "✓ Uploaded". | **Step 3 — it fills itself** | "Your user scans, approves, and every field fills itself — real files included." |
| 6 | 0:42–0:48 | The captured JSON submission appears: text inline, files as Drive references. | *"You just get clean data."* | "Your submit handler gets clean, structured data. No storage. No liability." |
| 7 | 0:48–0:52 | Logo + `npm i docfill-sdk`. | **docfill-sdk** · *drop-in autofill* | "DocFill SDK. Autofill any form, in minutes." |

**Key line to caption big:** *"3 lines. Any form. Real documents."*

---

## SCRIPT 3 — User Walkthrough (Marketing, ~70 seconds)

**Goal:** show the app is effortless and safe. Screen-record the PWA on a phone frame.

| # | Time | Visual | On-screen text | VO |
|---|------|--------|----------------|-----|
| 1 | 0:00–0:06 | App open → "Sign in with Google" tap. | **1. Sign in** | "Start with the Google account you already have." |
| 2 | 0:06–0:14 | Vault "unlock" screen: user types a passphrase; lock icon opens. | **Private by design** | "Set one passphrase. Your details are encrypted on your device — only you can unlock them." |
| 3 | 0:14–0:24 | Wallet screen: tap "Add", pick a file from Google Drive; a document card lights up with a colour strip. | **2. Add once** | "Add your documents once — straight from your own Google Drive. Nothing leaves your account." |
| 4 | 0:24–0:32 | Profile screen: fill name, DOB, PAN, address; tap Save. | **3. Save your details** | "Save the details every form asks for — name, date of birth, PAN, address." |
| 5 | 0:32–0:42 | Scan tab → camera → scan a QR on a laptop form. Animated scan-line. | **4. Scan any form** | "When a form asks for your documents, just scan its code." |
| 6 | 0:42–0:54 | Approval checklist appears (Google-Wallet style rows with ✓). User reviews exactly what's shared. | **5. You're in control** | "See exactly what's being shared — every field, every file — before you approve." |
| 7 | 0:54–1:02 | Tap "Approve" → success "Sent!" → laptop form fills instantly. | **6. Done in seconds** | "One tap, and the form fills itself. Text and files, done." |
| 8 | 1:02–1:08 | Activity screen: a log entry "Shared with college-admission-demo · 2m ago · expires in 7d". | **Full transparency** | "And there's a log of everything you approved — who, what, and when." |
| 9 | 1:08–1:12 | Logo + tagline. | **DocFill** · *One scan away.* | "DocFill. Your documents, your Drive, one scan away." |

---

## Shot / capture checklist
- [ ] Real queue + folder b-roll (or stock)
- [ ] Cyber-café counter re-enactment (consent from actors)
- [ ] Screen recording: PWA on a phone frame (use the deployed app)
- [ ] Screen recording: `developer-integration.html` (code → QR → autofill)
- [ ] Screen recording: laptop demo form filling live
- [ ] Voiceover recorded clean, 1 take per line, room-tone at start

## Captions / hooks for social cutdowns
- "You should never hand your Aadhaar to a stranger again."
- "I filled a 20-field admission form in one scan."
- "Developers: add document autofill in 3 lines."
- "Your documents live in YOUR Google Drive. Not ours."
