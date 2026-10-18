# MyGrowise

Begin bij de [kennisbank](docs/README.md), de [actuele voortgang](docs/MASTERPLAN.md) en het [releaserunbook](docs/RELEASE-RUNBOOK.md).

```sh
npm ci
npm run dev
npm test
npm run check
npm run security:audit
npm run check:artifact
```

Gebruik [.env.example](.env.example) voor configuratie. Productie draait op Vercel Free/Hobby: directe mailpogingen, één dagelijkse fallback en handmatig herstel via beheer. Nieuwe bestellingen zijn in productie standaard gepauzeerd tot definitieve verkoopinformatie is bevestigd; bestaande aankooptoegang blijft werken.

Laatste broncontrole: 18 oktober 2026 tegen `b2cfabd` plus de releasewijzigingen. Database-, HTTP- en externe productiecontrole hebben ieder hun eigen bewijsgrens; zie de runbooks.
