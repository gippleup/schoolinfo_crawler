import puppeteer from 'puppeteer';
import { SupportedArea } from './types';
import path from 'path';
import { readFile, saveFile } from '../utils';

export const buildUtil = (page: puppeteer.Page) => {
  const closeFilterBox = async() => {
    const button = await page.$("#btn_box_fold a");
    return button?.click()
  }

  const openFilterBox = async() => {
    const button = await page.$("#btn_box_out a");    
    return button?.click()
  }

  const checkArea = async(...targetArea: SupportedArea[]) => {
    const filterRows = await page.$$("#tbDetail tr");
    const areaFilterButtons = await filterRows[0].$$("input[type='checkbox']");
    const tasks = areaFilterButtons.map(async (button) => {
      const id = await button.evaluate((node) => node.id);
      const label = await filterRows[0].$(`label[for=${id}]`);
      const tag = await label?.evaluate((node) => node.textContent) as SupportedArea;
      if (targetArea.indexOf(tag) === -1) return;
      await button.click();
    })
    return Promise.all(tasks);
  }

  const getUncrawledResult = async(checked: {[index: string]: boolean}): Promise<undefined | {id: string; handler: puppeteer.ElementHandle}> => {
    const resultRows = await page.$$("#tbResult tr");
    const tagRows = resultRows.map(async(row) => {
      const id = await getResultRowId(row);
      return {
        id,
        handler: row,
      }
    });
    const mappedRows = await Promise.all(tagRows);
    const filteredRows = mappedRows.filter((row) => checked[row.id] === undefined);
    const targetRow = filteredRows[0];
    if (targetRow === undefined) return undefined;
    return targetRow;
  }

  type GetMetaForUniversityReturnType = {
    name: string | null,
    area: string | null,
  }
  const getMetaForUniversity = async(universityRow: puppeteer.ElementHandle<HTMLTableRowElement>): Promise<GetMetaForUniversityReturnType> => {
    const $$td = await universityRow.$$("td");
    const name = await $$td[0].evaluate((node) => node.textContent);
    const area = await $$td[1].evaluate((node) => node.textContent);
    return {
      name,
      area,
    }
  }

  type UniversityData = {
    category: string | undefined;
    2020: string | undefined;
    2021: string | undefined;
  }
  type GetDataForUniversityReturnType = (void | UniversityData)[] | null;
  const getDataForUniversity = async(universityRow: puppeteer.ElementHandle<HTMLTableRowElement>): Promise<GetDataForUniversityReturnType> => {
    const $td = await universityRow.$$("td");
    const detailedInfoLink = await $td[0].$("a");
    //Go to detailed page
    await detailedInfoLink?.click();
    //Wait until detailed page loaded
    await page.waitForSelector("#mainFrm");
    await page.waitForSelector(".tab_st02_new li a");
    //Find target tab
    const $tabs = await page.$$(".tab_st02_new li");
    const mappedTabs = await Promise.all($tabs.map(async (tab) => {
      const text = await tab.evaluate((node) => node.textContent)
      return {
        text,
        handler: tab,
      }
    }));
    const targetTab = mappedTabs.filter((tab) => tab.text === "대입특징")[0];
    await targetTab.handler.click();
    //Wait table to be loaded
    await page.waitForSelector("#view_cn table tr td span", {timeout: 2000});
    const dataTable = await page.$("#view_cn table");
    if (!dataTable) {
      return null;
    }
    const tableRows = await dataTable?.$$("tr");
    if (!tableRows) return null;
    const results: UniversityData[] = [];
    const tasks = tableRows.map((tr) => async() => {
      const $$td = await tr?.$$("td");
      if (!$$td) return console.log("이럴리가 없지")
      const category = await $$td[0].evaluate((node) => node.textContent?.replace("\n", "").replace(/s/g, ""));
      if (!category?.match(/수\s+시/g) && !category?.match(/정\s+시/g)) return;
      const value2020 = await $$td[1].evaluate((node) => node.textContent?.replace("\n", ""));
      const value2021 = await $$td[3].evaluate((node) => node.textContent?.replace("\n", ""));
      results.push({
        category,
        "2020": value2020,
        "2021": value2021,
      })
    })
    for (let i = 0; i < tasks.length; i += 1) {
      await tasks[i]();
    }
    return results;
  }

  const clickSearchButton = async(): Promise<void> => {
    const $button = await page.$(".search_box_btn a[title='검색']");
    await $button?.click();
    await waitResults();
  }

  const waitResults = async(): Promise<void> => {
    const results = await page.$$("#tbResult tr");
    if (results.length > 1) return;
    return waitResults();
  }

  const getResultRowId = async(row: puppeteer.ElementHandle<HTMLTableRowElement>): Promise<string> => {
    const resultData = await row?.$$("td");
    if (!resultData) {
      console.log("음 이럴 일은 없지");
      return "-1";
    }
    const id = await resultData[0].evaluate((node) => node.textContent) || "-1";
    return id;    
  }

  const getFirstResultId = async(): Promise<string> => {
    const curPageFirstResult = await page.$("#tbResult tr");
    if (!curPageFirstResult) return "-1";
    return getResultRowId(curPageFirstResult);
  }

  const goToPage = async(target: number, checked: {[index: string]: boolean}): Promise<boolean> => {
    console.log("Navigating to " + target);
    await page.waitForSelector("#paginationholder li");
    const activeButton = await page.$("#paginationholder li[class='num active']");
    const activeButtonNum = await activeButton?.evaluate((node) => node.textContent);

    if (activeButtonNum === String(target)) return true;

    const $$button = await page.$$("#paginationholder li[class^='num']");
    // const firstResultId = await getFirstResultId();
    let foundTargetButton = false;
    for (let i = 0; i < $$button.length; i += 1) {
      if (!foundTargetButton) {
        const curButton = $$button[i];
        const buttonText = await curButton.evaluate((node) => node.textContent);
        const isTargetButton = buttonText === String(target);
        if (isTargetButton) {
          foundTargetButton = true;
          await curButton.click();
        }
      }
    }

    if (!foundTargetButton) {
      await $$button[$$button.length - 1].click();
      return goToPage(target, checked);
    }

    await waitAnythingToCrawl(checked, 0).catch((e) => console.log(e));
    return true;
  }

  const waitAnythingToCrawl = async(checker: {[index: string]: boolean}, count: number): Promise<void> => {
    console.log("waiting anything to crwal");
    count += 1;
    const anyThingToDo = await getUncrawledResult(checker);
    if (anyThingToDo) return;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (count < 5) {
          resolve(waitAnythingToCrawl(checker, count));
        } else {
          reject(false);
        }
      }, 1000)
    })
  }

  const goToNextPage = async(): Promise<boolean> => {
    await page.waitForSelector("#paginationholder");
    const $pagination = await page.$("#paginationholder");
    const nextButton = await $pagination?.$("li[class='next']");
    const isEnd = await $pagination?.$("li[class='next disabled']");
    const curPageNum = await $pagination?.$("li[class='num active']")
      .then((handler) => handler?.evaluate((node) => node.textContent));
    console.log(`Scraping ${curPageNum} page`);
    const firstResultId = await getFirstResultId();
    if (isEnd) return false;
    await nextButton?.click();
    await waitNextPage(firstResultId);
    return true;
  }

  const waitNextPage = async(prevFirstResultId: string): Promise<boolean> => {
    const firstResultId = await getFirstResultId();
    return new Promise((resolve, reject) => {
      if (firstResultId === prevFirstResultId) {
        setTimeout(() => {
          resolve(waitNextPage(prevFirstResultId));
        }, 1000)
      } else {
        resolve(true);
      }
    })
  }

  const selectYear = async(year: "2020" | "2021") => {
    const yearButton = await page.$("#sch_year");
    await yearButton?.select(year);
  }

  const addToNeedToCheckList = async(name: string): Promise<void> => {
    const filepath = path.resolve(__dirname, "./needToCheck.txt");
    const buffer = await readFile(filepath);
    const existingList = buffer.toString();
    const updated = existingList.concat("\n" + name);
    await saveFile(filepath, updated);
  }

  return {
    selectYear,
    openFilterBox,
    closeFilterBox,
    checkArea,
    getUncrawledResult,
    getDataForUniversity,
    getMetaForUniversity,
    clickSearchButton,
    goToNextPage,
    waitResults,
    addToNeedToCheckList,
    goToPage,
  }
}
