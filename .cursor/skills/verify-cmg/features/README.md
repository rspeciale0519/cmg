# Feature index

Mapped user-facing surfaces for `verify-cmg`. Drive with:

```bash
./.cursor/skills/verify-cmg/scripts/drive.sh <journey>
```

| File | Journey | SITE_MODE | What a person does |
|---|---|---|---|
| [public-site.md](public-site.md) | `public-contact` (proof default), `public-intake` | `simple` (also works in staff/platform) | Public marketing site, contact lead, claim intake |
| [staff-login.md](staff-login.md) | `staff-login` | `staff` or `platform` | Staff sign-in and TOTP / AAL2 |
| [admin-claims.md](admin-claims.md) | `admin-claims` | `staff` or `platform` | Claims desk after AAL2 |
| [customer-portal.md](customer-portal.md) | `customer-portal` | `platform` | Homeowner portal and document upload chrome |
| [partner-directory.md](partner-directory.md) | `partner-directory` | `platform` | Owner partner list, public contractors page, partner portal |

Do not weaken a journey when seed data is missing a factor or row. Fail it and record the reason under Gotchas.
