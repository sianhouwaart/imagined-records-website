# Secure Artist Creation Brief — deployment checklist

This feature lives on branch `feature/secure-artist-brief`, NOT on production main until reviewed and merged.

## Routes
- `/internal/artist-brief/` — Dutch multi-step questionnaire, autosaved locally.
- `/api/artist-brief` — server-side POST endpoint sending all answers to `admin@imaginedrecords.nl`.

## Required Cloudflare configuration (must complete BEFORE sharing the link)
1. Cloudflare Zero Trust → Access → Applications: create a **self-hosted** application covering the site's actual host and `/internal/*`. Create a second self-hosted application covering `/api/artist-brief` (or one application with both paths if supported). Require individual email OTP sign-in, with an **Allow** policy listing only approved addresses. Never use a public Bypass policy. Ensure the Access applications protect both the custom domain and any publicly reachable pages.dev host (or disable the latter).
2. Obtain the Access application AUD tag for the API route. In Cloudflare Pages → Settings → Variables and Secrets, set `ACCESS_AUD` to this exact AUD and `ACCESS_TEAM_DOMAIN` to `https://YOUR-TEAM.cloudflareaccess.com`. The function cryptographically verifies the Access JWT, including audience, issuer and expiry.
3. Set encrypted secret `RESEND_API_KEY` from Resend. Verify a dedicated sending subdomain (e.g. `mail.imaginedrecords.nl`) in Resend, adding ONLY the required sending DNS records; **do not change the existing mailbox MX records**. Set `BRIEF_FROM_EMAIL` to a verified sender such as `Imagined Records <brief@mail.imaginedrecords.nl>`. Mail recipient is fixed to `admin@imaginedrecords.nl`.
4. Cloudflare Pages deployment must include the repository's `functions/` directory. Keep build output `public`; do not add a build command.
5. Test with an allowlisted email: Access sign-in, full questionnaire submission, email receipt, unauthorized POST blocked with 401, and unauthorized GET to the internal route blocked. Verify both the custom domain and pages.dev.
6. The form only considers submission successful after the mail provider accepts the message. A draft stays in browser localStorage if submission fails. This version has no database-backed submissions archive; the email inbox is the record. For a robust archive, add D1 before production if needed.

## Security notes
- GitHub repository is public. Never commit email addresses of authorized users, tokens, or API secrets. Configure allowlists and secrets only in Cloudflare.
- A static page is not itself private just because it lives at /internal; Cloudflare Access protection is mandatory.
- Email addresses used for sign-in are individual identities; shared passwords are not used.
- The API checks signed Cloudflare Access JWTs; a JWT from the page application's different AUD is not sufficient to call the API. Cloudflare Access must also be configured on the API route.
