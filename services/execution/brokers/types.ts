import { OrderRequest, OrderResult, Position, BrokerId } from '../../../types/execution';

export interface BrokerAdapter {
  id: BrokerId;
  name: string;
  isConfigured(): boolean;
  placeOrder(req: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  getPositions(): Promise<Position[]>;
  closePosition(positionId: string, symbol: string): Promise<OrderResult>;
  modifyStopLoss(positionId: string, symbol: string, stopLoss: number): Promise<boolean>;
  getBalance(): Promise<number>;
}
