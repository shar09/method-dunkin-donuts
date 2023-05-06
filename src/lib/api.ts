import axios from "axios";

const url = "https://dev.methodfi.com";

const api_key = process.env.REACT_APP_API_KEY
  ? process.env.REACT_APP_API_KEY
  : "";

const config = {
  Authorization: `Bearer ${api_key}`,
  "Content-type": "application/json",
};

const api = {
  /**
   * Get list of entities
   * @param options type, status
   * @returns list of existing entities
   */
  getEntities: async (options: { type?: string; status?: string }) => {
    const res = await axios.get(`${url}/entities`, {
      params: options,
      headers: config,
    });
    return res.data;
  },

  /**
   * Create an entity
   * @param options entity details object
   * @returns creates a new entity
   */
  createEntity: async (options: any) => {
    return await axios.post(`${url}/entities`, options, {
      headers: config,
    });
  },

  /**
   * Create an account
   * @param options account details object
   * @returns creates a bank account for payment transfers
   */
  createAccount: async (options: any) => {
    return await axios.post(`${url}/accounts`, options, {
      headers: config,
    });
  },

  /**
   * Make Payment
   * @param options payment details object
   * @returns makes payment for given account id's
   */
  makePayment: async (options: any) => {
    return await axios.post(`${url}/payments`, options, {
      headers: config,
    });
  },
};

export default api;
