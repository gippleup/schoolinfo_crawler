import puppeteer from 'puppeteer';
import { saveFile } from './utils';
import path from 'path';
import buildUtil from './전형정보검색/utils';

const scrape = async() => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1080,
      height: 800,
    }
  });
  const page = await browser.newPage();
  await page.goto("http://www.adiga.kr/PageLinkAll.do?link=/kcue/ast/eip/eis/inf/selctninf/EipSelctnInfGnrl.do&p_menu_id=PG-EIP-06001");

  const utils = buildUtil(page);
  const {
    selectUniversity,
    selectEnrollType,
    clickSearch,
    goToNextPage,
    scrapeSearchResult,
    // selectArea,
    // selectMinGradeRule,
    // waitForSearchTable,
  } = utils;

  await selectUniversity("전문대학");
  await selectEnrollType("전문대학", "정시모집");
  await clickSearch();
  let hasNextPage = true;
  const json: any[] = [];
  while (hasNextPage) {
    const pageResults = await scrapeSearchResult();
    json.push(pageResults);
    hasNextPage = await goToNextPage();
  }

  const filepath = path.resolve(__dirname, "./전문대_2021_정시_전체.json");
  await saveFile(filepath, JSON.stringify(json));

  await browser.close();
}

scrape();