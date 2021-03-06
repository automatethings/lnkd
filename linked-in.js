/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
const puppeteer = require('puppeteer');

const { getFromFile, saveToFile, resetSeen, resetFlagSet } = require('./utils/fileUtils');
const { preventStaticAssetLoading, login, launchPage } = require('./utils/puppeteerUtils');

let frenz = getFromFile('people.json');
let { username } = getFromFile('credentials.json');
const saveSeen = saveToFile('people.json');

const LOGIN_PAGE_URL =
  'https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin';

if (resetFlagSet()) frenz = resetSeen(frenz, 'linkedin');

const helpFrenz = async () => {
  try {
    let { page, browser } = await launchPage();

    // prevents loading of images / css assets / fonts
    page = await preventStaticAssetLoading(page);

    await page.goto(LOGIN_PAGE_URL);

    // LOGIN
    page = await login(page, 'linkedin');

    for (const fren of frenz) {
      if (fren.name === username) {
        console.log(`${fren.name} --- is you --- skipping....`);
        continue;
      }
      if (fren.linkedin.didVisit) {
        console.log(fren.name, ' --- already helped --- skipping...');
        continue;
      }
      const { name } = fren;
      await page.goto(fren.linkedin.url);
      // check for pending connection
      if ((await page.$('.artdeco-button--disabled')) !== null) {
        console.log(`pending connection with ${name}`);
        continue;
      }

      // if you can dm then you are connected and we can scroll down to skills... otherwise add connection and move on
      if ((await page.$('.pv-s-profile-actions--message')) !== null) {
        await page.evaluate(() => {
          window.scrollTo({
            left: 0,
            top: document.body.scrollHeight,
            behavior: 'smooth',
          });
        });

        // if no click more skills button... they probably haven't added anything relevant... also skips over people who haven't added shit
        try {
          await page.waitForSelector('.pv-skills-section__chevron-icon', { timeout: 3000 });
          await page.click('.pv-skills-section__chevron-icon');
          await page.$$eval('[type="plus-icon"]', (skillz) =>
            skillz.forEach((skill) => skill.click())
          );
          const skillz = await page.$$('[type="plus-icon"]');
          if (skillz.length > 0) {
            console.log(`more skillz to click for ${name}, rerun the app and you should grab them`);
          } else {
            fren.linkedin.didVisit = true;
            saveSeen(frenz);
            console.log(`all skillz clicked for ${name}`);
          }
        } catch (err) {
          continue;
        }
      } else {
        // add fren and move on
        await page.waitForSelector('.pv-s-profile-actions--connect');
        await page.click('.pv-s-profile-actions--connect');
        await page.waitForSelector('.artdeco-modal__actionbar .artdeco-button--primary');
        await page.click('.artdeco-modal__actionbar .artdeco-button--primary');
      }
    }
    browser.close();
  } catch (err) {
    console.log(err);
  }
};

helpFrenz();
