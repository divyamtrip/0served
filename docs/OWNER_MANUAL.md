# 0served — Owner & Editorial Desk Operating Manual

This manual provides instructions for operating the **0served** publication and private administration portal without editing source code.

---

## 1. Accessing the Editorial Desk

The administrative desk is located at:
```
https://oserved.com/admin
```
*(During local development: `http://localhost:4321/admin`)*

### A. Initial Account Provisioning
For security, public registration is completely disabled. To provision or update an authorized owner account, execute the secure CLI provisioning command from your terminal:

```bash
npm run owner:create -- --email="owner@oserved.com" --password="YourSecurePassword123!"
```
Or set environment variables:
```bash
INITIAL_OWNER_EMAIL="owner@oserved.com" INITIAL_OWNER_PASSWORD="YourSecurePassword123!" node scripts/provision-owner.mjs
```

### B. Password Requirements & Security
- Passwords must be at least 10 characters long.
- Passwords are encrypted with Node.js native `crypto.scrypt` using an individual 16-byte random salt.
- Failed logins are strictly rate-limited (5 attempts per 15 minutes per IP/account) to block brute-force attacks.
- Sessions use cryptographically secure 32-byte tokens stored in HTTP-only, SameSite=Lax cookies.

---

## 2. Editorial Dashboard (`/admin`)

Upon logging in, the dashboard displays:
- **Real Metrics**: Total published reports, private drafts, archived reports, active research domains, and unread inbound inquiries. No simulated or decorative analytics.
- **Recently Updated**: A list of recently edited reports with instant links to Edit and Preview.
- **Active Publications**: Quick links to live public URLs.
- **Quick Actions**: Shortcuts to create a new report, manage categories, upload media, or review desk inquiries.

---

## 3. Creating & Managing Research Reports (`/admin/reports`)

### A. Creating a New Report
1. Click **+ Create New Report** in the top navigation or dashboard.
2. Enter the **Report Title**. The system automatically generates a clean URL slug.
3. Enter an optional **Subtitle** for analytical framing.
4. Select the **Research Domain** (Category).
5. Write the **Executive Summary / Abstract**. This summary heads the report and appears in research listings, search results, and OpenGraph social previews.
6. Write the **Body Content** in Markdown (see Formatting Guide below).
7. Choose the **Publication Status**:
   - `Draft (Private)`: Stored in the database, editable, previewable by the owner, but completely inaccessible to the public.
   - `Published (Live)`: Immediately active across the live website, archive, and RSS feed.
   - `Archived (Vault)`: Preserved in the database but removed from public listings.
8. Click **Save Draft** or **Publish Report**.

### B. Live Split-Screen Preview & Autosave
- Switch between **Write** and **Preview** tabs above the editor to inspect formatted typography, tables, and callouts in real time.
- The editor automatically monitors dirty state and saves drafts every 30 seconds.
- The browser will warn you if you attempt to leave the page with unsaved edits.

### C. Previewing Drafts
- Click the **Preview** button to view the report on the actual public page layout with a prominent `Private Preview Mode` indicator banner.
- Unauthenticated visitors attempting to access a draft URL receive an HTTP 404 (Not Found) response, ensuring zero data leakage.

### D. Editing Slugs & URL Redirect Preservation
- If you edit a report's URL slug, the system automatically registers a permanent HTTP 301 redirect from the old slug to the new slug in the `slug_redirects` database table. Old links will never break.

### E. Unpublishing, Archiving, Duplicating & Deleting
- **Unpublish**: Sets a report's status back to `Draft`. The report immediately disappears from public listings and returns 404 to public requests.
- **Archive**: Preserves the report in the archival vault while hiding it from active public listings.
- **Duplicate**: Clones the report into a new draft with `-copy` appended to the slug. Useful for serial reports or consistent report templates.
- **Delete**: Prompts for confirmation and permanently removes the report from the database.

---

## 4. Markdown Formatting & Evidence Standards

The 0served editor is configured for long-form analytical research:

### Headings
```markdown
## 1. Executive Findings
### A. Structural Imbalance
```

### Callouts (Methodological Notes)
```markdown
> [!NOTE]
> Transmission interconnection queues now average 4.2 years across tracked regional operators.
```

### Tables
Use standard Markdown table syntax (or click the **Table** button on the toolbar):
```markdown
| Asset Class | Accounting Schedule | Economic Life | Variance |
| :--- | :--- | :--- | :--- |
| Accelerator Silicon | 5.0 Years (60 Mo) | 3.1 Years (37 Mo) | +23 Mo |
| High-Density Power | 10.0 Years (120 Mo) | 6.5 Years (78 Mo) | +42 Mo |
```
*Note: Tables automatically render inside horizontal scroll containers on mobile screens to preserve layout integrity.*

### Footnotes & Citations
```markdown
According to federal transmission filings [^1], capital intensity has increased.

[^1]: Federal Energy Regulatory Commission (FERC) Interconnection Queue Filing, Q2 2026.
```

---

## 5. Research Domains & Categories (`/admin/categories`)

- **Add Domain**: Click **+ Add New Domain**, enter the name, slug, description, and display sequence.
- **Reassign / Safe Deletion**: To prevent broken public reports, the system strictly forbids deleting any category that currently has published reports assigned to it. You must reassign or remove those reports first.
- **Hide / Deactivate**: If a category has no active research yet, you can toggle its visibility to `Hidden`.

---

## 6. Media & Document Library (`/admin/media`)

- **Uploads**: Drag and drop images or PDFs directly into the dropzone.
- **Supported Formats**: PNG, JPEG, WebP, SVG, AVIF (up to 10MB) and PDF documents (up to 25MB).
- **Safety**: Uploaded files are assigned cryptographically unguessable UUID storage keys. Executable scripts (`.exe`, `.sh`, `.js`, `.html`) are rejected.
- **Copying URLs**: Click **Copy URL** on any asset to immediately copy its public link (e.g., `/uploads/[uuid].pdf`) and paste it into a report's PDF Attachment or Cover Image field.

---

## 7. Site Settings (`/admin/settings`)

Manage live global parameters without touching code:
- **Brand Title & Tagline**: Updates the hero statement, header, and metadata.
- **Homepage Featured Report**: Select any published report from the dropdown to make it the lead investigation on the homepage.
- **Communications Desk**: Update public contact email and stated response standards.
- **Social Outlets**: Configure links for X / Twitter, LinkedIn, and GitHub.
- **About Statements**: Update the public Mission, Methodology, and Brand Principles text.

---

## 8. Inquiries & Communications Desk (`/admin/inquiries`)

- Review all submissions sent through the public `/contact` form.
- Filter by `Unread`, `Read`, or `Archived`.
- Click **Reply via Email** to launch your email client pre-populated with the inquirer's address and subject classification.
