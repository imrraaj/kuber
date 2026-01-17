/**
 * Parameters for opening a position.
 */
export interface OrderParams {
  symbol: string;
  side: "long" | "short";
  size: number;
  price?: number;
  orderType: "limit" | "market";
  leverage?: number;
}

/**
 * Result of placing an order.
 */
export interface OrderResult {
  orderId: string;
  status: "pending" | "filled" | "partial" | "cancelled" | "failed";
  filledPrice?: number;
  filledSize?: number;
  error?: string;
}

/**
 * Parameters for closing a position.
 */
export interface CloseParams {
  symbol: string;
  size: number;
  price?: number;
  orderType?: "limit" | "market";
}

/**
 * Current account state.
 */
export interface AccountState {
  accountValue: number;
  availableBalance: number;
  marginUsed: number;
  withdrawable: number;
}

/**
 * An open position.
 */
export interface Position {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  liquidationPrice: number;
  leverage: number;
  marginUsed: number;
}
