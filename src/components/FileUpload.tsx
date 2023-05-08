import { useEffect, useState } from 'react';
import { readUrl, createCorporateEntity, createSourceAccounts, createIndividualEntities, liabilityAccounts } from '../lib/utils';

import api from "../lib/api";

export function FileUpload () {
    // const ping600 = Array(601).fill(api.getEntities({
    //     type: "c_corporation",
    //     status: "active",
    //   }));

    useEffect(() => {
        (async () => {
            await readUrl();
            await createCorporateEntity();
            await createSourceAccounts();
            await createIndividualEntities();
            await liabilityAccounts();
          })();
    }, [])
    
    return (
        <div>
            DUNKIN DONUTS
        </div>
    )
}