import fs from 'fs';
import {parse} from 'json2csv';

export const saveFile = (filePath: string, data: string) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, data, (err) => {
      if (err) reject(err);
      resolve(`saved ${filePath}.`);
    })
  })
};

export const readFile = (filepath: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, buffer) => {
      if (err) reject(err);
      resolve(buffer);
    })
  })
}

export const convert2Csv = (json: Object[]): string | void => {
  const fields = Object.keys(json[0]);
  const opts = {fields}
  try {
    const csv = parse(json, opts);
    return csv;
  } catch (e) {
    console.log(e);
  }
}