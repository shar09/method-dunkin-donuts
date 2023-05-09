import api from "./api";
import convert from "xml-js";
import {
  TokenBucketRateLimiter,
  fetchAndRetryIfNecessary,
} from "./api-throttling";

let Student_Loan_Merchants_Object_By_PlaidId: any;

const tokenBucket = new TokenBucketRateLimiter({
  maxRequests: 600,
  maxRequestWindowMS: 60000,
});

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
  return JSON.parse(result).root.row.slice(0, 2000);
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

/* Returns an object of existing source payment accounts with key: value format source_account_number: source_account_id */
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
    paymentsJson.reduce((accumulator: any, item: any) => {
      accumulator[item.Payor.DunkinId._text] = [
        ...(accumulator[item.Payor.DunkinId._text] || []),
        item,
      ];
      return accumulator;
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

/* Returns an object of existing individual entities with key: value format first_name-last_name: entity_id */
export const createIndividualEntities = async (paymentsJson: any) => {
  const existingIndividualEntitiesObject: any = {};
  const createEntityPromises = [];

  // Group all payments of an employee into single array
  const groupByEmployee: any = Object.values(
    paymentsJson.reduce((accumulator: any, item: any) => {
      accumulator[item.Employee.DunkinId._text] = [
        ...(accumulator[item.Employee.DunkinId._text] || []),
        item,
      ];
      return accumulator;
    }, {})
  );

  // Create Individual Entities if not existing
  // Get all existing indiviual entities - Assuming there are no duplicates
  const existingEntities = await api.getEntities({
    type: "individual",
    status: "active",
  });

  if (existingEntities.data.length > 0) {
    for (let entity of existingEntities.data) {
      // TODO: Using simple check if entity has valid capabilities. Update to proper check in the future.
      if (entity.capabilities.length > 2) {
        existingIndividualEntitiesObject[
          `${entity.individual.first_name}-${entity.individual.last_name}`
        ] = entity.id;
      }
    }
  }

  for (let paymentsArray of groupByEmployee) {
    // Check if employee is already in existing entities otherwise create entity
    if (
      !existingIndividualEntitiesObject[
        `${paymentsArray[0].Employee.FirstName._text}-${paymentsArray[0].Employee.LastName._text}`
      ]
    ) {
      createEntityPromises.push({
        type: "individual",
        individual: {
          first_name: paymentsArray[0].Employee.FirstName._text,
          last_name: paymentsArray[0].Employee.LastName._text,
          phone: "15121231111", // Note: Hard-code phone number to get correct capabilities for entity
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

  // Add newly created individual entities to existing individual entities object
  for (const response of responses) {
    existingIndividualEntitiesObject[
      `${response.data.individual.first_name}-${response.data.individual.last_name}`
    ] = response.data.id;
  }

  return existingIndividualEntitiesObject;
};

/* Returns an object of existing liability accounts with key: value format holder_id-merchant_id: liability_account_id */
export const createLiabilityAccounts = async (
  paymentsJson: any,
  individualEntitiesObject: any
) => {
  const studentLoanMerchantsObjectByPlaidId: any = {};
  const existingLiabilityAccountsObject: any = {};
  const createLiablityPromises = [];

  // Get list of popular merchants
  const popularMerchants = await fetchAndRetryIfNecessary(() =>
    tokenBucket.acquireToken(() => api.getMerchants({}))
  );

  for (const merchant of popularMerchants.data) {
    // Add to object if student loan
    if (merchant.types.includes("student_loan")) {
      const plaidIdArray = merchant.provider_ids.plaid;
      for (const plaidId of plaidIdArray) {
        studentLoanMerchantsObjectByPlaidId[plaidId] = merchant.mch_id;
      }
    }
  }

  const allExistingLiabilityAccounts = await fetchAndRetryIfNecessary(() =>
    tokenBucket.acquireToken(() =>
      api.getAccounts({
        type: "liability",
        status: "active",
      })
    )
  );

  // Add existing liability accounts to liability accounts object with key: value format holder_id-merchant_id: liability_account_id
  for (const account of allExistingLiabilityAccounts.data) {
    existingLiabilityAccountsObject[
      `${account.holder_id}-${account.liability.mch_id}`
    ] = account.id;
  }

  // Loop through payments_json and create liability if not existing already
  for (const payment of paymentsJson) {
    let merchantId =
      studentLoanMerchantsObjectByPlaidId[payment.Payee.PlaidId._text];
    // If merchant not found in popular merchants, find merchant from DB
    if (!merchantId) {
      const merchant = await fetchAndRetryIfNecessary(() =>
        tokenBucket.acquireToken(() =>
          api.getMerchants({
            "provider_id.plaid": payment.Payee.PlaidId._text,
          })
        )
      );

      // Incase of multiple merchants being returned, return only student loan merchant
      const studentLoanMerchant = merchant.data.find((item: any) =>
        item.types.includes("student_loan")
      );
      merchantId = studentLoanMerchant?.mch_id;
      // If merchant id is valid, add to merchant ids object
      if (merchantId)
        studentLoanMerchantsObjectByPlaidId[payment.Payee.PlaidId._text] =
          studentLoanMerchant?.mch_id;
    }

    const entityId =
      individualEntitiesObject[
        `${payment.Employee.FirstName._text}-${payment.Employee.LastName._text}`
      ];

    // If liability not already existing and merchant id is valid then create liability
    if (
      merchantId &&
      !existingLiabilityAccountsObject[`${entityId}-${merchantId}`]
    ) {
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

  // Add newly created liability accounts to existing liability accounts object
  for (const response of responses) {
    existingLiabilityAccountsObject[
      `${response.data.holder_id}-${response.data.liability.mch_id}`
    ] = response.data.id;
  }

  // Add to global variable, to be accessed later when initiating payments
  Student_Loan_Merchants_Object_By_PlaidId =
    studentLoanMerchantsObjectByPlaidId;

  return existingLiabilityAccountsObject;
};

/* Returns an array of payment payloads */
export const createPaymentsPayload = async (
  paymentsJson: any,
  sourceAccountsObject: any,
  individualEntitiesObject: any,
  liabilityAccountsObject: any
) => {
  const paymentsPayload = [];
  for (const payment of paymentsJson) {
    const amount = Number(
      payment.Amount._text
        .slice(payment.Amount._text.indexOf("$") + 1)
        .split(".")
        .join("")
    );
    const source = sourceAccountsObject[payment.Payor.AccountNumber._text];
    const individual_holder_id =
      individualEntitiesObject[
        `${payment.Employee.FirstName._text}-${payment.Employee.LastName._text}`
      ];
    const merchant_id =
      Student_Loan_Merchants_Object_By_PlaidId[payment.Payee.PlaidId._text];
    const destination =
      liabilityAccountsObject[`${individual_holder_id}-${merchant_id}`];
    const description = payment.Employee.DunkinBranch._text.slice(
      payment.Employee.DunkinBranch._text.length - 10
    ); // Add last 10 digits of Dunkin branch to payload description. Useful when creating reports.
    paymentsPayload.push({ amount, source, destination, description });
  }
  return paymentsPayload;
};

export const makePayments = async (paymentsPayload: any[]) => {
  const promises = paymentsPayload.map((item) =>
    fetchAndRetryIfNecessary(() =>
      tokenBucket.acquireToken(() => api.makePayment(item))
    )
  );
  const responses = await Promise.all(promises);
  return responses;
};
