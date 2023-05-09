import { useEffect, useState } from "react";
import {
  readXmlAndConvertToJson,
  createCorporationEntity,
  createSourceAccounts,
  createIndividualEntities,
  liabilityAccounts,
} from "../lib/utils";
import api from "../lib/api";

import { useQuery } from "react-query";

import "../App.css";

export function FileUpload() {
  useEffect(() => {
    // (async () => {
    //     await readUrl();
    //     await createCorporateEntity();
    //     await createSourceAccounts();
    //     await createIndividualEntities();
    //     await liabilityAccounts();
    //   })();
  }, []);

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
  } = useQuery(["paymentsJson"], readXmlData, {
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const fetchCorporationEntityID = async () => {
    return await createCorporationEntity(paymentsJson[0]);
  };

  const {
    isFetching: isFetchingCorporationEntityID,
    isError: isErrorCorporationEntityID,
    isIdle: isIdleCorporationEntityID,
    data: corporationEntityID,
  } = useQuery(
    ["corporationEntityID", paymentsJson],
    fetchCorporationEntityID,
    {
      enabled: paymentsJson?.length > 0,
    }
  );

  const _renderXmlFileStatus = () => {
    if (isFetchingPaymentsJson) return <span>Loading...</span>;
    if (isErrorPaymentsJson) return <span>Error</span>;
    if (isIdlePaymentsJson) return <span>Idle</span>;
    if (paymentsJson?.length > 0) return <span>Succesful</span>;
  };

  const _renderCorporationEntityStatus = () => {
    if (isFetchingCorporationEntityID) return <span>Loading...</span>;
    if (isErrorCorporationEntityID) return <span>Error</span>;
    if (isIdleCorporationEntityID) return <span>Idle</span>;
    if (corporationEntityID) return <span>Succesful</span>;
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
          onClick={() => refetchPaymentJson()}
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
    </>
  );
}
