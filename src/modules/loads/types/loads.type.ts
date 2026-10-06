export interface SyncRun {
    id: string;
    status: string;
    createdAt: string;
}

export interface LoadTaskTechError {
    code?: string;
    message?: string;
}

export interface LoadTask {
    id: number;
    status: string;
    syncRunId: string;
    cabinetType: string | null;
    cabinetId: string | null;
    cabinetName: string | null;
    messageError: string | null;
    techError: LoadTaskTechError | null;
}

export interface SellerPage<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    offset: number;
    totalPages: number;
}
