import path from 'path';
import fs from 'fs';
import { convert2Csv, readFile, saveFile } from './utils';

const getFileNames = async(): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    fs.readdir(path.resolve(__dirname, "./raw"), (err, files) => {
      if (err) reject(err);
      resolve(files);
    })
  })
}

const getFiles = async() => {
  const filenames = await getFileNames();
  const tasks = filenames.map((file) => readFile(path.resolve(__dirname, `./raw/${file}`)));
  const buffers = await Promise.all(tasks);
  const jsons = buffers.map((buffer) => JSON.parse(buffer.toString()));
  return jsons
}

const flattenArray = (target: any) => {
  if (typeof target !== "object") return target;
  if (!Array.isArray(target)) return target;
  let flattened: any[] = [];
  target.forEach((child) => {
    if (!Array.isArray(child)) {
      flattened = flattened.concat(child);
    } else {
      const flattenedChild = flattenArray(child);
      flattened = flattened.concat(flattenedChild);
    }
  })
  return flattened;
}

const flattenFiles = async() => {
  const filenames = await getFileNames();
  for (let i = 0; i < filenames.length; i += 1) {
    const file = filenames[i];
    console.log(file);
    const filepath = path.resolve(__dirname, `./raw/${file}`);
    const buffer = await readFile(filepath);
    const json = JSON.parse(buffer.toString());
    const flat = flattenArray(json);
    await saveFile(filepath, JSON.stringify(flat));
  }
}

type RawData = {
  "대학": string,
  "모집시기": string,
  "학과": string,
  "전형명": string,
  "모집인원": string,
  "2020학년도 경쟁률": string,
}

type MappedData = {
  area: string;
  purename: string;
  count: string;
  method: string;
  major: string;
  tag: string;
  enrollType: string;
  year: string;
  schoolType: string;
}
const mapFiles = async() => {
  let whole: MappedData[] = [];
  const filenames = await getFileNames();
  for (let i = 0; i < filenames.length; i += 1) {
    const file = filenames[i];
    const [schoolType, year, enrollType, tag] = file.replace(".json", "").split("_");
    const originFilepath = path.resolve(__dirname, `./raw/${file}`);
    const buffer = await readFile(originFilepath);
    const json = JSON.parse(buffer.toString()) as RawData[];
    const mapped = json.map((ele) => {
      const {대학: school, 모집시기, 모집인원: count, 전형명: method, 학과: major} = ele;
      const purename = school?.replace(/\[\W+\]/g, "");
      const parenthesis = school?.match(/\[\W+\]/g)?.pop();
      const tags = parenthesis?.replace(/\]\[/g, ",")?.replace(/[\[\]]/g, "")?.split(",");
      const area = tags ? tags[tags.length - 1] : "unknown";
      return {
        area,
        purename,
        count,
        method,
        major,
        tag,
        enrollType,
        year,
        schoolType,
      }
    });
    whole = whole.concat(mapped);
    const targetfilepath = path.resolve(__dirname, `./mapped/maped_${file}`);
    await saveFile(targetfilepath, JSON.stringify(mapped));
  }
  const wholefilepath = path.resolve(__dirname, `./mapped/whole.json`);
  await saveFile(wholefilepath, JSON.stringify(whole));
}

const concatData = async() => {
  await flattenFiles();
  await mapFiles();
}


readFile(path.resolve(__dirname, "./mapped/whole.json"))
.then((buffer) => buffer.toString())
.then((string) => JSON.parse(string))
.then((json) => convert2Csv(json))
.then((csv) => {
  if (csv) {
    saveFile(path.resolve(__dirname, "./mapped/whole.csv"), csv)
  }
})