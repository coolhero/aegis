// T031: SSE controller — GET /events/stream
import { Controller, Sse, Req, UseGuards, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  stream(@Req() req: Request): Observable<{ data: string; type: string; id: string }> {
    const user = req.user as { userId: string; orgId: string };
    const orgId = user.orgId;
    const userId = user.userId;

    this.logger.log(`SSE stream started: org=${orgId}, user=${userId}`);

    // Clean up on disconnect
    req.on('close', () => {
      this.eventsService.removeConnection(orgId, userId);
      this.logger.log(`SSE stream closed: org=${orgId}, user=${userId}`);
    });

    return this.eventsService.getEventStream(orgId, userId);
  }
}
