import dotenv from 'dotenv';
dotenv.config();

export class CardTerminalService {
  constructor() {
    this.mode = process.env.PAYMENT_TERMINAL_MODE || 'mock';
    this.terminalIp = process.env.STONE_TERMINAL_IP || '192.168.1.100';
    this.terminalPort = process.env.STONE_TERMINAL_PORT || '8080';
  }

  /**
   * Processes a card payment on the terminal.
   * @param {number} amount - Total value of the transaction.
   * @param {string} paymentMethod - 'Cartão Crédito' or 'Cartão Débito'.
   * @returns {Promise<{success: boolean, transactionId: string, message: string}>}
   */
  async processPayment(amount, paymentMethod) {
    if (this.mode === 'mock') {
      // Simulate POS device processing time (3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      // Let special values fail for testing purposes (e.g. 9.99 fails)
      if (amount === 9.99) {
        return {
          success: false,
          transactionId: null,
          message: 'Transação Recusada: Saldo Insuficiente'
        };
      }

      return {
        success: true,
        transactionId: `STONE_MOCK_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        message: 'Transação Aprovada via Stone P2-B (Simulado)'
      };
    }

    // Real API integration on Local Network with Stone P2-B Android Smart POS
    try {
      const type = paymentMethod === 'Cartão Crédito' ? 'credit' : 'debit';
      
      // Send transaction request to the terminal's local HTTP API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

      const response = await fetch(`http://${this.terminalIp}:${this.terminalPort}/api/v1/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Stone APIs typically process values in cents (e.g., R$ 10,00 -> 1000)
          method: type,
          installment_type: 'none',
          installments: 1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro no Terminal (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      // Standardize the result returned from the Smart POS API
      return {
        success: result.status === 'approved' || result.approved === true,
        transactionId: result.transaction_id || result.nsu || `STONE_${Date.now()}`,
        message: result.message || (result.approved ? 'Transação Aprovada' : 'Transação Recusada')
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Tempo limite excedido aguardando resposta da maquininha Stone.');
      }
      throw new Error(`Falha na comunicação com a maquininha: ${error.message}`);
    }
  }
}

const terminalService = new CardTerminalService();
export default terminalService;
