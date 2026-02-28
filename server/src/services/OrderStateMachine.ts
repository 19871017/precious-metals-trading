export enum OrderState {
  CREATED = 'created',
  PROCESSING = 'processing',
  FILLED = 'filled',
  CLOSED = 'closed',
  FAILED = 'failed',
}

export interface StateTransition {
  from: OrderState;
  to: OrderState;
  timestamp: Date;
  reason?: string;
}

export const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  [OrderState.CREATED]: [OrderState.PROCESSING, OrderState.FAILED],
  [OrderState.PROCESSING]: [OrderState.FILLED, OrderState.FAILED],
  [OrderState.FILLED]: [OrderState.CLOSED],
  [OrderState.CLOSED]: [],
  [OrderState.FAILED]: [],
};

export class OrderStateMachine {
  private state: OrderState;
  private history: StateTransition[];
  private readonly orderId: string;

  constructor(orderId: string, initialState: OrderState = OrderState.CREATED) {
    this.orderId = orderId;
    this.state = initialState;
    this.history = [];
    this.recordTransition(null as any, initialState, 'Initial state');
  }

  canTransition(toState: OrderState): boolean {
    const validTransitions = VALID_TRANSITIONS[this.state];
    return validTransitions.includes(toState);
  }

  transition(toState: OrderState, reason?: string): void {
    if (!this.canTransition(toState)) {
      throw new Error(
        `Invalid state transition from ${this.state} to ${toState} for order ${this.orderId}`
      );
    }

    const fromState = this.state;
    this.state = toState;
    this.recordTransition(fromState, toState, reason);
  }

  private recordTransition(
    fromState: OrderState,
    toState: OrderState,
    reason?: string
  ): void {
    const transition: StateTransition = {
      from: fromState,
      to: toState,
      timestamp: new Date(),
      reason,
    };

    this.history.push(transition);
  }

  getState(): OrderState {
    return this.state;
  }

  getHistory(): StateTransition[] {
    return [...this.history];
  }

  isFinalState(): boolean {
    return (
      this.state === OrderState.CLOSED || this.state === OrderState.FAILED
    );
  }

  isProcessingState(): boolean {
    return this.state === OrderState.PROCESSING;
  }

  isFilledState(): boolean {
    return this.state === OrderState.FILLED;
  }
}
