import { useEffect, useState } from 'react';
import convert from 'xml-js';

export function FileUpload () {
    const readUrl = async () => {
        const url = 'https://file.notion.so/f/s/8c08a999-4b9e-44b8-bc17-bbaf8c219101/dunkin.xml?id=377557b0-66f2-45d7-a159-b2381391bfa2&table=block&spaceId=d0d5787b-ff93-48d4-bb8d-bffd9edc42e4&expirationTimestamp=1683320159541&signature=M6sQWD_enEmfbdjt3j_SRsFoZsHSNvNW7VjeA4z9daI&downloadName=dunkin.xml';
        const res = await fetch(url);
        const xml = await res.text();
        const result1 = convert.xml2json(xml, {compact: true, spaces: 4});
        // console.log(result1);
        // console.log(xml);
        return xml;
    }

    useEffect(() => {
        (async () => {
            const data = await readUrl();
            
            // const dataWithoutRoot = data.slice(data.indexOf('<root>') + 6, data.lastIndexOf('</row>') + 6);
            // const arrayData = dataWithoutRoot.split(/(?<=<\/row>)/);
            // console.log(arrayData[arrayData.length - 1]);
            // if(arrayData[arrayData.length - 1].trim() === '') arrayData.pop();
            // setXmlData(arrayData);
            // console.log(arrayData.length);
            
            
            const dataWithoutRoot = data.slice(data.indexOf('<root>') + 6, data.lastIndexOf('</row>') + 6);
            const dataToArray = dataWithoutRoot.split(/(?<=<\/row>)/);
            console.log(dataToArray.slice(0, 3).join(''));

            const smallXml = `<root>${dataToArray.slice(0, 3).join('')}</root>`;
            const result1 = convert.xml2json(smallXml, {compact: true, spaces: 4});
            console.log(result1);


            console.log(dataToArray.length);
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