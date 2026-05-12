import { useState, useEffect } from "react";
import { Card, Page, Layout, TextContainer, Heading, Button } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Document, Page as PDFPage } from 'react-pdf';
import pdfjs from "pdfjs-dist";

// Set the workerSrc for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function LieferScheinPrint() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfOpened, setPdfOpened] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdf, setPdf] = useState(null);
  
  useEffect(() => {

    
    async function createPdf() {
      try {
        const orderId = new URLSearchParams(window.location.search).get("id");
        const response = await fetch(`/api/getLieferscheinPDF?id=${orderId}`);

        const data = await response.json();

        if (data.htmlContent) {
            const styleElement = document.createElement("style");
            styleElement.innerHTML = data.cssContent;
            document.head.appendChild(styleElement);
            
            const htmlElement = document.createElement("div");
            htmlElement.innerHTML = data.htmlContent;
            document.body.appendChild(htmlElement);

            //remove the style and html element
            // console.log("styleElement", styleElement);
            // console.log("htmlElement", htmlElement);


          const canvas = await html2canvas(htmlElement, {
            useCORS: true,
            scale: 2,
          });
          //remove the style and html element
            document.head.removeChild(styleElement);
            document.body.removeChild(htmlElement);

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            setPdf(pdf);
            setPdfOpened(true);
            setPdfUrl(pdf.output("bloburl"));

            // Add the following line to set the pdfBlobUrl state
            setPdfBlobUrl(URL.createObjectURL(pdf.output("blob")));

            pdf.save("lieferschein_"+data.order.name+".pdf");
          
        } else {
          console.error("No URL received from the server.");
        }
      } catch (error) {
        console.error("Error creating PDF:", error);
      }
    }

    createPdf();
  }, []);

  const handlePrint1 = () => {
    if (pdf) {
      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
    }
  };

  const handlePrint2 = () => {
    if (pdf) {
      const link = document.createElement("a");
      link.href = pdf.output("bloburl");
      link.download = "lieferschein.pdf";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint3 = () => {
    if (pdf) {
      pdf.save("lieferschein.pdf");
    }
  };

  const handlePrint4 = () => {
    if (pdf) {
      pdf.save("lieferschein.pdf");
    }
  };

  return (
    <Page narrowWidth>
      <TitleBar title="Lieferschein erstellen" primaryAction={null} />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <TextContainer spacing="loose">
              <Heading>
                {pdfOpened ? "Lieferschein geladen" : "Lade PDF..."}
              </Heading>
              {/* {pdfOpened && (
                <>
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={() => console.log("PDF loaded successfully")}
                    onLoadError={(error) => console.log("Error loading PDF:", error)}
                  >
                    <PDFPage pageNumber={1} width={window.innerWidth - 40} />
                  </Document>
                  <br />
                  <Button
                    primary
                    onClick={() => window.print()}
                    style={{ marginTop: "10px" }}
                  >
                    PDF drucken
                  </Button>
                </>
              )} */}
            </TextContainer>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}