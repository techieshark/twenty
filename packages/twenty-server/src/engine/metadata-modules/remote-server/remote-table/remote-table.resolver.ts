import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { RemoteTableInput } from 'src/engine/metadata-modules/remote-server/remote-table/dtos/remote-table-input';
import { RemoteTableDTO } from 'src/engine/metadata-modules/remote-server/remote-table/dtos/remote-table.dto';
import { RemoteTableService } from 'src/engine/metadata-modules/remote-server/remote-table/remote-table.service';

@UseGuards(JwtAuthGuard)
@Resolver()
export class RemoteTableResolver {
  constructor(private readonly remoteTableService: RemoteTableService) {}

  @Mutation(() => RemoteTableDTO)
  async syncRemoteTable(
    @Args('input') input: RemoteTableInput,
    @AuthWorkspace() { id: workspaceId }: Workspace,
  ) {
    return this.remoteTableService.syncRemoteTable(input, workspaceId);
  }

  @Mutation(() => RemoteTableDTO)
  async unsyncRemoteTable(
    @Args('input') input: RemoteTableInput,
    @AuthWorkspace() { id: workspaceId }: Workspace,
  ) {
    return this.remoteTableService.unsyncRemoteTable(input, workspaceId);
  }
}
