# Card Scanner

A free business card scanner for networking events. Photograph a card, get the contact onto your phone, send your booking link, and keep a searchable on-device directory. No contact data is stored on any server.

## File layout

```
card-scanner/
  index.html        the whole app (frontend)
  package.json
  api/
    scan.js         serverless function that reads the card via the Anthropic API
  README.md
```

## Deploy (Vercel)

1. Push this repo to GitHub.
2. In Vercel: Add New > Project > import this repo. Framework preset "Other", no build command.
3. Add an Environment Variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
4. Deploy.

## Use

- Open the deployed URL on a phone.
- Settings: add your name and scheduling link once.
- Scan: photograph a card, confirm the fields, save.
- Directory: search, filter by industry, add to phone contacts, email your booking link, or export the whole directory as one HTML file.

A group is identified by a URL parameter, for example `?g=bni-dumont`, shown in the header.

## Notes

- The card photo is resized in the browser, sent for reading, and discarded. It is not stored.
- Contacts live in the browser's local storage on the user's device, plus whatever they export or add to their phone.
- Model ID is set in `api/scan.js` (search `ANCHOR: MODEL_ID`).
