import type { PortfolioExportData, TaxReportData } from "./types";

// Note: This is a simplified PDF generator interface
// In a real implementation, you would use a library like jsPDF or Puppeteer
export class PDFGenerator {
	private static formatCurrency(amount: number): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount / 100); // Convert from cents
	}

	private static formatPercentage(value: number): string {
		return `${value.toFixed(2)}%`;
	}

	private static formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString("en-US");
	}

	static async generatePortfolioReport(
		data: PortfolioExportData,
	): Promise<Blob> {
		// This would use a proper PDF library in production
		const htmlContent = PDFGenerator.generatePortfolioHTML(data);
		return PDFGenerator.htmlToPDF(htmlContent);
	}

	static async generatePerformanceReport(
		portfolioData: PortfolioExportData,
		performanceMetrics: any,
	): Promise<Blob> {
		const htmlContent = PDFGenerator.generatePerformanceHTML(
			portfolioData,
			performanceMetrics,
		);
		return PDFGenerator.htmlToPDF(htmlContent);
	}

	static async generateTaxReport(data: TaxReportData): Promise<Blob> {
		const htmlContent = PDFGenerator.generateTaxHTML(data);
		return PDFGenerator.htmlToPDF(htmlContent);
	}

	private static generatePortfolioHTML(data: PortfolioExportData): string {
		return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Portfolio Report - ${data.portfolio.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
          .section { margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .positive { color: green; }
          .negative { color: red; }
          .neutral { color: gray; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Portfolio Report</h1>
          <h2>${data.portfolio.name}</h2>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="summary">
          <h3>Portfolio Summary</h3>
          <p><strong>Total Value:</strong> ${PDFGenerator.formatCurrency(data.portfolio.totalValue)}</p>
          <p><strong>Total Cost:</strong> ${PDFGenerator.formatCurrency(data.portfolio.totalCost)}</p>
          <p><strong>Gain/Loss:</strong> 
            <span class="${data.portfolio.gainLoss >= 0 ? "positive" : "negative"}">
              ${PDFGenerator.formatCurrency(data.portfolio.gainLoss)}
            </span>
          </p>
          <p><strong>Return:</strong> 
            <span class="${data.portfolio.returnPercentage >= 0 ? "positive" : "negative"}">
              ${PDFGenerator.formatPercentage(data.portfolio.returnPercentage)}
            </span>
          </p>
        </div>

        <div class="section">
          <h3>Positions</h3>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Current Value</th>
                <th>Cost Basis</th>
                <th>Gain/Loss</th>
                <th>Return %</th>
              </tr>
            </thead>
            <tbody>
              ${data.positions
								.map(
									(pos) => `
                <tr>
                  <td>${pos.assetName} ${pos.symbol ? `(${pos.symbol})` : ""}</td>
                  <td>${pos.assetType}</td>
                  <td>${pos.quantity}</td>
                  <td>${PDFGenerator.formatCurrency(pos.currentValue)}</td>
                  <td>${PDFGenerator.formatCurrency(pos.costBasis)}</td>
                  <td class="${pos.gainLoss >= 0 ? "positive" : "negative"}">
                    ${PDFGenerator.formatCurrency(pos.gainLoss)}
                  </td>
                  <td class="${pos.returnPercentage >= 0 ? "positive" : "negative"}">
                    ${PDFGenerator.formatPercentage(pos.returnPercentage)}
                  </td>
                </tr>
              `,
								)
								.join("")}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Recent Transactions</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Quantity</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${data.transactions
								.slice(0, 20)
								.map(
									(tx) => `
                <tr>
                  <td>${PDFGenerator.formatDate(tx.date)}</td>
                  <td>${tx.type}</td>
                  <td>${tx.assetName}</td>
                  <td>${tx.quantity || "-"}</td>
                  <td>${PDFGenerator.formatCurrency(tx.amount)}</td>
                </tr>
              `,
								)
								.join("")}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
	}

	private static generatePerformanceHTML(
		portfolioData: PortfolioExportData,
		_performanceMetrics: any,
	): string {
		return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Performance Report - ${portfolioData.portfolio.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .metric-card { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          .section { margin-bottom: 30px; }
          .positive { color: green; }
          .negative { color: red; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Performance Analytics Report</h1>
          <h2>${portfolioData.portfolio.name}</h2>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="metrics">
          <div class="metric-card">
            <h4>Total Return</h4>
            <p class="${portfolioData.portfolio.returnPercentage >= 0 ? "positive" : "negative"}">
              ${PDFGenerator.formatPercentage(portfolioData.portfolio.returnPercentage)}
            </p>
          </div>
          <div class="metric-card">
            <h4>Total Value</h4>
            <p>${PDFGenerator.formatCurrency(portfolioData.portfolio.totalValue)}</p>
          </div>
          <div class="metric-card">
            <h4>Unrealized Gain/Loss</h4>
            <p class="${portfolioData.portfolio.gainLoss >= 0 ? "positive" : "negative"}">
              ${PDFGenerator.formatCurrency(portfolioData.portfolio.gainLoss)}
            </p>
          </div>
          <div class="metric-card">
            <h4>Asset Count</h4>
            <p>${portfolioData.positions.length}</p>
          </div>
        </div>

        <div class="section">
          <h3>Asset Allocation</h3>
          <p>Detailed allocation analysis and recommendations would be included here.</p>
        </div>

        <div class="section">
          <h3>Performance Analysis</h3>
          <p>Time-weighted returns, volatility metrics, and benchmark comparisons would be included here.</p>
        </div>
      </body>
      </html>
    `;
	}

	private static generateTaxHTML(data: TaxReportData): string {
		return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tax Report ${data.taxYear}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .positive { color: green; }
          .negative { color: red; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Tax Report</h1>
          <h2>Tax Year ${data.taxYear}</h2>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="summary">
          <h3>Summary</h3>
          <p><strong>Total Realized Gains:</strong> ${PDFGenerator.formatCurrency(data.summary.totalRealizedGains)}</p>
          <p><strong>Total Realized Losses:</strong> ${PDFGenerator.formatCurrency(data.summary.totalRealizedLosses)}</p>
          <p><strong>Net Gain/Loss:</strong> 
            <span class="${data.summary.netGainLoss >= 0 ? "positive" : "negative"}">
              ${PDFGenerator.formatCurrency(data.summary.netGainLoss)}
            </span>
          </p>
          <p><strong>Total Dividends:</strong> ${PDFGenerator.formatCurrency(data.summary.totalDividends)}</p>
        </div>

        <div class="section">
          <h3>Realized Gains and Losses</h3>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Sale Date</th>
                <th>Purchase Date</th>
                <th>Quantity</th>
                <th>Sale Price</th>
                <th>Cost Basis</th>
                <th>Gain/Loss</th>
                <th>Term</th>
              </tr>
            </thead>
            <tbody>
              ${data.realizedGains
								.map(
									(gain) => `
                <tr>
                  <td>${gain.assetName} ${gain.symbol ? `(${gain.symbol})` : ""}</td>
                  <td>${PDFGenerator.formatDate(gain.saleDate)}</td>
                  <td>${PDFGenerator.formatDate(gain.purchaseDate)}</td>
                  <td>${gain.quantity}</td>
                  <td>${PDFGenerator.formatCurrency(gain.salePrice)}</td>
                  <td>${PDFGenerator.formatCurrency(gain.costBasis)}</td>
                  <td class="${gain.gainLoss >= 0 ? "positive" : "negative"}">
                    ${PDFGenerator.formatCurrency(gain.gainLoss)}
                  </td>
                  <td>${gain.termType}</td>
                </tr>
              `,
								)
								.join("")}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
	}

	private static async htmlToPDF(html: string): Promise<Blob> {
		// In a real implementation, this would use a proper PDF generation library
		// For now, we'll create a simple text blob as a placeholder
		const pdfContent = `PDF Report\n\n${html
			.replace(/<[^>]*>/g, "")
			.replace(/\s+/g, " ")
			.trim()}`;
		return new Blob([pdfContent], { type: "application/pdf" });
	}
}
