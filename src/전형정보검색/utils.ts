import puppeteer from 'puppeteer';
import { 지역 } from '../대학정보검색/types';
import { CollegeEnrollType, collegeEnrollTypes, SchoolType, UniversityEnrollType, universityEnrollTypes } from './types';

const buildUtil = (page: puppeteer.Page) => {
  const selectUniversity = async(type: SchoolType) => {
    const $$radio = await page.$$(".top_uv_type input[type=radio]");
    const tasks = $$radio.map(async ($radio) => {
      const title = await $radio.evaluate((node) => node.getAttribute("title"));
      if (title === type) {
        await $radio.click();
      }
    })
    await Promise.all(tasks);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await waitForSearchTable();
  }
  
  const waitForSearchTable = async() => {
    await page.waitForSelector("div.search_tbl_box fieldset div");
    await page.waitForSelector("div.search_box_btn a");
  }

  const selectEnrollType: <T extends SchoolType>(schoolType: T, ...types: T extends "전문대학" ? CollegeEnrollType[] : UniversityEnrollType[]) => Promise<any> = async(schoolType: SchoolType, ...types) => {
    const indexObj = schoolType === "일반대학" ? universityEnrollTypes : collegeEnrollTypes;
    const detailedConditionTables = await page?.$$("div.search_tbl_box fieldset > div");
    const 학과상세테이블 = detailedConditionTables[0];
    await page.waitForSelector("div.search_tbl_box fieldset > div table tbody#tbSelctnDetail tr:nth-child(2) td:nth-child(2) input")
    const 학과상세세부테이블 = await 학과상세테이블.$$("table tbody#tbSelctnDetail > tr");
    const 모집시기선택버튼 = await 학과상세세부테이블[1].$$("input");
  
    if (schoolType === "전문대학") {
      const typedTypes = types as CollegeEnrollType[];
      const tasks = typedTypes.map((type => {
        const typedIndexObj = indexObj as typeof collegeEnrollTypes;
        const typedType = type as CollegeEnrollType;
        return 모집시기선택버튼[typedIndexObj[typedType]].click()
      }))
      return Promise.all(tasks);
    } else {
      const typedTypes = types as UniversityEnrollType[];
      const tasks = typedTypes.map((type => {
        const typedIndexObj = indexObj as typeof universityEnrollTypes;
        const typedType = type as UniversityEnrollType;
        return 모집시기선택버튼[typedIndexObj[typedType]].click()
      }))      
      return Promise.all(tasks);
    }
  }

  const waitForResults = async(count = 0) => {
    await page.waitForSelector("#tbSelctnInfList tr");
    const rows = await page.$$("#tbSelctnInfList tr")
    if (rows.length > 10) return true;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (count > 10) return reject(false);
        resolve(waitForResults(count += 1));
      }, 1000)
    })
  }

  
  const spreadDetailFilterTable = async (bool: boolean) => {
    const detailedConditionTables = await page?.$$("div.search_tbl_box fieldset > div");
    const 전형상세테이블 = detailedConditionTables[1];
    const 전형상세테이블접기버튼 = await 전형상세테이블.$("a[title=접기]");
    const 전형상세테이블펼치기버튼 = await 전형상세테이블.$("a[title=펼치기]");
    if (bool) {
      return 전형상세테이블펼치기버튼?.click();
    } else {
      return 전형상세테이블접기버튼?.click();
    }
  }

  const selectArea = async(...types: (keyof typeof 지역)[]) => {
    await page.waitForSelector("#tbLwacstCn")
    const 전형상세테이블세부 = await page.$$("#tbSelctnDtlDetail tr");
    const 지역테이블 = 전형상세테이블세부[0];
    const 지역버튼 = await 지역테이블.$$("input");
    const tasks = types.map((type) => {
      const index = 지역[type];
      return 지역버튼[index].click();
    })
    return Promise.all(tasks);
  }

  const selectMinGradeRule = async(...types: ("수능" | "학생부" | "반영안함")[]) => {
    await page.waitForSelector("#tbLwacstCn")
    await spreadDetailFilterTable(true);
    await page.waitForSelector("#tbLwacstCn input")
    const 최저학력기준선택버튼 = await page.$$("#tbLwacstCn input");
    const index = {
      "수능": 0,
      "학생부": 1,
      "반영안함": 2,
    };
    const tasks = types.map((type) => 최저학력기준선택버튼[index[type]].click())
    return Promise.all(tasks);
  };

  const waitNextPage = async(prevPageFirstResultId: string, prevPage: string, trial: number) => {
    return new Promise(async (resolve, reject) => {
      await page.waitForSelector("#pagination li[class='num active']");
      const curPageLi = await page.$("#pagination li[class='num active']");
      const curPageNum = await curPageLi?.evaluate((node) => node.textContent);

      const curResults = await page.$$("#tbResult tr");
      const firstResult = await curResults[0].$$("td");
      const firstResultId = await firstResult[3].evaluate((node) => node.id);
  
      if (curPageNum !== prevPage && prevPageFirstResultId !== firstResultId) {
        resolve(curPageNum);
      } else if (trial > 50) {
        resolve(goToNextPage());
      } else {
        setTimeout(() => {
          console.log(curPageNum, prevPage);
          console.log("Waiting " + prevPage)
          resolve(waitNextPage(prevPageFirstResultId, prevPage, trial + 1))
        }, 1000);
      }
    })
  }

  const clickSearch = async() => {
    const searchButton = await page.$("div.search_box_btn a");
    await searchButton?.click();
    await waitForResults();
  }

  const goToNextPage = async() => {
    let hasNextPage = false;
    const curPageLi = await page.$("#pagination li[class='num active']");
    const curResults = await page.$$("#tbResult tr");
    const firstResult = await curResults[0].$$("td");
    const firstResultId = await firstResult[3].evaluate((node) => node.id);
    const curPageNum = await curPageLi?.evaluate((node) => node.textContent);
    const nextButton = await page.$("#pagination li[class='next'] a");
    const disabled = await page.$("#pagination li[class='next disabled']")
    if (disabled) {
      console.log("Finished scraping")
      hasNextPage = false;
      return hasNextPage;
    }

    hasNextPage = true;
    await nextButton?.click();
    console.log(curPageNum);

    if (curPageNum !== null && curPageNum !== undefined) {
      await waitNextPage(firstResultId, curPageNum, 0);
      return hasNextPage;
    } else {
      throw new Error("????")
    }
  }

  const scrapeSearchResult = async() => {
    let searchResult: Object[] = [];
    const rowDataIndex: {[index: number]: string} = {
      0: "대학",
      1: "모집시기",
      2: "학과",
      3: "전형명",
      4: "모집인원",
      5: "2020학년도 경쟁률",
    }

    const tableRows = await page.$$("#tbResult tr");
    const tasks = tableRows.map(async (tr) => {
      const result: {[index: string]: string} = {};
      const rowData = await tr.$$("td");
      const subTasks = rowData.map(async(td, i) => {
        if (i > 5) return;
        const dataTag = rowDataIndex[i];
        const value = await td.evaluate((node) => node.textContent) || "";
        result[dataTag] = value;
      })
      return new Promise(async (resolve, reject) => {
        await Promise.all(subTasks);
        searchResult.push(result);
        resolve(result);
      })
    })
    await Promise.all(tasks);
    return searchResult;
  }

  const selectYear = async(schoolType: SchoolType, year: "2020" | "2021") => {
    if (schoolType === "전문대학") return console.log("Not supported");
    const yearSelect = await page.$("#cur_year");
    return yearSelect?.select(year);
  }

  return {
    selectUniversity,
    waitForSearchTable,
    selectEnrollType,
    selectArea,
    selectMinGradeRule,
    scrapeSearchResult,
    clickSearch,
    goToNextPage,
    waitNextPage,
    selectYear,
  }
}

export default buildUtil;