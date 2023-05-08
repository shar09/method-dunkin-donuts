import api from "./api";
import convert from "xml-js";
import {
  TokenBucketRateLimiter,
  fetchAndRetryIfNecessary,
} from "./api-throttling";

const tokenBucket = new TokenBucketRateLimiter({
  maxRequests: 600,
  maxRequestWindowMS: 60000,
});

let CORPORATION_ENTITY_ID: any;
export let PAYMENTS_JSON: any = {};
let FIRST_PAYMENT_JSON: any;
let SOURCE_ACCOUNTS_OBJECT: any;
let EXISTING_INDIVIDUAL_ENTITIES_OBJECT: any = {};
let EXISTING_LIABILITY_ACCOUNTS_OBJECT: any = {};

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// mm-dd-yyyy to yyyy-mm-dd
function formatDate(date: string) {
  let dateArray: any = date.split("-").reverse();
  const tmp = dateArray[2];
  dateArray[2] = dateArray[1];
  dateArray[1] = tmp;
  dateArray = dateArray.join("-");
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
    "https://file.notion.so/f/s/8c08a999-4b9e-44b8-bc17-bbaf8c219101/dunkin.xml?id=377557b0-66f2-45d7-a159-b2381391bfa2&table=block&spaceId=d0d5787b-ff93-48d4-bb8d-bffd9edc42e4&expirationTimestamp=1683606673925&signature=wxWPW6ruqoP3NFqmv45xGJqtgZ1XCDO3eOWv27_c_Bk&downloadName=dunkin.xml";
  const res = await fetch(url);
  const xml = await res.text();
  const result = convert.xml2json(xml, { compact: true, spaces: 4 });
  // console.log(result);
  FIRST_PAYMENT_JSON = JSON.parse(result).root.row[0];
  // console.log(FIRST_PAYMENT_FROM_XML);
  // SLICE DATA FOR INITIAL TESTING
  PAYMENTS_JSON = JSON.parse(result).root.row.slice(0, 50);

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

    // console.log("latest dunkin entity: ", latestDunkinEntity);

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
        [response.data.ach.number]: response.data.id,
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
  const groupByEmployee: any = Object.values(
    PAYMENTS_JSON.reduce((acc: any, item: any) => {
      acc[item.Employee.DunkinId._text] = [
        ...(acc[item.Employee.DunkinId._text] || []),
        item,
      ];
      return acc;
    }, {})
  );

  console.log("group by employee: ", groupByEmployee);

  // Create Individual Entities if not existing
  // - Get all existing indiviual entities - no duplicates
  const existingEntities = await api.getEntities({
    type: "individual",
    status: "active",
  });

  // existingEntities.data is an array [{},{},{},] - 1000 objs
  // Convert to hashmap with key firstname-lastname-dob {} - 1000 keys

  if (existingEntities.data.length > 0) {
    for (let entity of existingEntities.data) {
      // TODO: Using simple check if entity has valid capabilities. Update to proper check.
      if (entity.capabilities.length > 2) {
        EXISTING_INDIVIDUAL_ENTITIES_OBJECT[
          `${entity.individual.first_name}-${entity.individual.last_name}`
        ] = entity.id;
      }
    }
  }

  console.log(
    Object.keys(EXISTING_INDIVIDUAL_ENTITIES_OBJECT).length,
    ":",
    groupByEmployee.length
  );

  const createEntityPromises = [];

  console.log("existing entities: ", EXISTING_INDIVIDUAL_ENTITIES_OBJECT);
  // Sleep 1 min before making api calls for creating individual entities
  // await sleep(60000);
  for (let paymentsArray of groupByEmployee) {
    // Check if employee is already in existing entities
    if (
      !EXISTING_INDIVIDUAL_ENTITIES_OBJECT[
        `${paymentsArray[0].Employee.FirstName._text}-${paymentsArray[0].Employee.LastName._text}`
      ]
    ) {
      console.log(
        `${paymentsArray[0].Employee.FirstName._text}-${paymentsArray[0].Employee.LastName._text}`
      );
      createEntityPromises.push({
        type: "individual",
        individual: {
          first_name: paymentsArray[0].Employee.FirstName._text,
          last_name: paymentsArray[0].Employee.LastName._text,
          phone: "15121231111",
          dob: formatDate(paymentsArray[0].Employee.DOB._text),
        },
      });
    }
  }

  const promises = createEntityPromises.map((item) =>
    fetchAndRetryIfNecessary(() =>
      tokenBucket.acquireToken(() => api.createEntity(item))
    )
  );
  const responses = await Promise.all(promises);
  console.log("entity responses: ", responses);
  for (const response of responses) {
    EXISTING_INDIVIDUAL_ENTITIES_OBJECT[
      `${response.data.individual.first_name}-${response.data.individual.last_name}`
    ] = response.data.id;
  }
};

