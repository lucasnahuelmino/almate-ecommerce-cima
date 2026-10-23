const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");

const createMercadoPagoGateway = ({ accessToken }) => {
  let client;
  const getClient = () => {
    if (!accessToken || !accessToken.startsWith("TEST-")) {
      const error = new Error("Configurá un Access Token de prueba TEST- en server/.env para habilitar Mercado Pago.");
      error.status = 503;
      throw error;
    }
    if (!client) {
      client = new MercadoPagoConfig({ accessToken });
    }
    return client;
  };

  return {
    async createPreference(body) {
      return new Preference(getClient()).create({ body });
    },
    async getPayment(id) {
      return new Payment(getClient()).get({ id });
    }
  };
};

module.exports = { createMercadoPagoGateway };
