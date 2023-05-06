import { useEffect, useState } from 'react';
import convert from 'xml-js';
import api from '../lib/api';

export function FileUpload () {
    const readUrl = async () => {
        const url = 'https://file.notion.so/f/s/8c08a999-4b9e-44b8-bc17-bbaf8c219101/dunkin.xml?id=377557b0-66f2-45d7-a159-b2381391bfa2&table=block&spaceId=d0d5787b-ff93-48d4-bb8d-bffd9edc42e4&expirationTimestamp=1683421747391&signature=yLW2hHpLywlbocDo20o9YxDgRxsB918PYO0mUZKOWME&downloadName=dunkin.xml';
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
                        acc[item.Employee.DunkinId._text] = [...(acc[item.Employee.DunkinId._text] || []), item];
                        return acc;
                    },{})
                );
                return groupedResults;
            }
            const grouped: any[] = groupBySource();
            // console.log(grouped);

            const entities = await api.getEntities({});
            console.log(entities);

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