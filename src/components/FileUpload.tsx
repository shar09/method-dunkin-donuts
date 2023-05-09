import { useState } from "react";
import {
  readXmlAndConvertToJson,
  createCorporationEntity,
  createSourceAccounts,
  createIndividualEntities,
  createLiabilityAccounts,
} from "../lib/utils";
import { useQuery } from "react-query";

import "../App.css";

export function FileUpload() {
  const [xmlFileUrl, setXmlFileUrl] = useState("");

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
  });

  // ---------------------------------------------------------------------- //

  const _renderXmlFileStatus = () => {
    if (isFetchingPaymentsJson) return <span>Loading...</span>;
    if (isErrorPaymentsJson) return <span>Error</span>;
    if (isIdlePaymentsJson) return <span>Idle</span>;
    if (paymentsJson?.length > 0)
      return (
        <>
          <span>Succesful | </span>
          <span>Number of Payments in file: {paymentsJson?.length}</span>
        </>
      );
  };

  const _renderCorporationEntityStatus = () => {
    if (isFetchingCorporationEntityID) return <span>Loading...</span>;
    if (isErrorCorporationEntityID) return <span>Error</span>;
    if (isIdleCorporationEntityID) return <span>Idle</span>;
    if (corporationEntityID) return <span>Succesful</span>;
  };

  const _renderSourceAccountStatus = () => {
    if (isFetchingSourceAccountsObject) return <span>Loading...</span>;
    if (isErrorSourceAccountsObject) return <span>Error</span>;
    if (isIdleSourceAccountsObject) return <span>Idle</span>;
    if (sourceAccountsObject)
      return (
        <>
          <span>Succesful | </span>
          <span>
            Number of unique Dunkin source accounts in database:{" "}
            {Object.keys(sourceAccountsObject)?.length}
          </span>
        </>
      );
  };

  const _renderIndividualEntityStatus = () => {
    if (isFetchingIndividualEntitiesObject) return <span>Loading...</span>;
    if (isErrorIndividualEntitiesObject) return <span>Error</span>;
    if (isIdleIndividualEntitiesObject) return <span>Idle</span>;
    if (individualEntitiesObject)
      return (
        <>
          <span>Succesful | </span>
          <span>
            Number of individual entities in database:{" "}
            {Object.keys(individualEntitiesObject)?.length}
          </span>
        </>
      );
  };

  const _renderLiabilityAccountStatus = () => {
    if (isFetchingLiabilityAccountsObject) return <span>Loading...</span>;
    if (isErrorLiabilityAccountsObject) return <span>Error</span>;
    if (isIdleLiabilityAccountsObject) return <span>Idle</span>;
    if (liabilityAccountsObject)
      return (
        <>
          <span>Succesful | </span>
          <span>
            Number of liability accounts in database:{" "}
            {Object.keys(liabilityAccountsObject)?.length}
          </span>
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
          className="url-submit-button"
          onClick={() => {
            removePaymentJson();
            removeCorporationEntityID();
            removeSourceAccountsObject();
            removeIndividualEntitiesObject();
            removeLiabilityAccountsObject();
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
    </>
  );
}
