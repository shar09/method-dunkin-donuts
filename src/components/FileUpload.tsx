import { useEffect, useState } from 'react';
import { readUrl, createCorporateEntity, createSourceAccounts, createIndividualEntities } from '../lib/utils';

export function FileUpload () {
    useEffect(() => {
        (async () => {
            await readUrl();
            await createCorporateEntity();
            await createSourceAccounts();
            await createIndividualEntities();
          })();
    }, [])
    
    return (
        <div>
            DUNKIN DONUTS
        </div>
    )
}