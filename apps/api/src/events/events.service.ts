// T031: SSE events service — manages per-org connections
import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface SSEEventData {
  type: 'request_completed' | 'budget_alert' | 'ping';
  orgId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface EventConnection {
  orgId: string;
  userId: string;
  connectedAt: Date;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly eventSubject = new Subject<SSEEventData>();
  private readonly connections = new Map<string, EventConnection[]>();

  /**
   * Get observable stream for a specific org
   */
  getEventStream(orgId: string, userId: string): Observable<{ data: string; type: string; id: string }> {
    this.addConnection(orgId, userId);

    return this.eventSubject.pipe(
      filter((event) => event.orgId === orgId || event.type === 'ping'),
      map((event) => ({
        data: JSON.stringify(event.data),
        type: event.type,
        id: event.timestamp,
      })),
    );
  }

  /**
   * Emit an event to all connections for an org
   */
  emitEvent(event: SSEEventData): void {
    this.eventSubject.next(event);
    this.logger.debug(`Event emitted: ${event.type} for org ${event.orgId}`);
  }

  /**
   * Emit heartbeat ping to all connections
   */
  emitPing(): void {
    this.eventSubject.next({
      type: 'ping',
      orgId: '*',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  private addConnection(orgId: string, userId: string): void {
    const existing = this.connections.get(orgId) || [];
    existing.push({ orgId, userId, connectedAt: new Date() });
    this.connections.set(orgId, existing);
    this.logger.log(`SSE connection added: org=${orgId}, user=${userId}, total=${existing.length}`);
  }

  removeConnection(orgId: string, userId: string): void {
    const existing = this.connections.get(orgId) || [];
    const filtered = existing.filter((c) => c.userId !== userId);
    if (filtered.length > 0) {
      this.connections.set(orgId, filtered);
    } else {
      this.connections.delete(orgId);
    }
    this.logger.log(`SSE connection removed: org=${orgId}, user=${userId}`);
  }

  getConnectionCount(orgId: string): number {
    return (this.connections.get(orgId) || []).length;
  }
}
