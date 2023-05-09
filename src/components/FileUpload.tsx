import { Fragment, useState } from "react";
import {
  readXmlAndConvertToJson,
  createCorporationEntity,
  createSourceAccounts,
  createIndividualEntities,
  createLiabilityAccounts,
  createPaymentsPayload,
  makePayments,
} from "../lib/utils";
import { useQuery } from "react-query";

import "../App.css";

export function FileUpload() {
  const [xmlFileUrl, setXmlFileUrl] = useState("");
  const [paymentsTotal, setPaymentsTotal] = useState("");
  const [authorizePayments, setAuthorizePayments] = useState(false);
  const [showPaymentsInitiation, setShowPaymentsInitiation] = useState(false);

  function calculateTotalPaymentPayloadAmount(paymentPayload: any[]) {
    const totalAmount = paymentPayload.reduce((accumulator: any, item: any) => {
      accumulator = accumulator + item.amount;
      return accumulator;
    }, 0);
    const amountToString = totalAmount.toString();
    setPaymentsTotal(
      `${amountToString.slice(
        0,
        amountToString.length - 2
      )}.${amountToString.slice(amountToString.length - 2)}`
    );
    setShowPaymentsInitiation(true);
  }

  const readXmlData = async () => {
    const payments_json = await readXmlAndConvertToJson(xmlFileUrl);
    setXmlFileUrl("");
    return payments_json;
  };

  const {
    isFetching: isFetchingPaymentsJson,
    isError: isErrorPaymentsJson,
    isIdle: isIdlePaymentsJson,
    data: paymentsJson,
    refetch: refetchPaymentJson,
    remove: removePaymentJson,
  } = useQuery(["paymentsJson"], readXmlData, {
    refetchOnWindowFocus: false,
    enabled: false,
  });

  // API Calls - Store responses in React Query state
  // ---------------------------------------------------------------------- //

  const fetchCorporationEntityID = async () => {
    return await createCorporationEntity(paymentsJson[0]);
  };

  const {
    isFetching: isFetchingCorporationEntityID,
    isError: isErrorCorporationEntityID,
    isIdle: isIdleCorporationEntityID,
    data: corporationEntityID,
    remove: removeCorporationEntityID,
  } = useQuery(["corporationEntityID"], fetchCorporationEntityID, {
    enabled: paymentsJson?.length > 0,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------- //

  const fetchSourceAccountsObject = async () => {
    return await createSourceAccounts(paymentsJson, corporationEntityID);
  };

  const {
    isFetching: isFetchingSourceAccountsObject,
    isError: isErrorSourceAccountsObject,
    isIdle: isIdleSourceAccountsObject,
    data: sourceAccountsObject,
    remove: removeSourceAccountsObject,
  } = useQuery(["sourceAccountsObject"], fetchSourceAccountsObject, {
    enabled: !!corporationEntityID,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------- //

  const fetchIndividualEntitiesObject = async () => {
    return await createIndividualEntities(paymentsJson);
  };

  const {
    isFetching: isFetchingIndividualEntitiesObject,
    isError: isErrorIndividualEntitiesObject,
    isIdle: isIdleIndividualEntitiesObject,
    data: individualEntitiesObject,
    remove: removeIndividualEntitiesObject,
  } = useQuery(["individualEntitiesObject"], fetchIndividualEntitiesObject, {
    enabled: !!sourceAccountsObject,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------- //

  const fetchLiabilityAccountsObject = async () => {
    return await createLiabilityAccounts(
      paymentsJson,
      individualEntitiesObject
    );
  };

  const {
    isFetching: isFetchingLiabilityAccountsObject,
    isError: isErrorLiabilityAccountsObject,
    isIdle: isIdleLiabilityAccountsObject,
    data: liabilityAccountsObject,
    remove: removeLiabilityAccountsObject,
  } = useQuery(["liabilityAccountsObject"], fetchLiabilityAccountsObject, {
    enabled: !!individualEntitiesObject,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------- //
  const fetchPaymentsPayloadArray = async () => {
    return await createPaymentsPayload(
      paymentsJson,
      sourceAccountsObject,
      individualEntitiesObject,
      liabilityAccountsObject
    );
  };

  const {
    isFetching: isFetchingPaymentsPayloadArray,
    isError: isErrorPaymentsPayloadArray,
    isIdle: isIdlePaymentsPayloadArray,
    data: paymentsPayloadArray,
    remove: removePaymentsPayloadArray,
  } = useQuery(["paymentsPayloadArray"], fetchPaymentsPayloadArray, {
    enabled: !!liabilityAccountsObject,
    refetchOnWindowFocus: false,
    onSuccess: (data) => calculateTotalPaymentPayloadAmount(data),
  });

  // ---------------------------------------------------------------------- //

  const fetchMakePaymentsResults = async () => {
    const responses = await makePayments(paymentsPayloadArray!);
    console.log("payments: ", responses);
    return responses;
  };

  const {
    isFetching: isFetchingMakePaymentsResults,
    isError: isErrorMakePaymentsResults,
    isIdle: isIdleMakePaymentsResults,
    data: makePaymentsResults,
    remove: removeMakePaymentsResults,
  } = useQuery(["makePaymentsResults "], fetchMakePaymentsResults, {
    enabled: !!paymentsPayloadArray && authorizePayments,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------- //

  const _renderXmlFileStatus = () => {
    if (isFetchingPaymentsJson) return <span>Loading...</span>;
    if (isErrorPaymentsJson) return <span>Error</span>;
    if (isIdlePaymentsJson) return <span>Idle</span>;
    if (paymentsJson?.length > 0)
      return (
        <>
          <span style={{ color: "green" }}>Successful | </span>
          <span>Number of Payments in file: {paymentsJson?.length}</span>
        </>
      );
  };

  const _renderCorporationEntityStatus = () => {
    if (isFetchingCorporationEntityID) return <span>Loading...</span>;
    if (isErrorCorporationEntityID)
      return <span style={{ color: "red" }}>Error</span>;
    if (isIdleCorporationEntityID) return <span>Idle</span>;
    if (corporationEntityID)
      return <span style={{ color: "green" }}>Successful</span>;
  };

  const _renderSourceAccountStatus = () => {
    if (isFetchingSourceAccountsObject) return <span>Loading...</span>;
    if (isErrorSourceAccountsObject)
      return <span style={{ color: "red" }}>Error</span>;
    if (isIdleSourceAccountsObject) return <span>Idle</span>;
    if (sourceAccountsObject)
      return (
        <>
          <span style={{ color: "green" }}>Successful | </span>
          <span>
            Number of unique Dunkin source accounts in database:{" "}
            {Object.keys(sourceAccountsObject)?.length}
          </span>
        </>
      );
  };

  const _renderIndividualEntityStatus = () => {
    if (isFetchingIndividualEntitiesObject) return <span>Loading...</span>;
    if (isErrorIndividualEntitiesObject)
      return <span style={{ color: "red" }}>Error</span>;
    if (isIdleIndividualEntitiesObject) return <span>Idle</span>;
    if (individualEntitiesObject)
      return (
        <>
          <span style={{ color: "green" }}>Successful | </span>
          <span>
            Number of individual entities in database:{" "}
            {Object.keys(individualEntitiesObject)?.length}
          </span>
        </>
      );
  };

  const _renderLiabilityAccountStatus = () => {
    if (isFetchingLiabilityAccountsObject) return <span>Loading...</span>;
    if (isErrorLiabilityAccountsObject)
      return <span style={{ color: "red" }}>Error</span>;
    if (isIdleLiabilityAccountsObject) return <span>Idle</span>;
    if (liabilityAccountsObject)
      return (
        <>
          <span style={{ color: "green" }}>Successful | </span>
          <span>
            Number of liability accounts in database:{" "}
            {Object.keys(liabilityAccountsObject)?.length}
          </span>
        </>
      );
  };

  const _renderPaymentsPayloadStatus = () => {
    if (isFetchingPaymentsPayloadArray) return <span>Loading...</span>;
    if (isErrorPaymentsPayloadArray)
      return <span style={{ color: "red" }}>Error</span>;
    if (isIdlePaymentsPayloadArray) return <span>Idle</span>;
    if (paymentsPayloadArray)
      return (
        <>
          <span style={{ color: "green" }}>Successful | </span>
          <span>
            Number of payments to initiate: {paymentsPayloadArray?.length}
          </span>
        </>
      );
  };

  const _renderMakePaymentsResultsStatus = () => {
    if (isFetchingMakePaymentsResults) return <span>Loading...</span>;
    if (isErrorMakePaymentsResults)
      return <span style={{ color: "red" }}>Error</span>;
    if (isIdleMakePaymentsResults) return <span>Idle</span>;
    if (makePaymentsResults)
      return (
        <>
          <span style={{ color: "green" }}>Successful | </span>
          <span>Generating CSV Report...</span>
        </>
      );
  };

  return (
    <>
      <div className="navbar">
        <span className="dunkin-donuts-brand brand-text">DUNKIN' DONUTS</span>
        <span className="method-brand brand-text">METHOD</span>
      </div>
      <div className="url-input-container">
        <label className="url-label">Enter XML File Url </label>
        <input
          type="text"
          className="url-input"
          value={xmlFileUrl}
          onChange={(e) => setXmlFileUrl(e.target.value)}
        />
        <button
          className="btn url-submit-button"
          onClick={() => {
            removePaymentJson();
            removeCorporationEntityID();
            removeSourceAccountsObject();
            removeIndividualEntitiesObject();
            removeLiabilityAccountsObject();
            removePaymentsPayloadArray();
            refetchPaymentJson();
          }}
        >
          Submit
        </button>
      </div>
      <p>
        <span>File Status: </span>
        {_renderXmlFileStatus()}
      </p>
      <p>
        <span>Corporation Entity Status: </span>
        {_renderCorporationEntityStatus()}
      </p>
      <p>
        <span>Source Accounts Status: </span>
        {_renderSourceAccountStatus()}
      </p>
      <p>
        <span>Individual Entities Status: </span>
        {_renderIndividualEntityStatus()}
      </p>
      <p>
        <span>Liability Accounts Status: </span>
        {_renderLiabilityAccountStatus()}
      </p>
      <p>
        <span>Payments Payload Status: </span>
        {_renderPaymentsPayloadStatus()}
      </p>
      {showPaymentsInitiation ? (
        <>
          <p>Initiating payments worth ${paymentsTotal}</p>
          <button
            className="btn authorize-button"
            onClick={() => setAuthorizePayments(true)}
          >
            Authorize
          </button>
          <button
            className="btn cancel-button"
            onClick={() => {
              removePaymentJson();
              removeCorporationEntityID();
              removeSourceAccountsObject();
              removeIndividualEntitiesObject();
              removeLiabilityAccountsObject();
              removePaymentsPayloadArray();
              setShowPaymentsInitiation(false);
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <Fragment />
      )}
      <p>
        <span>Payments Results Status: </span>
        {_renderMakePaymentsResultsStatus()}
      </p>
    </>
  );
}
