# Skyscrapers, client preview

A build of the site for the client to look at, served by GitHub Pages under `/skyscraper-preview/`.
It is a copy: the project, its source and its history live in the private `SkyScraper` repo.

Every page is `noindex,nofollow` and robots.txt blocks everything, so this copy cannot compete
with the real site in search. Rebuild it with:

    node scripts/preview-build.mjs ../skyscraper-preview /skyscraper-preview
