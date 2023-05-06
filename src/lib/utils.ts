import api from "./api";
import convert from "xml-js";

let FIRST_PAYMENT_FROM_XML: any;

export const readUrl = async () => {
  const url =
    "https://file.notion.so/f/s/8c08a999-4b9e-44b8-bc17-bbaf8c219101/dunkin.xml?id=377557b0-66f2-45d7-a159-b2381391bfa2&table=block&spaceId=d0d5787b-ff93-48d4-bb8d-bffd9edc42e4&expirationTimestamp=1683421747391&signature=yLW2hHpLywlbocDo20o9YxDgRxsB918PYO0mUZKOWME&downloadName=dunkin.xml";
  const res = await fetch(url);
  const xml = await res.text();
  const result = convert.xml2json(xml, { compact: true, spaces: 4 });
  // console.log(result);
  FIRST_PAYMENT_FROM_XML = JSON.parse(result).root.row[0];
  console.log(FIRST_PAYMENT_FROM_XML);
  return JSON.parse(result);
};

export const createCorporateEntity = async () => {
  const existingEntities = await api.getEntities({
    type: "c_corporation",
    status: "active",
  });

  console.log("ee: ", existingEntities);

  // Create Corporate Entity for Dunkins if not already existing
  if (
    !existingEntities.data.find(
      (entity: any) =>
        entity.corporation.ein === FIRST_PAYMENT_FROM_XML.Payor.EIN._text
    )
  ) {
    await api.createEntity({
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
  }
};

// Create source payment accounts

// Create Individual Entities

// Create Destination payment accounts

// Initiate payments
