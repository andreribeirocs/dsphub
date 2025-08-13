import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { DriverService } from "../drivers/drivers.service";
import { Driver } from "../drivers/drivers.model";
import {
  WhatsAppMessage,
  WhatsAppConversation,
  MessageStatus,
} from "./whatsapp.model";

@Component({
  selector: "app-whatsapp-messaging",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./whatsapp.component.html",
  styleUrls: ["./whatsapp.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppMessagingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private whatsappService = inject(WhatsAppService);
  private driverService = inject(DriverService);

  // Signals for reactive state
  conversations = signal<WhatsAppConversation[]>([]);
  selectedConversation = signal<WhatsAppConversation | null>(null);
  drivers = signal<Driver[]>([]);
  newMessage = signal("");
  isLoading = signal(false);
  showNewConversation = signal(false);
  selectedDriverForNewChat = signal<Driver | null>(null);
  searchTerm = signal("");
  connectionStatus = signal<"connected" | "disconnected" | "connecting">(
    "disconnected"
  );

  // Computed values
  filteredConversations = computed(() => {
    const search = this.searchTerm().toLowerCase();
    return this.conversations().filter(
      (conv) =>
        conv.driverName.toLowerCase().includes(search) ||
        conv.driverPhone.includes(search)
    );
  });

  unreadCount = computed(() => {
    return this.conversations().reduce(
      (count, conv) => count + conv.unreadCount,
      0
    );
  });

  availableDrivers = computed(() => {
    const existingPhones = this.conversations().map((conv) => conv.driverPhone);
    return this.drivers().filter(
      (driver) => !existingPhones.includes(driver.phone)
    );
  });

  ngOnInit() {
    this.loadDrivers();
    this.loadConversations();
    this.initializeWebSocket();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.whatsappService.disconnect();
  }

  private loadDrivers() {
    this.driverService
      .getDrivers()
      .pipe(takeUntil(this.destroy$))
      .subscribe((drivers) => {
        this.drivers.set(drivers);
      });
  }

  private loadConversations() {
    this.isLoading.set(true);
    this.whatsappService
      .getConversations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conversations) => {
          this.conversations.set(conversations);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error("Error loading conversations:", error);
          this.isLoading.set(false);
        },
      });
  }

  private initializeWebSocket() {
    this.connectionStatus.set("connecting");

    this.whatsappService
      .connect()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.connectionStatus.set(status);
        },
        error: (error) => {
          console.error("WebSocket connection error:", error);
          this.connectionStatus.set("disconnected");
        },
      });

    // Listen for incoming messages
    this.whatsappService
      .onMessageReceived()
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: WhatsAppMessage) => {
        this.handleIncomingMessage(message);
      });

    // Listen for message status updates
    this.whatsappService
      .onMessageStatusUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        this.handleMessageStatusUpdate(update);
      });
  }

  private handleIncomingMessage(message: WhatsAppMessage) {
    const conversations = this.conversations();
    const existingConvIndex = conversations.findIndex(
      (conv) => conv.driverPhone === message.from
    );

    if (existingConvIndex !== -1) {
      // Update existing conversation
      const updatedConversations = [...conversations];
      updatedConversations[existingConvIndex].messages.push(message);
      updatedConversations[existingConvIndex].lastMessage = message.body;
      updatedConversations[existingConvIndex].lastMessageTime =
        message.timestamp;
      updatedConversations[existingConvIndex].unreadCount += 1;
      this.conversations.set(updatedConversations);
    } else {
      // Create new conversation
      const driver = this.drivers().find((d) => d.phone === message.from);
      if (driver) {
        const newConversation: WhatsAppConversation = {
          id: Date.now().toString(),
          driverPhone: message.from,
          driverName: driver.name,
          driverAvatar: driver.avatar,
          messages: [message],
          lastMessage: message.body,
          lastMessageTime: message.timestamp,
          unreadCount: 1,
        };
        this.conversations.set([newConversation, ...conversations]);
      }
    }
  }

  private handleMessageStatusUpdate(update: {
    messageId: string;
    status: MessageStatus;
  }) {
    const conversations = this.conversations();
    const updatedConversations = conversations.map((conv) => ({
      ...conv,
      messages: conv.messages.map((msg) =>
        msg.id === update.messageId ? { ...msg, status: update.status } : msg
      ),
    }));
    this.conversations.set(updatedConversations);
  }

  selectConversation(conversation: WhatsAppConversation) {
    this.selectedConversation.set(conversation);
    this.markAsRead(conversation);
  }

  private markAsRead(conversation: WhatsAppConversation) {
    const conversations = this.conversations();
    const updatedConversations = conversations.map((conv) =>
      conv.id === conversation.id ? { ...conv, unreadCount: 0 } : conv
    );
    this.conversations.set(updatedConversations);
  }

  sendMessage() {
    const message = this.newMessage().trim();
    const conversation = this.selectedConversation();

    if (!message || !conversation) return;

    this.isLoading.set(true);

    this.whatsappService
      .sendMessage(conversation.driverPhone, message)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sentMessage) => {
          // Add message to conversation
          const conversations = this.conversations();
          const updatedConversations = conversations.map((conv) =>
            conv.id === conversation.id
              ? {
                  ...conv,
                  messages: [...conv.messages, sentMessage],
                  lastMessage: sentMessage.body,
                  lastMessageTime: sentMessage.timestamp,
                }
              : conv
          );
          this.conversations.set(updatedConversations);
          this.selectedConversation.set({
            ...conversation,
            messages: [...conversation.messages, sentMessage],
            lastMessage: sentMessage.body,
            lastMessageTime: sentMessage.timestamp,
          });
          this.newMessage.set("");
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error("Error sending message:", error);
          this.isLoading.set(false);
        },
      });
  }

  startNewConversation(driver: Driver) {
    const newConversation: WhatsAppConversation = {
      id: Date.now().toString(),
      driverPhone: driver.phone,
      driverName: driver.name,
      driverAvatar: driver.avatar,
      messages: [],
      lastMessage: "",
      lastMessageTime: new Date(),
      unreadCount: 0,
    };

    this.conversations.set([newConversation, ...this.conversations()]);
    this.selectedConversation.set(newConversation);
    this.showNewConversation.set(false);
    this.selectedDriverForNewChat.set(null);

    // Automatically send template message to initiate conversation
    this.sendTemplateMessage(driver.phone);
  }

  sendTemplateMessage(phoneNumber: string) {
    this.isLoading.set(true);

    this.whatsappService
      .sendTemplateMessage(phoneNumber)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sentMessage) => {
          // Add template message to conversation
          const conversations = this.conversations();
          const updatedConversations = conversations.map((conv) =>
            conv.driverPhone === phoneNumber
              ? {
                  ...conv,
                  messages: [...conv.messages, sentMessage],
                  lastMessage: sentMessage.body,
                  lastMessageTime: sentMessage.timestamp,
                }
              : conv
          );
          this.conversations.set(updatedConversations);

          // Update selected conversation if it matches
          const selectedConv = this.selectedConversation();
          if (selectedConv && selectedConv.driverPhone === phoneNumber) {
            this.selectedConversation.set({
              ...selectedConv,
              messages: [...selectedConv.messages, sentMessage],
              lastMessage: sentMessage.body,
              lastMessageTime: sentMessage.timestamp,
            });
          }

          this.isLoading.set(false);
        },
        error: (error) => {
          console.error("Error sending template message:", error);
          this.isLoading.set(false);
          // Show user-friendly error message
          alert(
            "Failed to send template message. Please check your connection and try again."
          );
        },
      });
  }

  sendTemplateMessageToSelectedConversation() {
    const conversation = this.selectedConversation();
    if (!conversation) return;

    this.sendTemplateMessage(conversation.driverPhone);
  }

  deleteConversation(conversation: WhatsAppConversation) {
    if (
      confirm(
        `Are you sure you want to delete the conversation with ${conversation.driverName}?`
      )
    ) {
      const conversations = this.conversations().filter(
        (conv) => conv.id !== conversation.id
      );
      this.conversations.set(conversations);

      if (this.selectedConversation()?.id === conversation.id) {
        this.selectedConversation.set(null);
      }
    }
  }

  sendQuickMessage(template: string) {
    this.newMessage.set(template);
    this.sendMessage();
  }

  getMessageStatusIcon(status: MessageStatus): string {
    switch (status) {
      case "sent":
        return "check";
      case "delivered":
        return "check-check";
      case "read":
        return "check-check-blue";
      case "failed":
        return "x";
      default:
        return "clock";
    }
  }

  getMessageStatusColor(status: MessageStatus): string {
    switch (status) {
      case "sent":
        return "text-gray-400";
      case "delivered":
        return "text-gray-600";
      case "read":
        return "text-blue-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-gray-300";
    }
  }

  formatTime(date: Date): string {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  formatDate(date: Date): string {
    const today = new Date();
    const messageDate = new Date(date);

    if (messageDate.toDateString() === today.toDateString()) {
      return "Today";
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(messageDate);
  }

  getInitials(name: string): string {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  onNewMessageChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.newMessage.set(target.value);
  }

  onDriverSelect(event: Event) {
    const target = event.target as HTMLSelectElement;
    const driverId = target.value;
    const driver = this.drivers().find((d) => d.id.toString() === driverId);
    this.selectedDriverForNewChat.set(driver || null);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
