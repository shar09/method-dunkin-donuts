import { useEffect, useState } from 'react';
import { readUrl, createCorporateEntity } from '../lib/utils';

export function FileUpload () {
    useEffect(() => {
        (async () => {
            const data = await readUrl();
            // SLICE DATA FOR INITIAL TESTING
            const slicedData = data.root.row.slice(0, 1200);
            
            const groupByEmployee = () => {
                const groupedResults = Object.values(
                    slicedData.reduce((acc: any, item: any) => {
                        acc[item.Employee.DunkinId._text] = [...(acc[item.Employee.DunkinId._text] || []), item];
                        return acc;
                    },{})
                );
                return groupedResults;
            }
            const grouped: any[] = groupByEmployee();
            console.log(grouped);

            await createCorporateEntity();

          })();
    }, [])
    
    return (
        <div>
            DUNKIN DONUTS
        </div>
    )
}