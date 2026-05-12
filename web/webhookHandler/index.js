

export const orderCreateHandler = async (topic, shop, webhookRequestBody) => {
    try {

      const webhookBody = JSON.parse(webhookRequestBody);
      console.log("orderCreate", webhookBody);
      
      
    } catch (e) {
      console.log(e);
    }
  };
  

  export const appUninstallHandler = async (topic, shop, webhookRequestBody) => {
    try {

      const webhookBody = JSON.parse(webhookRequestBody);
      console.log("appUninstallHandler", webhookBody);
      
      
    } catch (e) {
      console.log(e);
    }
  };

  