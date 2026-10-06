import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoadTask, SellerPage, SyncRun } from './types/loads.type';

@Injectable()
export class LoadsService {
    private readonly sellerApi: string;
    private readonly userToken: string;

    constructor(private readonly configService: ConfigService) {
        this.sellerApi = this.configService.getOrThrow<string>('SELLER_API').replace('\\://', '://').replace(/\/+$/, '');
        this.userToken = this.configService.getOrThrow<string>('USER_TOKEN').replace(/\\\$/g, '$');
    }

    async getLatestSyncRunId(): Promise<string> {
        const page = await this.request<SellerPage<SyncRun>>('/sync-runs', {
            page: '1',
            limit: '1',
        });
        const syncRunId = page.data[0]?.id;

        if (!syncRunId) {
            throw new NotFoundException('Запуски синхронизации не найдены');
        }

        return syncRunId;
    }

    async getErrorTasks(syncRunId: string): Promise<LoadTask[]> {
        const tasks: LoadTask[] = [];
        const limit = 500;
        let pageNumber = 1;
        let totalPages = 1;

        do {
            const page = await this.request<SellerPage<LoadTask>>('/tasks', {
                status: 'error',
                syncRunId,
                page: String(pageNumber),
                limit: String(limit),
            });

            tasks.push(...page.data);
            totalPages = Math.max(1, page.totalPages);
            pageNumber += 1;
        } while (pageNumber <= totalPages);

        return tasks;
    }

    async getLatestRunErrorTasks(): Promise<{
        syncRunId: string;
        tasks: LoadTask[];
    }> {
        const syncRunId = await this.getLatestSyncRunId();
        const tasks = await this.getErrorTasks(syncRunId);

        return { syncRunId, tasks };
    }

    private async request<T>(resource: '/sync-runs' | '/tasks', query: Record<string, string>): Promise<T> {
        const url = new URL(`${this.sellerApi}/api/adminka${resource}`);

        for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value);
        }

        try {
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${this.userToken}`,
                },
            });
            const body = (await response.json().catch(() => null)) as T | { message?: string } | null;

            if (!response.ok) {
                const apiMessage = body && typeof body === 'object' && 'message' in body ? body.message : undefined;

                throw new BadGatewayException(apiMessage ?? `Seller API вернул HTTP ${response.status}`);
            }

            return body as T;
        } catch (error) {
            if (error instanceof BadGatewayException) {
                throw error;
            }

            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new BadGatewayException(`Seller API недоступен: ${message}`);
        }
    }
}
