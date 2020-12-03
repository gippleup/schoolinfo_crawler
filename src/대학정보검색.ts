import puppeteer from 'puppeteer';
import { saveFile } from './utils';
import path from 'path';
import { buildUtil } from './대학정보검색/utils';

const scrape = async() => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1080,
      height: 800,
    }
  });
  const page = await browser.newPage();
  await page.goto("http://www.adiga.kr/PageLinkAll.do?link=/kcue/ast/eip/eis/inf/univinf/eipUinfGnrl.do&p_menu_id=PG-EIP-01701");
  const utils = buildUtil(page);
  const {
    checkArea,
    clickSearchButton,
    // closeFilterBox,
    getDataForUniversity,
    getMetaForUniversity,
    getUncrawledResult,
    openFilterBox,
    // goToNextPage,
    goToPage,
    // selectYear,
    waitResults,
    addToNeedToCheckList,
  } = utils;

  // const targetYear = "2020";
  const targetArea = "전체";
  await openFilterBox();
  // await selectYear(targetYear);
  await checkArea(targetArea);
  await clickSearchButton();

  const json: {
    university: string | null;
    area: string | null;
    data: null | any[];
  }[] = [];
  const checker: {[index: string]: boolean} = {};
  let curpage = 1;
  let hasThingTodo = true;
  while (hasThingTodo) {
    await goToPage(curpage, checker);
    const targetUniversity = await getUncrawledResult(checker);
    if (targetUniversity === undefined) {
      curpage += 1;
      if (curpage < 16) {
        try {
          await saveFile(path.resolve(__dirname, `./some/메타_${curpage - 1}.json`), JSON.stringify(json));
          await goToPage(curpage, checker);
        } catch (e) {
          console.log(e)
        }
      } else {
        console.log("다 왔는데...")
        await saveFile(path.resolve(__dirname, `./some/메타.json`), JSON.stringify(json))
        hasThingTodo = false;
      }
    } else {
      checker[targetUniversity.id] = true;
      const meta = await getMetaForUniversity(targetUniversity.handler);
      console.log(`crawling ${meta.name}`)
      try {
        const data = await getDataForUniversity(targetUniversity.handler);
        if (meta.name) {
          if (!data) {
            // await addToNeedToCheckList(meta.name)
          } else {
            const {name, area} = meta;
            const result = {
              university: name,
              area,
              data,
            };
            json.push(result);
          }
        }
        await page.goBack();
        console.log(`successfully crawled ${meta.name}`)
        await waitResults();
      } catch (e) {
        console.log(e);
        if (meta.name) await addToNeedToCheckList(meta.name)
        await page.goBack();
        await waitResults();
      }
    }

  }

  await saveFile(path.resolve(__dirname, `./some/메타.json`), JSON.stringify(json))
  await browser.close();
}

scrape();
