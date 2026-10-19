export const requiredHeaders:string[];
export function canonicalHeader(value:unknown):string;
export function parseExcelMatrix(matrix:any[][]):{rows:Record<string,any>[];columns:string[];headerRow:number;sourceRows:number[];issues:string[]};
