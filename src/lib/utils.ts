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
let PAYMENTS_JSON: any = {};
let SOURCE_ACCOUNTS_OBJECT: any;
let EXISTING_INDIVIDUAL_ENTITIES_OBJECT: any = {};
let EXISTING_LIABILITY_ACCOUNTS_OBJECT: any = {};

// Convert date from mm-dd-yyyy to yyyy-mm-dd
function formatDate(date: string) {
  let dateArray: any = date.split("-").reverse();
  const temp = dateArray[2];
  dateArray[2] = dateArray[1];
  dateArray[1] = temp;
  dateArray = dateArray.join("-");
}

// Sort by latest created date
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

/* Returns Payments from XML file in JSON format */
export const readXmlAndConvertToJson = async (xmlFileUrl: string) => {
  const url = xmlFileUrl;
  const res = await fetch(url);
  const xml = await res.text();
  const result = convert.xml2json(xml, { compact: true, spaces: 4 });

  // SLICE DATA FOR INITIAL TESTING
  return JSON.parse(result).root.row.slice(0, 50);
};

/* Returns Corporation Entity ID */
export const createCorporationEntity = async (firstPaymentJson: any) => {
  const existingEntities = await fetchAndRetryIfNecessary(() =>
    tokenBucket.acquireToken(() =>
      api.getEntities({
        type: "c_corporation",
        status: "active",
      })
    )
  );

  const getExistingCorporationID = () => {
    // All Dunkin corporation entities
    const allDunkinExistingEntities = existingEntities.data?.filter(
      (entity: any) =>
        entity.corporation.ein === firstPaymentJson.Payor.EIN._text
    );

    // Sort Dunkin corporation entites in latest created order
    const sortAllDunkinExistingEntities =
      allDunkinExistingEntities.sort(compareFn);

    // Get latest created Dunkin corporation entity
    const latestDunkinEntity: any = sortAllDunkinExistingEntities?.filter(
      (elementI: any, index: number, array: any[]) =>
        array.findIndex(
          (elementJ) => elementJ.corporation.name === elementI.corporation.name
        ) === index
    );

    return latestDunkinEntity[0]?.id;
  };

  const corporationEntityId = getExistingCorporationID();

  // Create Corporation Entity for Dunkins if not already existing
  if (!corporationEntityId) {
    const response = await fetchAndRetryIfNecessary(() =>
      tokenBucket.acquireToken(() =>
        api.createEntity({
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
        })
      )
    );
    return response.data.id; // corporation entity id
  } else {
    return corporationEntityId;
  }
};

/* Returns an object of source payment accounts with key: value format source_account_number: source_account_id */
export const createSourceAccounts = async (
  paymentsJson: any[],
  corporationEntityID: string
) => {
  const allSourceAccountsInPaymentsJson = [];
  let sourceAccountsObject = {};

  const allExistingSourceAccounts = await fetchAndRetryIfNecessary(() =>
    tokenBucket.acquireToken(() =>
      api.getAccounts({
        type: "ach",
        status: "active",
      })
    )
  );

  // Sort existing source accounts in latest created order
  const sortAllExistingSourceAccounts =
    allExistingSourceAccounts.data?.sort(compareFn);

  // Get latest unique source accounts
  const uniqueSourceAccounts = sortAllExistingSourceAccounts?.filter(
    (elementI: any, index: number, array: any[]) =>
      array.findIndex(
        (elementJ) => elementJ.ach.number === elementI.ach.number
      ) === index
  );

  // Group payments from same source account into single array
  const groupPaymentsBySource: any[] = Object.values(
    paymentsJson.reduce((acc: any, item: any) => {
      acc[item.Payor.DunkinId._text] = [
        ...(acc[item.Payor.DunkinId._text] || []),
        item,
      ];
      return acc;
    }, {})
  );

  for (let paymentsArray of groupPaymentsBySource) {
    allSourceAccountsInPaymentsJson.push(paymentsArray[0]);
  }

  for (let account of allSourceAccountsInPaymentsJson) {
    // Find source account from payments_json is in existing source accounts (i.e. already created) AND verify if corporation entity id is matching
    const existingSourceAccount = uniqueSourceAccounts.find(
      (existingAccount: any) =>
        existingAccount.ach.number === account.Payor.AccountNumber._text &&
        existingAccount.holder_id === corporationEntityID
    );

    // Create Source Account if not already existing
    if (!existingSourceAccount) {
      const response = await fetchAndRetryIfNecessary(() =>
        tokenBucket.acquireToken(() =>
          api.createAccount({
            holder_id: corporationEntityID,
            ach: {
              routing: account.Payor.ABARouting._text,
              number: account.Payor.AccountNumber._text,
              type: "checking",
            },
          })
        )
      );

      sourceAccountsObject = {
        ...sourceAccountsObject,
        [response.data.ach.number]: response.data.id,
      };
    } else {
      sourceAccountsObject = {
        ...sourceAccountsObject,
        [existingSourceAccount.ach.number]: existingSourceAccount.id,
      };
    }
  }
  return sourceAccountsObject;
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
