export const universityEnrollTypes = {
  "전체": 0,
  "수시": 1,
  "정시_가": 2,
  "정시_나": 3,
  "정시_다": 4,
  "추가": 5,
}

export const collegeEnrollTypes = {
  "전체": 0,
  "수시모집": 1,
  "정시모집": 2,
}

export type SchoolType = "전문대학" | "일반대학";
export type UniversityEnrollType = keyof typeof universityEnrollTypes;
export type CollegeEnrollType = keyof typeof collegeEnrollTypes;