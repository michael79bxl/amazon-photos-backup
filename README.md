# Amazon Photos Backup

Backup Amazon Photos albums locally.

## Requirements

* Node
* puppeteer
* Google Chrome
* Amazon account credentials

## Settings

Defaults:
* https://amazon.com/photos
* Google Chrome win/mac
* Home folder (~/ replaced with user home folder; downloadFolder must exist)

Create a settings.json file (in the app folder) to customize, sample:
```
{
  "downloadFolder": "~/Pictures/Amazon Photos",
  "rootUrl": "https://amazon.fr/photos",
  "chromePath": "~/AppData/Local/Google/Chrome/chrome.exe"
}
```

## Running

* macOS : run backup.command
* other : open shell from folder and run `npm run start`
