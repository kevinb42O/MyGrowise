# Projectafspraken

## GitHub Actions nooit gebruiken

Kevin verbiedt GitHub Actions expliciet. Voeg geen workflows onder `.github/workflows/` toe, schakel Actions niet in en gebruik Actions niet voor tests, builds, releases, deployments of andere automatisering. Dit is een vaste projectvoorkeur, geen tijdelijke beperking door facturatie.

Voer controles lokaal uit. Deployments verlopen rechtstreeks via de bestaande Vercel-integratie. Vercel Free/Hobby blijft een vaste randvoorwaarde; voeg geen betaalde scheduler of abonnement toe.
