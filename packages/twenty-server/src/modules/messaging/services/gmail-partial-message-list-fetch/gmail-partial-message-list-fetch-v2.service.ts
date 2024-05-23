import { Injectable, Logger } from '@nestjs/common';

import { gmail_v1 } from 'googleapis';

import { GmailClientProvider } from 'src/modules/messaging/services/providers/gmail/gmail-client.provider';
import { ConnectedAccountRepository } from 'src/modules/connected-account/repositories/connected-account.repository';
import { MessageChannelRepository } from 'src/modules/messaging/repositories/message-channel.repository';
import { InjectObjectMetadataRepository } from 'src/engine/object-metadata-repository/object-metadata-repository.decorator';
import { ConnectedAccountWorkspaceEntity } from 'src/modules/connected-account/standard-objects/connected-account.workspace-entity';
import {
  MessageChannelWorkspaceEntity,
  MessageChannelSyncSubStatus,
} from 'src/modules/messaging/standard-objects/message-channel.workspace-entity';
import { CacheStorageService } from 'src/engine/integrations/cache-storage/cache-storage.service';
import { InjectCacheStorage } from 'src/engine/integrations/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageNamespace } from 'src/engine/integrations/cache-storage/types/cache-storage-namespace.enum';
import { MessageChannelMessageAssociationWorkspaceEntity } from 'src/modules/messaging/standard-objects/message-channel-message-association.workspace-entity';
import { MessageChannelMessageAssociationRepository } from 'src/modules/messaging/repositories/message-channel-message-association.repository';
import { GmailPartialMessageListFetchErrorHandlingService } from 'src/modules/messaging/services/gmail-partial-message-list-fetch/gmail-partial-message-list-fetch-error-handling.service';
import { GmailGetHistoryService } from 'src/modules/messaging/services/gmail-partial-message-list-fetch/gmail-get-history.service';
import { SetMessageChannelSyncStatusService } from 'src/modules/messaging/services/set-message-channel-sync-status/set-message-channel-sync-status.service';

@Injectable()
export class GmailPartialMessageListFetchV2Service {
  private readonly logger = new Logger(
    GmailPartialMessageListFetchV2Service.name,
  );

  constructor(
    private readonly gmailClientProvider: GmailClientProvider,
    @InjectObjectMetadataRepository(ConnectedAccountWorkspaceEntity)
    private readonly connectedAccountRepository: ConnectedAccountRepository,
    @InjectObjectMetadataRepository(MessageChannelWorkspaceEntity)
    private readonly messageChannelRepository: MessageChannelRepository,
    @InjectCacheStorage(CacheStorageNamespace.Messaging)
    private readonly cacheStorage: CacheStorageService,
    @InjectObjectMetadataRepository(
      MessageChannelMessageAssociationWorkspaceEntity,
    )
    private readonly messageChannelMessageAssociationRepository: MessageChannelMessageAssociationRepository,
    private readonly gmailPartialMessageListFetchErrorHandlingService: GmailPartialMessageListFetchErrorHandlingService,
    private readonly gmailGetHistoryService: GmailGetHistoryService,
    private readonly setMessageChannelSyncStatusService: SetMessageChannelSyncStatusService,
  ) {}

  public async processMessageListFetch(
    workspaceId: string,
    connectedAccountId: string,
  ): Promise<void> {
    const connectedAccount = await this.connectedAccountRepository.getById(
      connectedAccountId,
      workspaceId,
    );

    if (!connectedAccount) {
      this.logger.error(
        `Connected account ${connectedAccountId} not found in workspace ${workspaceId}`,
      );

      return;
    }

    const refreshToken = connectedAccount.refreshToken;

    if (!refreshToken) {
      throw new Error(
        `No refresh token found for connected account ${connectedAccountId} in workspace ${workspaceId}`,
      );
    }

    const messageChannel =
      await this.messageChannelRepository.getFirstByConnectedAccountId(
        connectedAccountId,
        workspaceId,
      );

    if (!messageChannel) {
      this.logger.error(
        `No message channel found for connected account ${connectedAccountId} in workspace ${workspaceId}`,
      );

      return;
    }

    if (
      messageChannel.syncSubStatus !==
      MessageChannelSyncSubStatus.PARTIAL_MESSAGES_LIST_FETCH_PENDING
    ) {
      this.logger.log(
        `Messaging import for workspace ${workspaceId} and account ${connectedAccountId} is locked, import will be retried later.`,
      );

      return;
    }

    await this.setMessageChannelSyncStatusService.setMessageListFetchOnGoingStatus(
      messageChannel.id,
      workspaceId,
    );

    const lastSyncHistoryId = messageChannel.syncCursor;

    if (!lastSyncHistoryId) {
      this.logger.log(
        `No lastSyncHistoryId for workspace ${workspaceId} and account ${connectedAccountId}, falling back to full sync.`,
      );

      await this.setMessageChannelSyncStatusService.setFullMessageListFetchPendingStatus(
        messageChannel.id,
        workspaceId,
      );

      return;
    }

    const gmailClient: gmail_v1.Gmail =
      await this.gmailClientProvider.getGmailClient(refreshToken);

    const { history, historyId, error } =
      await this.gmailGetHistoryService.getHistory(
        gmailClient,
        lastSyncHistoryId,
      );

    if (error) {
      await this.gmailPartialMessageListFetchErrorHandlingService.handleGmailError(
        error,
        messageChannel,
        workspaceId,
        connectedAccountId,
      );

      return;
    }

    if (!historyId) {
      throw new Error(
        `No historyId found for ${connectedAccountId} in workspace ${workspaceId} in gmail history response.`,
      );
    }

    if (historyId === lastSyncHistoryId || !history?.length) {
      this.logger.log(
        `Messaging import done with history ${historyId} and nothing to update for workspace ${workspaceId} and account ${connectedAccountId}`,
      );

      await this.setMessageChannelSyncStatusService.setCompletedStatus(
        messageChannel.id,
        workspaceId,
      );

      return;
    }

    const { messagesAdded, messagesDeleted } =
      await this.gmailGetHistoryService.getMessageIdsFromHistory(history);

    await this.cacheStorage.setAdd(
      `messages-to-import:${workspaceId}:gmail:${messageChannel.id}`,
      messagesAdded,
    );

    this.logger.log(
      `Added ${messagesAdded.length} messages to import for workspace ${workspaceId} and account ${connectedAccountId}`,
    );

    await this.messageChannelMessageAssociationRepository.deleteByMessageExternalIdsAndMessageChannelId(
      messagesDeleted,
      messageChannel.id,
      workspaceId,
    );

    this.logger.log(
      `Deleted ${messagesDeleted.length} messages for workspace ${workspaceId} and account ${connectedAccountId}`,
    );

    await this.messageChannelRepository.updateLastSyncCursorIfHigher(
      messageChannel.id,
      historyId,
      workspaceId,
    );

    this.logger.log(
      `Updated lastSyncCursor to ${historyId} for workspace ${workspaceId} and account ${connectedAccountId}`,
    );

    this.logger.log(
      `gmail partial-sync done for workspace ${workspaceId} and account ${connectedAccountId}`,
    );

    await this.setMessageChannelSyncStatusService.setMessagesImportPendingStatus(
      messageChannel.id,
      workspaceId,
    );
  }
}
