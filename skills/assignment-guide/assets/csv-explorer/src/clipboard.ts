// Quote tabs, newlines and quotes so each field remains intact when pasted.
export function rowClipboardText(headers:string[],number:number,values:string[]):string {
 const field=(value:string)=>/[\t\r\n"]/.test(value)?`"${value.replaceAll('"','""')}"`:value;
 return [['행 번호',...headers],[String(number),...values]].map(row=>row.map(field).join('\t')).join('\n');
}
