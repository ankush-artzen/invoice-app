class SevDeskAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://my.sevdesk.de/api/v1";
    }

    async fetchData(endpoint, method = "GET", bodyData, noParams = false) {
        // console.log(this.apiKey,'api key')
        const url = noParams ? `${this.baseUrl}/${endpoint}?token=${this.apiKey}` : `${this.baseUrl}/${endpoint}&token=${this.apiKey}`;
        const options = {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.apiKey}`,
            },
        };
        
        if (bodyData) {
            options.body = JSON.stringify(bodyData);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        // console.log(data,"data****************");
        //if data.objects is null console.log data.error.message 
        if (data.objects === null) {
            console.log("SevDesk Error: " + data.error.message);
            console.log(data);
        }

        //check data for status code
        if (data.status) {
            console.log("SevDesk Error: " + data.message);
            console.log(data);
        }


        return data.objects;
    }

    async getContactById(contactId) {
        return this.fetchData(`Contact?depth=1&customerNumber=${contactId}`);
    }

    async getSevUser() {
        return this.fetchData("SevUser?role=admin");
    }

    async getOrderNumber() {
        return this.fetchData("SevSequence/Factory/getByType?objectType=Invoice&type=RE");
    }

    async getCreditNoteNumber() {
        //v1/SevSequence/Factory/getByType?objectType=CreditNote&type=CN
        return this.fetchData("SevSequence/Factory/getByType?objectType=CreditNote&type=CN");
    }

    async findContactById(contactId) {
        return this.fetchData(`Contact/Mapper/checkCustomerNumberAvailability?depth=1&customerNumber=${contactId}`);
    }

    async createContact(contactData) {
        const customer = this.fetchData("Contact", "POST", contactData, true);
        return customer;
    }

    async updateContact(contactId, contactData) {
        return this.fetchData(`Contact/${contactId}`, "PUT", contactData, true);
    }

    async getAllContactAddresses() {
        return this.fetchData("ContactAddress");
    }

    async getContactAddressById(contactId) {
        return this.fetchData(`ContactAddress/${contactId}`);
    }

    async getContactAddressByContactId(contactId){
        return this.fetchData(`ContactAddress?contact[id]=${contactId}&contact[objectName]=Contact`);
    }


    async createContactAddress(addressData) {
        return this.fetchData("ContactAddress", "POST", addressData, true);
    }

    async updateContactAddress(contactAddressId, addressData) {
            
        return this.fetchData(`ContactAddress/${contactAddressId}`, "PUT", addressData, true);
    }



    async getCustomerEmail(contactId) {
        return this.fetchData(`CommunicationWay?contact[objectName]=Contact&type=email&contact[id]=${contactId}`);
    }

    async setCustomerEmail(contactId, email) {
        const req = {
            "id": null,
            "contact": {
                "id": contactId.toString(),
                "objectName": "Contact"
            },
            "type": "EMAIL",
            "value": email,
            "key": {
                "id": 2,
                "objectName": "CommunicationWayKey"
            },
            "main": 0
        }; return this.fetchData("CommunicationWay", "POST", req, true);
    }

    async updateCustomerEmail(communicationWayId, email) {
        const req = {
            "value": email
        }; return this.fetchData(`CommunicationWay/${communicationWayId}`, "PUT", req, true);
    }





    

    async sendInvoiceViaMail(invoiceId, email, invoiceNr) {

    var text = "Vielen Dank für Ihren Einkauf.\nSollten Sie bereits im Onlineshop an der Kassa bezahlt haben, bitte betrachten Sie diese Rechnung als bezahlt.\nSie finden die Rechnung im Anhang dieser Mail im PDF Format.\nWir hoffen, Sie bald wieder als Kunden begrüßen zu dürfen.";

        const bodyData = {
            "toEmail": email,
            "subject": `Ihre Rechnung zum Auftrag ${invoiceNr}`,
            "text": text,
            "copy": false
        }; return this.fetchData(`Invoice/${invoiceId}/sendViaEmail`, "POST", bodyData, true);
    }

    async setInvoiceAsSent(invoiceId) {
        const req = {
        "sendType": "VM",
        "sendDraft": true
        }

        return this.fetchData(`Invoice/${invoiceId}/sendBy`, "PUT", req, true);
    }
    async getInvoiceByOrderId(invoiceId) {
        return this.fetchData(`Invoice?customerInternalNote=${invoiceId}`);
    }

    async createInvoice(invoiceData) {
        return this.fetchData("Invoice/Factory/saveInvoice", "POST", invoiceData, true);
    }

    async deleteInvoice(invoiceId) {
        return this.fetchData(`Invoice/${invoiceId}`, "DELETE", null, true);
    }
    
    
    async getInvoiceById(invoiceId) {
        return this.fetchData(`Invoice?invoiceNumber=${invoiceId}`);
    }

    async getInvoicePositionsById(invoiceId) {
        return this.fetchData(`Invoice/${invoiceId}/getPositions`, "GET", null, true);
    }

    async bookInvoice(invoiceId, bookData) {
        return this.fetchData(`Invoice/${invoiceId}/bookAmount`, "PUT", bookData, true);
    }

    async cancelInvoice (invoiceId, cancelData) { 

        return this.fetchData(`Invoice/${invoiceId}/cancelInvoice`, "POST", cancelData, true);
    }

    async renderInvoice(invoiceId) {
        const invoiceData = {
            forceReload: true
        }
        return this.fetchData(`Invoice/${invoiceId}/render`, "POST", invoiceData, true);

    }

    async getEmail(contactId){
        //https://my.sevdesk.de/api/v1/CommunicationWay
        return this.fetchData(`CommunicationWay?contact[objectName]=Contact&type=email&contact[id]=${contactId}`);
    }
    async sendCreditNoteViaEmail(creditNoteId, email, creditNoteNr) {
       

        var text = "Sehr geehrte/r Kunde/in. Sie erhalten heute Ihre Gutschrift zu Auftrag ";

        const bodyData = {
            "toEmail": email,
            "subject": `Gutschrift Nr. ${creditNoteNr}`,
            "text": "Email Text",
            "copy": false
        }; return this.fetchData(`CreditNote/${creditNoteId}/sendViaEmail`, "POST", bodyData, true);
    }

    async createCreditNote(creditNoteData) {
        return this.fetchData("CreditNote/Factory/saveCreditNote", "POST", creditNoteData, true);
    }
    
    async bookCreditNote (creditNoteId, bookData) {
        
     
        return this.fetchData(`CreditNote/${creditNoteId}/bookAmount`, "PUT", bookData, true);
    }

            

    async getCheckAccountID() {
        const checkAccount = await this.fetchData("CheckAccount?name=Basiskonto");
        return checkAccount[0].id;
    }


    async getCountryId(countryName) {
        const countries = await this.fetchData("StaticCountry?limit=1000");
        
        const countryCode = countries.find(country => country.nameEn === countryName);

        return countryCode ? countryCode.id : 1;
    }
}

export default SevDeskAPI;