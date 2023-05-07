import { nextTick } from "process";
import api from "./api";
import convert from "xml-js";

let CORPORATION_ENTITY_ID: any;
export let PAYMENTS_JSON: any = {};
let FIRST_PAYMENT_JSON: any;
let SOURCE_ACCOUNTS_OBJECT: any;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function compareFn(a: any, b: any) {
  if (a["created_at"] > b["created_at"]) {
    return -1;
  }
  if (a["created_at"] < b["created_at"]) {
    return 1;
  }
  // a must be equal to b
  return 0;
}

export const readUrl = async () => {
  const url =
    "https://file.notion.so/f/s/8c08a999-4b9e-44b8-bc17-bbaf8c219101/dunkin.xml?id=377557b0-66f2-45d7-a159-b2381391bfa2&table=block&spaceId=d0d5787b-ff93-48d4-bb8d-bffd9edc42e4&expirationTimestamp=1683512957215&signature=pwcF1FDDEXqOgJUvvTa3PT3DyhM4LcZx7pfozASRfPI&downloadName=dunkin.xml";
  const res = await fetch(url);
  const xml = await res.text();
  const result = convert.xml2json(xml, { compact: true, spaces: 4 });
  // console.log(result);
  FIRST_PAYMENT_JSON = JSON.parse(result).root.row[0];
  // console.log(FIRST_PAYMENT_FROM_XML);
  // SLICE DATA FOR INITIAL TESTING
  PAYMENTS_JSON = JSON.parse(result).root.row.slice(0, 1200);

  return PAYMENTS_JSON;
};

export const createCorporateEntity = async () => {
  const existingEntities = await api.getEntities({
    type: "c_corporation",
    status: "active",
  });

  const getExistingCorporationID = () => {
    const allDunkinExistingEntities = existingEntities.data?.filter(
      (entity: any) =>
        entity.corporation.ein === FIRST_PAYMENT_JSON.Payor.EIN._text
    );

    // console.log("all existing dunkin entities: ", allDunkinExistingEntities);

    const sortAllDunkinExistingEntities =
      allDunkinExistingEntities.sort(compareFn);

    // console.log("sorted dunkin entities: ", sortAllDunkinExistingEntities);

    const latestDunkinEntity: any = sortAllDunkinExistingEntities?.filter(
      (element: any, index: number, array: any[]) =>
        array.findIndex(
          (obj) => obj.corporation.name === element.corporation.name
        ) === index
    );

    console.log("latest dunkin entity: ", latestDunkinEntity);

    return latestDunkinEntity[0]?.id;
  };

  // Create Corporate Entity for Dunkins if not already existing
  if (!getExistingCorporationID()) {
    const response = await api.createEntity({
      type: "c_corporation",
      corporation: {
        name: "Dunkin' Donuts LLC",
        dba: "Dunkin' Donuts",
        ein: "32120240",
        owners: [],
      },
      address: {
        line1: "999 Hayes Lights",
        line2: null,
        city: "Kerlukemouth",
        state: "IA",
        zip: "50613", // Note: Using real Iowa state zip code isntead of zip code from xml file
      },
    });

    console.log("response: ", response);

    // Wait for entity to be created
    await sleep(5000);
  }

  CORPORATION_ENTITY_ID = getExistingCorporationID();
};

// Create source payment accounts
export const createSourceAccounts = async () => {
  const allExistingSourceAccounts = await api.getAccounts({
    type: "ach",
    status: "active",
  });

  const sortAllExistingSourceAccounts =
    allExistingSourceAccounts.data?.sort(compareFn);

  const uniqueSourceAccounts = sortAllExistingSourceAccounts?.filter(
    (element: any, index: number, array: any[]) =>
      array.findIndex((obj) => obj.ach.number === element.ach.number) === index
  );

  const groupPaymentBySource: any[] = Object.values(
    PAYMENTS_JSON.reduce((acc: any, item: any) => {
      acc[item.Payor.DunkinId._text] = [
        ...(acc[item.Payor.DunkinId._text] || []),
        item,
      ];
      return acc;
    }, {})
  );

  // console.log("grouped by source: ", groupPaymentBySource);

  const allSourceAccountsInPaymentsJson = [];
  for (let paymentsArray of groupPaymentBySource) {
    allSourceAccountsInPaymentsJson.push(paymentsArray[0]);
  }

  // console.log("allsource: ", allSourceAccountsInPaymentsJson);
  // console.log("existings source: ", uniqueSourceAccounts);

  for (let account of allSourceAccountsInPaymentsJson) {
    const existingSourceAccount = uniqueSourceAccounts.find(
      (existingAccount: any) =>
        existingAccount.ach.number === account.Payor.AccountNumber._text &&
        existingAccount.holder_id === CORPORATION_ENTITY_ID
    );

    // console.log("existing source: ", existingSourceAccount);
    // Create Source Account if not already existing
    if (!existingSourceAccount) {
      const response = await api.createAccount({
        holder_id: CORPORATION_ENTITY_ID,
        ach: {
          routing: account.Payor.ABARouting._text,
          number: account.Payor.AccountNumber._text,
          type: "checking",
        },
      });

      await sleep(5000);

      SOURCE_ACCOUNTS_OBJECT = {
        ...SOURCE_ACCOUNTS_OBJECT,
        [response.data.data.ach.number]: response.data.data.id,
      };
    } else {
      SOURCE_ACCOUNTS_OBJECT = {
        ...SOURCE_ACCOUNTS_OBJECT,
        [existingSourceAccount.ach.number]: existingSourceAccount.id,
      };
    }
  }
  // console.log("source accounts object: ", SOURCE_ACCOUNTS_OBJECT);
};

// Create Individual Entities - Hardcode phone number
export const createIndividualEntities = async () => {
  const groupByEmployee = () => {
    const groupedResults = Object.values(
      PAYMENTS_JSON.reduce((acc: any, item: any) => {
        acc[item.Employee.DunkinId._text] = [
          ...(acc[item.Employee.DunkinId._text] || []),
          item,
        ];
        return acc;
      }, {})
    );
    return groupedResults;
  };
  const grouped: any[] = groupByEmployee();
  console.log(grouped);

  // Create Individual Entities if not existing
  // - Get all existing entities
  // - Sort the entities using first name
  // - Loop through grouped array, get first elements first name and last name
  // - Binary search on the existing entities and find the object using first and last name params
  // - If object is already existing - Do not create entity
  // - Otherwise create a new individual entity
};

// Create Destination payment accounts

// Initiate payments
