import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { BetterAuthService } from "../auth/better-auth.service";
import { TenantResolverService } from "../tenancy/tenant-resolver.service";
import { TenantContext } from "../tenancy/tenant-context";
import { Server, Socket } from "socket.io";
import { WhatsAppMessage } from "./whatsapp.service";

// Get allowed origins from environment or use secure defaults
const getAllowedOrigins = (): string | string[] => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  }

  // Development defaults only in non-production
  if (process.env.NODE_ENV !== "production") {
    return ["http://localhost:4200", "http://localhost:3000"];
  }

  // No origins allowed in production without explicit configuration
  return [];
};

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ["GET", "POST"],
  },
  namespace: "/whatsapp",
})
export class WhatsAppGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger("WhatsAppGateway");

  constructor(
    private readonly betterAuthService: BetterAuthService,
    private readonly tenantResolver: TenantResolverService
  ) {}

  /**
   * Only authenticated members of the DSP that owns the connection's domain
   * may connect. Every room is namespaced by organization.
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractSessionToken(client);
      const session = token ? await this.betterAuthService.validateSession(token) : null;
      const host = client.handshake.headers["x-forwarded-host"] || client.handshake.headers.host;
      const tenant = await this.tenantResolver.resolveByHost(
        Array.isArray(host) ? host[0] : host
      );

      const allowed =
        !!session &&
        !!tenant &&
        session.user.status === "ACTIVE" &&
        (session.user.role === "SUPER_ADMIN" ||
          (await this.betterAuthService.hasOrganizationAccess(
            session.user.id,
            tenant.organizationId
          )));

      if (!allowed || !tenant) {
        client.emit("connection_status", "unauthorized");
        client.disconnect(true);
        return;
      }

      client.data.organizationId = tenant.organizationId;
      this.logger.log(`Client connected: ${client.id}`);
      client.emit("connection_status", "connected");
    } catch (error) {
      this.logger.warn(`Rejected socket ${client.id}: ${String(error)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractSessionToken(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]).split(".")[0];
  }

  private roomFor(organizationId: string, phoneNumber: string): string {
    return `org_${organizationId}:conversation_${phoneNumber}`;
  }

  private clientRoom(client: Socket, phoneNumber: string): string | null {
    const organizationId = client.data.organizationId as string | undefined;
    return organizationId ? this.roomFor(organizationId, phoneNumber) : null;
  }

  private currentRoom(phoneNumber: string): string {
    return this.roomFor(TenantContext.requireOrganizationId(), phoneNumber);
  }

  @SubscribeMessage("join_room")
  handleJoinRoom(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ): void {
    const room = this.clientRoom(client, data.phoneNumber);
    if (!room) return;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    client.emit("room_joined", { room });
  }

  @SubscribeMessage("leave_room")
  handleLeaveRoom(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ): void {
    const room = this.clientRoom(client, data.phoneNumber);
    if (!room) return;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
    client.emit("room_left", { room });
  }

  @SubscribeMessage("typing_start")
  handleTypingStart(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ) {
    const room = this.clientRoom(client, data.phoneNumber);
    if (!room) return;
    client.to(room).emit("user_typing", { phoneNumber: data.phoneNumber });
  }

  @SubscribeMessage("typing_stop")
  handleTypingStop(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ) {
    const room = this.clientRoom(client, data.phoneNumber);
    if (!room) return;
    client
      .to(room)
      .emit("user_stopped_typing", { phoneNumber: data.phoneNumber });
  }

  // Emit new message to all clients in conversation room
  emitNewMessage(phoneNumber: string, message: WhatsAppMessage): void {
    const room = this.currentRoom(phoneNumber);
    this.server.to(room).emit("new_message", message);
    this.logger.debug(`Emitted new message to room: ${room}`);
  }

  // Emit message status update to all clients in conversation room
  emitMessageStatusUpdate(
    phoneNumber: string,
    messageId: string,
    status: string
  ): void {
    const room = this.currentRoom(phoneNumber);
    this.server.to(room).emit("message_status_update", { messageId, status });
    this.logger.debug(
      `Emitted status update for message ${messageId} to room: ${room}`
    );
  }

  // Emit conversation update to all clients
  emitConversationUpdate(phoneNumber: string): void {
    const room = this.currentRoom(phoneNumber);
    this.server.to(room).emit("conversation_update", { phoneNumber });
    this.logger.debug(`Emitted conversation update to room: ${room}`);
  }

  // Emit to specific conversation room
  emitToConversation(phoneNumber: string, event: string, data: any) {
    const room = this.currentRoom(phoneNumber);
    this.server.to(room).emit(event, data);
    this.logger.log(`Emitted ${event} to room: ${room}`);
  }


}
