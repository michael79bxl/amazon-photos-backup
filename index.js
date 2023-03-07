const puppeteer = require('puppeteer');
const os = require('os');
const spawn = require('child_process');
const fs = require('fs');
const path = require('path');

const defaults = {
  chromePath: '',
  downloadFolder: '~/',
  rootUrl: 'https://amazon.com/photos',
  downloadFile: 'AmazonPhotos.zip',
  albumsUrl: '/albums?sort=sortDateModified',
  albumSelector: '#amazon-photos .album-node',
  albumSelectorLink: '.node-link',
  albumSelectorDate: '.date-created',
  albumSelectorTitle: '.album-title',
  albumSelectorCount: '.album-count',
  albumSelectorOptions: '.more button',
  albumSelectorDownload: 'button.download',
  albumSelectorMultiple: '.mass-download button.download',
};

let settings = defaults;
if (fs.existsSync('settings.json')) settings = JSON.parse(fs.readFileSync('settings.json'));
Object.keys(defaults).forEach(function(key) {
  if (!(key in settings)) settings[key] = defaults[key];
});

if (settings.chromePath === '') {
  if (os.platform() === 'darwin') settings.chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (os.platform() === 'win32') settings.chromePath = '~/AppData/Local/Google/Chrome/chrome.exe';
}
console.log(settings);

if (settings.chromePath.indexOf('~/') === 0) {
  settings.chromePath = path.join(os.homedir(), settings.chromePath.substring(2));
}

if (settings.downloadFolder.indexOf('~/') === 0) {
  settings.downloadFolder = path.join(os.homedir(), settings.downloadFolder.substring(2));
}

(async () => {
  const config = {
    headless: false,
    skipDownload: true,
    executablePath: settings.chromePath,
  };
  
  const browser = await puppeteer.launch(config);
  
  const page = await browser.newPage();
  await page.goto(settings.rootUrl + settings.albumsUrl);
  // Set screen size
  await page.setViewport({width: 0, height: 0});

  // Download albums
  
  // Wait for login
  const index = await page.waitForSelector(settings.albumSelector, {timeout: 0});
  
  // Get all photos (by album)
  const selectors = await page.$$(settings.albumSelector);
  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    const link = await selector.waitForSelector(settings.albumSelectorLink);
    const href = await selector.$eval(settings.albumSelectorLink, link => link.href);
    const date = await selector.$eval(settings.albumSelectorDate, date => date.textContent);
    const title = await selector.$eval(settings.albumSelectorTitle, title => title.textContent);
    const folder = path.join(settings.downloadFolder, title);
    let album = null;
    let nb = 0;
    let count = 0;
    // Compare number of items
    if (fs.existsSync(folder)) {
      fs.readdirSync(folder).forEach(function(file) {
        if (fs.lstatSync(path.join(folder, file)).isFile()) nb++;
      });
      console.log('Folder ' + title + ' contains ' + nb + ' items');
      album = await browser.newPage();
      // Set screen size
      await album.setViewport({width: 0, height: 0});
      await album.goto(href);
      await album.waitForSelector(settings.albumSelectorCount);
      count = await album.$eval(settings.albumSelectorCount, count => count.textContent.replace(/[^0-9]/g, ''));
      console.log('Album ' + title + ' contains ' + count + ' items');
    }    
    if (!fs.existsSync(folder) || parseInt(count) > nb) {
      console.log('Loading ' + title + ' (' + date + ') from ' + href);
      if (!fs.existsSync(folder)) spawn.execSync('mkdir "' + folder + '"').toString();
      if (album === null) {
        album = await browser.newPage();
        // Set screen size
        await album.setViewport({width: 0, height: 0});
        await album.goto(href);
      }
      const options = await album.waitForSelector(settings.albumSelectorOptions);
      await options.click();
      const download = await album.waitForSelector(settings.albumSelectorDownload);
      await album._client().send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: folder,
      });      
      await download.click();
      // multiple downloads
      try {
        await album.waitForSelector(settings.albumSelectorMultiple, {timeout: 1000});
      } catch(e) {
        // ignore error (= single file)
      }
      let multiple = await album.$$(settings.albumSelectorMultiple);
      if (multiple.length === 0) {
        multiple = [download];
      }
      for (let j = 0; j < multiple.length; j++) {
        if (multiple.length > 1) await multiple[j].click();
        if (await downloadDone(folder, settings.downloadFile)) {
          console.log('Download done!');
          const unzip = 'unzip -d "' + folder + '" -o "' + path.join(folder, settings.downloadFile) + '"';
          console.log(unzip);
          console.log(spawn.execSync(unzip).toString());
          fs.unlinkSync(path.join(folder, settings.downloadFile));
        }
      }
    }
    if (album !== null) await album.close();
  }
  
  await page.close();
  await browser.close();
})();

async function downloadDone(folder, downloadFile) {
  const downloadPath = path.join(folder, downloadFile);
  const tmpPath = path.join(folder, downloadFile + '.crdownload');
  return new Promise(function(resolve) {
    const interval = setInterval(function() {
      if (fs.existsSync(tmpPath)) return;
      fs.access(downloadPath, fs.constants.W_OK, function(err) {
        if (!err) {
          setTimeout(function() {
            if (fs.existsSync(downloadPath)) {
              clearInterval(interval);
              resolve(true);
            }
          }, 1000);
        }
      });
    }, 1000);
  });
}