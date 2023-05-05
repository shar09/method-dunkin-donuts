import { useEffect, useState } from 'react';
import convert from 'xml-js';

export function FileUpload () {
    const readUrl = async () => {
        const url = 'https://file.notion.so/f/s/8c08a999-4b9e-44b8-bc17-bbaf8c219101/dunkin.xml?id=377557b0-66f2-45d7-a159-b2381391bfa2&table=block&spaceId=d0d5787b-ff93-48d4-bb8d-bffd9edc42e4&expirationTimestamp=1683320159541&signature=M6sQWD_enEmfbdjt3j_SRsFoZsHSNvNW7VjeA4z9daI&downloadName=dunkin.xml';
        const res = await fetch(url);
        const xml = await res.text();
        const result1 = convert.xml2json(xml, {compact: true, spaces: 4});
        // console.log(result1);
        return JSON.parse(result1);
    }

    useEffect(() => {
        (async () => {
            const data = await readUrl();
            // const groupBySourceAccount = data.root.row.reduce((accumulator, currentValue) => accumulator + currentValue,
            // []);
            const groupBySource = () => {
                const groupedResults = Object.values(
                    data.root.row.reduce((acc: any, item: any) => {
                        acc[item.Payor.AccountNumber._text] = [...(acc[item.Payor.AccountNumber._text] || []), item];
                        return acc;
                    },{})
                );
                return groupedResults;
            }
            const grouped: any[] = groupBySource();

            let res: any[] = [];
            for(let element of grouped) {
                res = res.concat(element.filter((item: any) => {
                    return item.Employee.DunkinId._text === 'EMP-c8d91f03-594f-43cf-972a-7db7fac8124a'
                }));
            }

            console.log(res);

          })();
    }, [])
    
    const [xmlData, setXmlData] = useState<string[]>(['']);

    return (
        <div>
            {xmlData.map((data: string) => (
                <p>{data}</p>
            ))}
        </div>
    )
}