// Create Destination payment accounts
export const liabilityAccounts = async () => {
  const popularMerchants = await fetchAndRetryIfNecessary(() =>
    tokenBucket.acquireToken(() => api.getMerchants({}))
  );

  console.log("popularMerchants: ", popularMerchants);

  const studentLoanMerchantsObjectByPlaidId: any = {};
  for (const merchant of popularMerchants.data) {
    // Add to object if student loan
    if (merchant.types.includes("student_loan")) {
      const plaidIdArray = merchant.provider_ids.plaid;
      for (const plaidId of plaidIdArray) {
        studentLoanMerchantsObjectByPlaidId[plaidId] = merchant.mch_id;
      }
    }
  }

  console.log(studentLoanMerchantsObjectByPlaidId);

  const allExistingLiabilityAccounts = await fetchAndRetryIfNecessary(() =>
    tokenBucket.acquireToken(() =>
      api.getAccounts({
        type: "liability",
        status: "active",
      })
    )
  );

  //holderid-mch_id: liability.id
  for (const account of allExistingLiabilityAccounts.data) {
    EXISTING_LIABILITY_ACCOUNTS_OBJECT[
      `${account.holder_id}-${account.liability.mch_id}`
    ] = account.id;
  }

  const createLiablityPromises = [];

  // Loop through payments_json and create liability if not existing already
  for (const payment of PAYMENTS_JSON) {
    let merchantId =
      studentLoanMerchantsObjectByPlaidId[payment.Payee.PlaidId._text];
    if (!merchantId) {
      const merchant = await fetchAndRetryIfNecessary(() =>
        tokenBucket.acquireToken(() =>
          api.getMerchants({
            "provider_id.plaid": payment.Payee.PlaidId._text,
          })
        )
      );

      const studentLoanMerchant = merchant.data.find((item: any) =>
        item.types.includes("student_loan")
      );
      // console.log("slm: ", studentLoanMerchant);
      // console.log("full merchant: ", studentLoanMerchant);
      merchantId = studentLoanMerchant?.mch_id;
    }
    const entityId =
      EXISTING_INDIVIDUAL_ENTITIES_OBJECT[
        `${payment.Employee.FirstName._text}-${payment.Employee.LastName._text}`
      ];

    // If liability not already existing and merchant id is valid
    if (
      merchantId &&
      !EXISTING_LIABILITY_ACCOUNTS_OBJECT[`${entityId}-${merchantId}`]
    ) {
      console.log(merchantId, "::::", payment.Payee.PlaidId._text);
      createLiablityPromises.push({
        holder_id: entityId,
        liability: {
          mch_id: merchantId,
          account_number: payment.Payee.LoanAccountNumber._text,
        },
      });
    }
  }

  const promises = createLiablityPromises.map((item) =>
    fetchAndRetryIfNecessary(() =>
      tokenBucket.acquireToken(() => api.createAccount(item))
    )
  );
  const responses = await Promise.all(promises);
  console.log("liability account responses: ", responses);
  for (const response of responses) {
    EXISTING_LIABILITY_ACCOUNTS_OBJECT[
      `${response.data.holder_id}-${response.data.liability.mch_id}`
    ] = response.data.id;
  }

  console.log(
    "full liability accounts object: ",
    EXISTING_LIABILITY_ACCOUNTS_OBJECT
  );
};

// Initiate payments
