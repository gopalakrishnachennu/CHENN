# ResumeOS production release report

Released: September 7, 2026 at 12:14 PM America/New_York
Production: <https://chenn.web.app>
Firebase project: `chennu4169`

## Release status

**PASSED — production deployed**

- Production HTTP response: 200
- Production asset: `assets/index-CeLLhrQY.js`
- Admin website health: 10/10 checks, 100% readiness
- Browser console errors after production load: 0
- Administrator: `gopalakrishnachennu@gmail.com` only
- Candidate access: read only and restricted to the candidate's own records

## Automated gate

- 9 application/unit tests passed
- 5 Firestore and Storage emulator security tests passed
- TypeScript validation passed
- Firebase production build passed
- 19 UI/backend action contracts verified
- Firestore and Storage default-deny rules verified

Run the same gate before every future release:

```bash
npm run release:check
```

## Browser verification

- Platform color preview changes the candidate preview accent
- Platform font preview loads the selected bundled font
- Candidate preview contains no editable inputs, textareas, or selects
- Browser Back returns from candidate preview to Candidates without login
- Browser Forward restores the same read-only preview
- Direct refresh preserves the selected admin page
- Operations page reports full website health

## Recovery snapshot

`deployment/resumeos-production-20260907-121443.tar.gz`
